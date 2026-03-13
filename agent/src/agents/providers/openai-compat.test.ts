import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAICompatProvider } from './openai-compat.js';
import type { CostInfo } from './base.js';

// ---------------------------------------------------------------------------
// Concrete subclass for testing (OpenAICompatProvider is abstract)
// ---------------------------------------------------------------------------

class TestProvider extends OpenAICompatProvider {
  name = 'test-provider';

  constructor(overrides?: Partial<{ connectTimeoutMs: number; idleTimeoutMs: number; streamUsage: boolean }>) {
    super({
      apiKey: 'test-key',
      baseURL: 'https://example.com/v1',
      model: 'test-model',
      temperature: 0.5,
      maxTokens: 1024,
      ...overrides,
    });
    this.config.provider = 'test-provider';
  }

  getCost(usage: { inputTokens: number; outputTokens: number }): CostInfo {
    return {
      provider: this.name,
      model: this.config.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalCost: (usage.inputTokens + usage.outputTokens) * 0.000001,
      currency: 'USD',
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers to build mock SSE streams
// ---------------------------------------------------------------------------

function encodeSSE(lines: string[]): Uint8Array {
  return new TextEncoder().encode(lines.join('\n') + '\n');
}

function makeMockResponse(body: string, status = 200): Response {
  const chunks = [new TextEncoder().encode(body)];
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++]!);
      } else {
        controller.close();
      }
    },
  });
  return new Response(stream, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

// ---------------------------------------------------------------------------
// toOpenAIMessages
// ---------------------------------------------------------------------------

describe('OpenAICompatProvider.toOpenAIMessages', () => {
  const provider = new TestProvider();

  it('maps a user message', () => {
    const result = provider.toOpenAIMessages([{ role: 'user', content: 'hello' }]);
    expect(result).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('maps a system message', () => {
    const result = provider.toOpenAIMessages([{ role: 'system', content: 'be helpful' }]);
    expect(result).toEqual([{ role: 'system', content: 'be helpful' }]);
  });

  it('maps a tool message using toolCallId', () => {
    const result = provider.toOpenAIMessages([
      { role: 'tool', content: '{"ok":true}', toolCallId: 'call_abc', toolName: 'my_tool' },
    ]);
    expect(result).toEqual([{ role: 'tool', content: '{"ok":true}', tool_call_id: 'call_abc' }]);
  });

  it('defaults tool_call_id to "unknown" when toolCallId is absent', () => {
    const result = provider.toOpenAIMessages([{ role: 'tool', content: 'result' }]);
    expect(result[0]).toMatchObject({ tool_call_id: 'unknown' });
  });

  it('adds tool_calls to assistant message', () => {
    const result = provider.toOpenAIMessages([
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'tc1', name: 'bash', args: { cmd: 'ls' } }],
      },
    ]);
    expect(result[0]).toMatchObject({
      role: 'assistant',
      tool_calls: [
        {
          id: 'tc1',
          type: 'function',
          function: { name: 'bash', arguments: '{"cmd":"ls"}' },
        },
      ],
    });
  });

  it('preserves already-stringified args in tool_calls', () => {
    const result = provider.toOpenAIMessages([
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'tc2', name: 'read', args: '{"path":"/tmp"}' as unknown as Record<string, unknown> }],
      },
    ]);
    expect((result[0] as { tool_calls: Array<{ function: { arguments: string } }> }).tool_calls[0]?.function.arguments).toBe('{"path":"/tmp"}');
  });

  it('does not add tool_calls field when array is empty', () => {
    const result = provider.toOpenAIMessages([
      { role: 'assistant', content: 'hi', tool_calls: [] },
    ]);
    expect(result[0]).not.toHaveProperty('tool_calls');
  });
});

// ---------------------------------------------------------------------------
// toOpenAITools
// ---------------------------------------------------------------------------

