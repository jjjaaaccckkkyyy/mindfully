import { describe, it, expect, vi } from 'vitest';
import { ProviderChain } from './chain.js';
import type { LLMProvider, Message, AIMessage, CostInfo, ToolSchema } from './base.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProvider(
  name: string,
  invokeResult: AIMessage | Error,
  streamChunks: Array<AIMessage | Error> = [],
): LLMProvider {
  return {
    name,
    config: { provider: name, model: 'test-model', temperature: 0.7, maxTokens: 1024 },
    invoke: vi.fn(async () => {
      if (invokeResult instanceof Error) throw invokeResult;
      return invokeResult;
    }),
    async *stream(_messages: Message[], _tools: ToolSchema[] = []) {
      for (const chunk of streamChunks) {
        if (chunk instanceof Error) throw chunk;
        yield chunk;
      }
    },
    getCost(usage: { inputTokens: number; outputTokens: number }): CostInfo {
      return {
        provider: name,
        model: 'test-model',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalCost: (usage.inputTokens + usage.outputTokens) * 0.000001,
        currency: 'USD',
      };
    },
  };
}

// A provider whose stream throws before yielding anything
function makePreStreamFailProvider(name: string, failTimes: number, successChunks: AIMessage[]): LLMProvider {
  let callCount = 0;
  return {
    name,
    config: { provider: name, model: 'test-model', temperature: 0.7, maxTokens: 1024 },
    invoke: vi.fn(async () => ({ content: 'ok' })),
    async *stream() {
      callCount++;
      if (callCount <= failTimes) {
        throw new Error(`${name} pre-stream failure #${callCount}`);
      }
      for (const chunk of successChunks) {
        yield chunk;
      }
    },
    getCost(usage: { inputTokens: number; outputTokens: number }): CostInfo {
      return {
        provider: name,
        model: 'test-model',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalCost: (usage.inputTokens + usage.outputTokens) * 0.000001,
        currency: 'USD',
      };
    },
  };
}