describe('OpenAICompatProvider.toOpenAITools', () => {
  const provider = new TestProvider();

  it('converts tool schemas to OpenAI function format', () => {
    const result = provider.toOpenAITools([
      {
        name: 'bash',
        description: 'Run a shell command',
        parameters: { type: 'object', properties: { cmd: { type: 'string' } } },
      },
    ]);
    expect(result).toEqual([
      {
        type: 'function',
        function: {
          name: 'bash',
          description: 'Run a shell command',
          parameters: { type: 'object', properties: { cmd: { type: 'string' } } },
        },
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// buildBody
// ---------------------------------------------------------------------------

describe('OpenAICompatProvider.buildBody', () => {
  const provider = new TestProvider();

  it('builds a basic body without tools', () => {
    const body = provider.buildBody([{ role: 'user', content: 'hi' }], [], false);
    expect(body).toMatchObject({
      model: 'test-model',
      temperature: 0.5,
      max_tokens: 1024,
      stream: false,
    });
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('tool_choice');
  });

  it('adds tools and tool_choice when tools are provided', () => {
    const body = provider.buildBody(
      [{ role: 'user', content: 'hi' }],
      [{ name: 'bash', description: 'shell', parameters: {} }],
      true,
    );
    expect(body.tool_choice).toBe('auto');
    expect(Array.isArray(body.tools)).toBe(true);
    expect((body.tools as unknown[]).length).toBe(1);
    expect(body.stream).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// invoke
// ---------------------------------------------------------------------------

describe('OpenAICompatProvider.invoke', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns content from a successful response', async () => {
    const responseBody: unknown = {
      choices: [{ message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));

    const provider = new TestProvider();
    const result = await provider.invoke([{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('Hello!');
    expect(result.tool_calls).toBeUndefined();
  });

  it('returns tool_calls when the response contains them', async () => {
    const responseBody: unknown = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'bash', arguments: '{"cmd":"ls"}' },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));

    const provider = new TestProvider();
    const result = await provider.invoke([{ role: 'user', content: 'run ls' }]);
    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls![0]).toMatchObject({ name: 'bash', args: '{"cmd":"ls"}', id: 'call_1' });
  });

  it('throws on non-200 response', async () => {
    fetchMock.mockResolvedValue(new Response('Unauthorized', { status: 401 }));

    const provider = new TestProvider();
    await expect(provider.invoke([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      'test-provider API error 401: Unauthorized',
    );
  });

  it('sends Authorization header with Bearer token', async () => {
    const responseBody: unknown = {
      choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));

    const provider = new TestProvider();
    await provider.invoke([{ role: 'user', content: 'hi' }]);

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key');
  });
});

// ---------------------------------------------------------------------------
// stream
// ---------------------------------------------------------------------------

describe('OpenAICompatProvider.stream', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yields text tokens from SSE stream', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"content":" World"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
      'data: [DONE]',
    ].join('\n');

    fetchMock.mockResolvedValue(makeMockResponse(sse));

    const provider = new TestProvider();
    const tokens: string[] = [];
    for await (const msg of provider.stream([{ role: 'user', content: 'hi' }])) {
      if (msg.content) tokens.push(msg.content);
    }
    expect(tokens).toEqual(['Hello', ' World']);
  });

  it('accumulates tool call deltas and yields on finish_reason tool_calls', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","type":"function","function":{"name":"bash","arguments":""}}]},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":\'{"cmd":"ls"}\'}}]},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
      'data: [DONE]',
    ].join('\n');

    fetchMock.mockResolvedValue(makeMockResponse(sse));

    const provider = new TestProvider();
    const msgs: Array<{ content: string; tool_calls?: unknown[] }> = [];
    for await (const msg of provider.stream([{ role: 'user', content: 'run ls' }])) {
      msgs.push(msg);
    }
    const withCalls = msgs.find((m) => m.tool_calls && m.tool_calls.length > 0);
    expect(withCalls).toBeDefined();
    expect((withCalls!.tool_calls as Array<{ name: string }>)[0]?.name).toBe('bash');
  });

  it('stops on [DONE] line and does not throw', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"hi"},"finish_reason":null}]}',
      'data: [DONE]',
    ].join('\n');

    fetchMock.mockResolvedValue(makeMockResponse(sse));

    const provider = new TestProvider();
    const tokens: string[] = [];
    for await (const msg of provider.stream([{ role: 'user', content: 'hi' }])) {
      tokens.push(msg.content);
    }
    expect(tokens).toContain('hi');
  });

  it('throws on non-200 streaming response', async () => {
    fetchMock.mockResolvedValue(new Response('rate limited', { status: 429 }));

    const provider = new TestProvider();
    await expect(async () => {
      for await (const _ of provider.stream([{ role: 'user', content: 'hi' }])) {
        // consume
      }
    }).rejects.toThrow('test-provider API error 429');
  });

  it('throws when response body is null', async () => {
    const resp = new Response(null, { status: 200 });
    fetchMock.mockResolvedValue(resp);

    const provider = new TestProvider();
    await expect(async () => {
      for await (const _ of provider.stream([{ role: 'user', content: 'hi' }])) {
        // consume
      }
    }).rejects.toThrow('no response body');
  });
});

// ---------------------------------------------------------------------------
// getCost (via subclass)
// ---------------------------------------------------------------------------

describe('TestProvider.getCost', () => {
  it('returns a CostInfo with correct totals', () => {
    const provider = new TestProvider();
    const cost = provider.getCost({ inputTokens: 100, outputTokens: 200 });
    expect(cost.provider).toBe('test-provider');
    expect(cost.inputTokens).toBe(100);
    expect(cost.outputTokens).toBe(200);
    expect(cost.currency).toBe('USD');
  });
});

// ---------------------------------------------------------------------------
// encodeSSE helper (used indirectly, but explicitly verifiable)
// ---------------------------------------------------------------------------

describe('encodeSSE helper', () => {
  it('round-trips through TextDecoder', () => {
    const data = encodeSSE(['data: hello', 'data: world']);
    const decoded = new TextDecoder().decode(data);
    expect(decoded).toContain('data: hello');
    expect(decoded).toContain('data: world');
  });
});

// ---------------------------------------------------------------------------
// invoke — usage populated
// ---------------------------------------------------------------------------

describe('OpenAICompatProvider.invoke — usage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('populates usage from response when present', async () => {
    const responseBody: unknown = {
      choices: [{ message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));

    const provider = new TestProvider();
    const result = await provider.invoke([{ role: 'user', content: 'hi' }]);
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
  });

  it('omits usage when response has no usage field', async () => {
    const responseBody: unknown = {
      choices: [{ message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));

    const provider = new TestProvider();
    const result = await provider.invoke([{ role: 'user', content: 'hi' }]);
    expect(result.usage).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildBody — stream_options opt-in
// ---------------------------------------------------------------------------

describe('OpenAICompatProvider.buildBody — stream_options', () => {
  it('adds stream_options when streamUsage=true and stream=true', () => {
    const provider = new TestProvider({ streamUsage: true });
    const body = provider.buildBody([{ role: 'user', content: 'hi' }], [], true);
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  it('omits stream_options when streamUsage=true but stream=false', () => {
    const provider = new TestProvider({ streamUsage: true });
    const body = provider.buildBody([{ role: 'user', content: 'hi' }], [], false);
    expect(body).not.toHaveProperty('stream_options');
  });

  it('omits stream_options when streamUsage=false and stream=true', () => {
    const provider = new TestProvider({ streamUsage: false });
    const body = provider.buildBody([{ role: 'user', content: 'hi' }], [], true);
    expect(body).not.toHaveProperty('stream_options');
  });

  it('omits stream_options by default (no streamUsage given)', () => {
    const provider = new TestProvider();
    const body = provider.buildBody([{ role: 'user', content: 'hi' }], [], true);
    expect(body).not.toHaveProperty('stream_options');
  });
});

// ---------------------------------------------------------------------------
// stream — trailing usage chunk
// ---------------------------------------------------------------------------

describe('OpenAICompatProvider.stream — usage chunk', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yields a final usage chunk from trailing SSE data when choices is empty', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
      'data: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":10,"total_tokens":15}}',
      'data: [DONE]',
    ].join('\n');

    fetchMock.mockResolvedValue(makeMockResponse(sse));

    const provider = new TestProvider({ streamUsage: true });
    const msgs: Array<{ content: string; usage?: unknown }> = [];
    for await (const msg of provider.stream([{ role: 'user', content: 'hi' }])) {
      msgs.push(msg);
    }

    const usageChunk = msgs.find((m) => m.usage !== undefined);
    expect(usageChunk).toBeDefined();
    expect(usageChunk!.usage).toEqual({ inputTokens: 5, outputTokens: 10, totalTokens: 15 });
    expect(usageChunk!.content).toBe('');
  });

  it('does not yield usage chunk when no trailing usage present', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
      'data: [DONE]',
    ].join('\n');

    fetchMock.mockResolvedValue(makeMockResponse(sse));

    const provider = new TestProvider();
    const msgs: Array<{ content: string; usage?: unknown }> = [];
    for await (const msg of provider.stream([{ role: 'user', content: 'hi' }])) {
      msgs.push(msg);
    }

    expect(msgs.every((m) => m.usage === undefined)).toBe(true);
  });
});