// A provider that yields some chunks then throws mid-stream
function makeMidStreamFailProvider(name: string, chunksBeforeFail: AIMessage[]): LLMProvider {
  return {
    name,
    config: { provider: name, model: 'test-model', temperature: 0.7, maxTokens: 1024 },
    invoke: vi.fn(async () => ({ content: 'ok' })),
    async *stream() {
      for (const chunk of chunksBeforeFail) {
        yield chunk;
      }
      throw new Error(`${name} mid-stream failure`);
    },
    getCost(usage: { inputTokens: number; outputTokens: number }): CostInfo {
      return {
        provider: name,
        model: 'test-model',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalCost: (usage.inputTokens + usage.outputTokens) * 0.000001,
        currency: 'USD',
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('ProviderChain — constructor', () => {
  it('throws when no providers given', () => {
    expect(() => new ProviderChain([])).toThrow('At least one provider is required');
  });

  it('accepts a single provider', () => {
    const p = makeProvider('p1', { content: 'ok' });
    expect(() => new ProviderChain([p])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// invoke — cost history populated from usage
// ---------------------------------------------------------------------------

describe('ProviderChain.invoke — cost history', () => {
  it('pushes to costHistory when response has usage', async () => {
    const provider = makeProvider('p1', {
      content: 'ok',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    });
    const chain = new ProviderChain([provider], { retryCount: 1, timeoutMs: 5000, delayMs: 0 });
    await chain.invoke([{ role: 'user', content: 'hi' }]);

    expect(chain.getCostHistory()).toHaveLength(1);
    expect(chain.getCostHistory()[0]).toMatchObject({
      provider: 'p1',
      inputTokens: 10,
      outputTokens: 20,
    });
  });

  it('getTotalCost returns sum across multiple invocations', async () => {
    const provider = makeProvider('p1', {
      content: 'ok',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 },
    });
    const chain = new ProviderChain([provider], { retryCount: 1, timeoutMs: 5000, delayMs: 0 });
    await chain.invoke([{ role: 'user', content: 'hi' }]);
    await chain.invoke([{ role: 'user', content: 'hello' }]);

    expect(chain.getCostHistory()).toHaveLength(2);
    expect(chain.getTotalCost()).toBeGreaterThan(0);
  });

  it('does not push to costHistory when response has no usage', async () => {
    const provider = makeProvider('p1', { content: 'ok' });
    const chain = new ProviderChain([provider], { retryCount: 1, timeoutMs: 5000, delayMs: 0 });
    await chain.invoke([{ role: 'user', content: 'hi' }]);

    expect(chain.getCostHistory()).toHaveLength(0);
    expect(chain.getTotalCost()).toBe(0);
  });

  it('retries retryCount times before falling through to next provider', async () => {
    const failing = makeProvider('p1', new Error('always fails'));
    const succeeding = makeProvider('p2', {
      content: 'fallback',
      usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
    });
    const chain = new ProviderChain([failing, succeeding], { retryCount: 2, timeoutMs: 5000, delayMs: 0 });
    const result = await chain.invoke([{ role: 'user', content: 'hi' }]);

    expect(result.content).toBe('fallback');
    expect((failing.invoke as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('throws when all providers exhaust all retries', async () => {
    const p1 = makeProvider('p1', new Error('p1 broken'));
    const p2 = makeProvider('p2', new Error('p2 broken'));
    const chain = new ProviderChain([p1, p2], { retryCount: 2, timeoutMs: 5000, delayMs: 0 });

    await expect(chain.invoke([{ role: 'user', content: 'hi' }])).rejects.toThrow('All providers failed');
  });
});

// ---------------------------------------------------------------------------
// stream — cost history populated from usage chunk
// ---------------------------------------------------------------------------

describe('ProviderChain.stream — cost history', () => {
  it('pushes to costHistory when a usage chunk is received', async () => {
    const provider = makeProvider('p1', { content: 'ok' }, [
      { content: 'Hello' },
      { content: '', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
    ]);
    const chain = new ProviderChain([provider], { retryCount: 1, timeoutMs: 5000, delayMs: 0 });

    const chunks: AIMessage[] = [];
    for await (const chunk of chain.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk);
    }

    expect(chain.getCostHistory()).toHaveLength(1);
    expect(chain.getCostHistory()[0]).toMatchObject({
      provider: 'p1',
      inputTokens: 10,
      outputTokens: 20,
    });
  });

  it('getTotalCost reflects cost from stream usage chunk', async () => {
    const provider = makeProvider('p1', { content: 'ok' }, [
      { content: 'Hi' },
      { content: '', usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, totalTokens: 2_000_000 } },
    ]);
    const chain = new ProviderChain([provider], { retryCount: 1, timeoutMs: 5000, delayMs: 0 });
    for await (const _ of chain.stream([{ role: 'user', content: 'hi' }])) { /* consume */ }

    expect(chain.getTotalCost()).toBeGreaterThan(0);
  });

  it('does not push to costHistory when no usage chunk present', async () => {
    const provider = makeProvider('p1', { content: 'ok' }, [
      { content: 'Hello' },
      { content: ' World' },
    ]);
    const chain = new ProviderChain([provider], { retryCount: 1, timeoutMs: 5000, delayMs: 0 });
    for await (const _ of chain.stream([{ role: 'user', content: 'hi' }])) { /* consume */ }

    expect(chain.getCostHistory()).toHaveLength(0);
    expect(chain.getTotalCost()).toBe(0);
  });

  it('yields all content chunks', async () => {
    const provider = makeProvider('p1', { content: 'ok' }, [
      { content: 'Hello' },
      { content: ' World' },
    ]);
    const chain = new ProviderChain([provider], { retryCount: 1, timeoutMs: 5000, delayMs: 0 });
    const contents: string[] = [];
    for await (const chunk of chain.stream([{ role: 'user', content: 'hi' }])) {
      contents.push(chunk.content);
    }
    expect(contents).toEqual(['Hello', ' World']);
  });
});

// ---------------------------------------------------------------------------
// stream — pre-stream retry logic
// ---------------------------------------------------------------------------

describe('ProviderChain.stream — pre-stream retry', () => {
  it('retries retryCount times on pre-stream failure then succeeds', async () => {
    // Fails twice (retryCount=3 → retries 0,1 fail, retry 2 succeeds)
    const provider = makePreStreamFailProvider('p1', 2, [{ content: 'success' }]);
    const chain = new ProviderChain([provider], { retryCount: 3, timeoutMs: 5000, delayMs: 0 });

    const chunks: AIMessage[] = [];
    for await (const chunk of chain.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe('success');
  });

  it('falls through to next provider after exhausting retries pre-stream', async () => {
    const failingProvider = makePreStreamFailProvider('p1', 999, []); // always fails
    const successProvider = makeProvider('p2', { content: 'ok' }, [{ content: 'from-p2' }]);
    const chain = new ProviderChain([failingProvider, successProvider], {
      retryCount: 2,
      timeoutMs: 5000,
      delayMs: 0,
    });

    const chunks: AIMessage[] = [];
    for await (const chunk of chain.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk);
    }
    expect(chunks[0]!.content).toBe('from-p2');
  });

  it('throws after all providers exhaust pre-stream retries', async () => {
    const p1 = makePreStreamFailProvider('p1', 999, []);
    const p2 = makePreStreamFailProvider('p2', 999, []);
    const chain = new ProviderChain([p1, p2], { retryCount: 2, timeoutMs: 5000, delayMs: 0 });

    await expect(async () => {
      for await (const _ of chain.stream([{ role: 'user', content: 'hi' }])) { /* consume */ }
    }).rejects.toThrow('All providers failed to stream');
  });
});

// ---------------------------------------------------------------------------
// stream — mid-stream failure (no retry, fall through)
// ---------------------------------------------------------------------------

describe('ProviderChain.stream — mid-stream failure', () => {
  it('does not retry after chunks have been yielded — falls to next provider', async () => {
    const midFailProvider = makeMidStreamFailProvider('p1', [{ content: 'partial' }]);
    const successProvider = makeProvider('p2', { content: 'ok' }, [{ content: 'from-p2' }]);
    const chain = new ProviderChain([midFailProvider, successProvider], {
      retryCount: 3, // high retry count — should NOT be used for mid-stream
      timeoutMs: 5000,
      delayMs: 0,
    });

    const chunks: AIMessage[] = [];
    for await (const chunk of chain.stream([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk);
    }
    // partial chunk from p1, then chunks from p2
    expect(chunks.find((c) => c.content === 'partial')).toBeDefined();
    expect(chunks.find((c) => c.content === 'from-p2')).toBeDefined();
  });

  it('throws after mid-stream failure when only one provider exists', async () => {
    const midFailProvider = makeMidStreamFailProvider('p1', [{ content: 'partial' }]);
    const chain = new ProviderChain([midFailProvider], {
      retryCount: 3,
      timeoutMs: 5000,
      delayMs: 0,
    });

    await expect(async () => {
      for await (const _ of chain.stream([{ role: 'user', content: 'hi' }])) { /* consume */ }
    }).rejects.toThrow('All providers failed to stream');
  });
});

// ---------------------------------------------------------------------------
// getProviders / getCurrentProvider
// ---------------------------------------------------------------------------

describe('ProviderChain — getProviders / getCurrentProvider', () => {
  it('getProviders returns a copy of the providers array', () => {
    const p1 = makeProvider('p1', { content: 'ok' });
    const p2 = makeProvider('p2', { content: 'ok' });
    const chain = new ProviderChain([p1, p2]);
    const providers = chain.getProviders();
    expect(providers).toHaveLength(2);
    expect(providers[0]!.name).toBe('p1');
  });

  it('getCurrentProvider returns the first provider', () => {
    const p1 = makeProvider('p1', { content: 'ok' });
    const chain = new ProviderChain([p1]);
    expect(chain.getCurrentProvider().name).toBe('p1');
  });
});
