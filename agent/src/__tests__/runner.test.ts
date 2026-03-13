import { describe, it, expect, vi } from 'vitest';
import { AgentRunner } from '../agents/runner.js';
import { ProviderChain } from '../agents/providers/chain.js';
import type { LLMProvider, Message, AIMessage, CostInfo, LLMConfig } from '../agents/providers/base.js';
import type { Tool } from 'core';
import type { ToolExecutor, StreamEvent } from '../agents/runner.js';

// ---------------------------------------------------------------------------
// Mock LLMProvider
// ---------------------------------------------------------------------------

/**
 * A mock LLMProvider that returns responses from a pre-defined queue.
 * Each call to invoke() pops the next AIMessage off the queue.
 */
class MockProvider implements LLMProvider {
  name = 'mock';
  config: LLMConfig = {
    provider: 'mock',
    model: 'mock-model',
    temperature: 0,
    maxTokens: 1024,
  };

  private responses: AIMessage[];

  constructor(responses: AIMessage[]) {
    this.responses = [...responses];
  }

  async invoke(_messages: Message[]): Promise<AIMessage> {
    const response = this.responses.shift();
    if (!response) {
      throw new Error('MockProvider: no more responses in queue');
    }
    return response;
  }

  // eslint-disable-next-line require-yield
  async *stream(_messages: Message[]): AsyncGenerator<AIMessage> {
    const response = this.responses.shift();
    if (!response) {
      throw new Error('MockProvider: no more responses in queue');
    }
    yield response;
  }

  getCost(_usage: { inputTokens: number; outputTokens: number }): CostInfo {
    return {
      provider: this.name,
      model: this.config.model,
      inputTokens: _usage.inputTokens,
      outputTokens: _usage.outputTokens,
      totalCost: 0,
      currency: 'USD',
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRunner(responses: AIMessage[]): AgentRunner {
  const provider = new MockProvider(responses);
  const chain = new ProviderChain([provider], { retryCount: 1, timeoutMs: 5000 });
  return new AgentRunner({ providerChain: chain });
}

function makeTool(name: string, result: unknown): Tool {
  return {
    name,
    description: `Mock tool: ${name}`,
    inputSchema: {} as never, // not used by runner directly
    execute: vi.fn().mockResolvedValue(result),
  };
}

const noTools: Tool[] = [];
const noopExecutor: ToolExecutor = async () => ({ result: null });

// Collect all stream events into an array
async function collectStream(runner: AgentRunner, options: Parameters<AgentRunner['stream']>[0]): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of runner.stream(options)) {
    events.push(event);
  }
  return events;
}

// ---------------------------------------------------------------------------
// run() tests
// ---------------------------------------------------------------------------

describe('AgentRunner integration', () => {
  // 1. Basic message flow — no tools
  describe('run() — basic message flow', () => {
    it('returns final state with assistant message when provider responds with plain text', async () => {
      const runner = makeRunner([{ content: 'Hello, world!' }]);

      const state = await runner.run({
        input: 'Say hello',
        tools: noTools,
        toolExecutor: noopExecutor,
      });

      expect(state.error).toBeUndefined();
      expect(state.messages).toHaveLength(2); // user + assistant
      expect(state.messages[0]).toMatchObject({ role: 'user', content: 'Say hello' });
      expect(state.messages[1]).toMatchObject({ role: 'assistant', content: 'Hello, world!' });
      expect(state.toolResults).toHaveLength(0);
    });
  });

  // 2. Tool call execution
  describe('run() — single tool call', () => {
    it('executes a tool and appends tool result to state', async () => {
      const toolCallResponse: AIMessage = {
        content: '',
        tool_calls: [{ name: 'echo', args: JSON.stringify({ text: 'hi' }), id: 'call-1' }],
      };
      const finalResponse: AIMessage = { content: 'Done.' };

      const runner = makeRunner([toolCallResponse, finalResponse]);
      const echoTool = makeTool('echo', 'hi');
      const executor: ToolExecutor = async (toolName, args) => {
        if (toolName === 'echo') return { result: await echoTool.execute(args) };
        return { result: null, error: `Unknown tool: ${toolName}` };
      };

      const state = await runner.run({
        input: 'Echo hi',
        tools: [echoTool],
        toolExecutor: executor,
      });

      expect(state.error).toBeUndefined();
      expect(state.toolResults).toHaveLength(1);
      expect(state.toolResults[0].toolName).toBe('echo');
      expect(state.toolResults[0].result).toBe('hi');
      expect(state.toolResults[0].error).toBeUndefined();

      // Messages: user → assistant (tool_calls) → tool-result → assistant (final)
      const roles = state.messages.map((m) => m.role);
      expect(roles).toEqual(['user', 'assistant', 'tool', 'assistant']);
      expect(state.messages[state.messages.length - 1].content).toBe('Done.');
    });
  });

  // 3. Multi-step — two sequential tool calls before final reply
  describe('run() — multi-step tool calls', () => {
    it('handles multiple sequential tool calls and accumulates results', async () => {
      const call1: AIMessage = {
        content: '',
        tool_calls: [{ name: 'step1', args: '{}', id: 'c1' }],
      };
      const call2: AIMessage = {
        content: '',
        tool_calls: [{ name: 'step2', args: '{}', id: 'c2' }],
      };
      const final: AIMessage = { content: 'All done.' };

      const runner = makeRunner([call1, call2, final]);
      const step1Tool = makeTool('step1', 'result-1');
      const step2Tool = makeTool('step2', 'result-2');
      const executor: ToolExecutor = async (toolName) => {
        if (toolName === 'step1') return { result: await step1Tool.execute({}) };
        if (toolName === 'step2') return { result: await step2Tool.execute({}) };
        return { result: null };
      };

      const state = await runner.run({
        input: 'Do two steps',
        tools: [step1Tool, step2Tool],
        toolExecutor: executor,
      });

      expect(state.toolResults).toHaveLength(2);
      expect(state.toolResults[0]).toMatchObject({ toolName: 'step1', result: 'result-1' });
      expect(state.toolResults[1]).toMatchObject({ toolName: 'step2', result: 'result-2' });
      expect(state.messages[state.messages.length - 1].content).toBe('All done.');
    });
  });

  // 4. Tool error handling — executor throws
  describe('run() — tool error handling', () => {
    it('captures tool execution error in toolResults and continues', async () => {
      const toolCallResponse: AIMessage = {
        content: '',
        tool_calls: [{ name: 'boom', args: '{}', id: 'c-err' }],
      };
      const finalResponse: AIMessage = { content: 'Recovered.' };

      const runner = makeRunner([toolCallResponse, finalResponse]);
      const failingExecutor: ToolExecutor = async () => {
        throw new Error('tool exploded');
      };

      // register a dummy tool so it is "found" by the runner
      const boomTool = makeTool('boom', null);
      const state = await runner.run({
        input: 'Trigger error',
        tools: [boomTool],
        toolExecutor: failingExecutor,
      });

      expect(state.toolResults).toHaveLength(1);
      expect(state.toolResults[0].error).toBe('tool exploded');

      // Tool result message should carry the error text
      const toolMsg = state.messages.find((m) => m.role === 'tool');
      expect(toolMsg?.content).toBe('tool exploded');
    });
  });

  // 5. Max steps limit
  describe('run() — max steps', () => {
    it('terminates after maxSteps even when provider keeps returning tool calls', async () => {
      // Provide many tool-call responses (more than maxSteps)
      const toolCallResponse: AIMessage = {
        content: '',
        tool_calls: [{ name: 'loop', args: '{}', id: 'lc' }],
      };
      const manyResponses = Array.from({ length: 20 }, () => ({ ...toolCallResponse }));
      const runner = makeRunner(manyResponses);

      const loopTool = makeTool('loop', 'ok');
      const executor: ToolExecutor = async () => ({ result: 'ok' });

      const maxSteps = 3;
      const state = await runner.run({
        input: 'Loop forever',
        tools: [loopTool],
        toolExecutor: executor,
        maxSteps,
      });

      // stepCount increments once per LLM call; each call includes one tool result
      // So after maxSteps LLM invocations the loop must have exited
      const assistantMsgs = state.messages.filter((m) => m.role === 'assistant');
      expect(assistantMsgs.length).toBeLessThanOrEqual(maxSteps);
    });
  });

  // ---------------------------------------------------------------------------
  // concurrentTools — run() and stream()
  // ---------------------------------------------------------------------------

  describe('run() — concurrentTools', () => {
    it('executes two tool calls in the same turn concurrently and produces the same result as sequential', async () => {
      const twoToolCalls: AIMessage = {
        content: '',
        tool_calls: [
          { name: 'alpha', args: '{}', id: 'c-a' },
          { name: 'beta', args: '{}', id: 'c-b' },
        ],
      };
      const final: AIMessage = { content: 'Both done.' };

      const runner = makeRunner([twoToolCalls, final]);
      const alphaTool = makeTool('alpha', 'result-alpha');
      const betaTool = makeTool('beta', 'result-beta');

      const callOrder: string[] = [];
      const executor: ToolExecutor = async (toolName) => {
        callOrder.push(toolName);
        if (toolName === 'alpha') return { result: 'result-alpha' };
        if (toolName === 'beta') return { result: 'result-beta' };
        return { result: null };
      };

      const state = await runner.run({
        input: 'Run both',
        tools: [alphaTool, betaTool],
        toolExecutor: executor,
        concurrentTools: true,
      });

      // Both tool results present
      expect(state.toolResults).toHaveLength(2);
      expect(state.toolResults.find((r) => r.toolName === 'alpha')?.result).toBe('result-alpha');
      expect(state.toolResults.find((r) => r.toolName === 'beta')?.result).toBe('result-beta');

      // Messages: user → assistant (2 tool_calls) → tool alpha → tool beta → assistant final
      const roles = state.messages.map((m) => m.role);
      expect(roles).toEqual(['user', 'assistant', 'tool', 'tool', 'assistant']);
      expect(state.messages[state.messages.length - 1].content).toBe('Both done.');

      // Both tools were called
      expect(callOrder).toContain('alpha');
      expect(callOrder).toContain('beta');
    });

    it('captures errors from individual concurrent tool calls independently', async () => {
      const twoToolCalls: AIMessage = {
        content: '',
        tool_calls: [
          { name: 'good', args: '{}', id: 'c-good' },
          { name: 'bad', args: '{}', id: 'c-bad' },
        ],
      };
      const final: AIMessage = { content: 'Handled.' };

      const runner = makeRunner([twoToolCalls, final]);
      const goodTool = makeTool('good', 'ok');
      const badTool = makeTool('bad', null);

      const executor: ToolExecutor = async (toolName) => {
        if (toolName === 'good') return { result: 'ok' };
        throw new Error('bad tool exploded');
      };

      const state = await runner.run({
        input: 'Mix',
        tools: [goodTool, badTool],
        toolExecutor: executor,
        concurrentTools: true,
      });

      const goodResult = state.toolResults.find((r) => r.toolName === 'good');
      const badResult = state.toolResults.find((r) => r.toolName === 'bad');

      expect(goodResult?.result).toBe('ok');
      expect(goodResult?.error).toBeUndefined();
      expect(badResult?.error).toBe('bad tool exploded');
    });

    it('falls back to sequential when only one tool call is present', async () => {
      const oneToolCall: AIMessage = {
        content: '',
        tool_calls: [{ name: 'solo', args: '{}', id: 'c-solo' }],
      };
      const final: AIMessage = { content: 'Solo done.' };

      const runner = makeRunner([oneToolCall, final]);
      const soloTool = makeTool('solo', 'solo-result');
      const executor: ToolExecutor = async () => ({ result: 'solo-result' });

      const state = await runner.run({
        input: 'One tool',
        tools: [soloTool],
        toolExecutor: executor,
        concurrentTools: true,
      });

      expect(state.toolResults).toHaveLength(1);
      expect(state.toolResults[0].result).toBe('solo-result');
    });
  });

  describe('stream() — concurrentTools', () => {
    it('emits all tool_start events before any tool_result events when concurrent', async () => {
      const twoToolCalls: AIMessage = {
        content: '',
        tool_calls: [
          { name: 'fast', args: '{}', id: 'c-fast' },
          { name: 'slow', args: '{}', id: 'c-slow' },
        ],
      };
      const final: AIMessage = { content: 'Both streamed.' };

      const runner = makeRunner([twoToolCalls, final]);
      const fastTool = makeTool('fast', 'fast-result');
      const slowTool = makeTool('slow', 'slow-result');
      const executor: ToolExecutor = async (toolName) => {
        if (toolName === 'fast') return { result: 'fast-result' };
        // Simulate a slower tool with a tiny delay
        await new Promise((r) => setTimeout(r, 10));
        return { result: 'slow-result' };
      };

      const events = await collectStream(runner, {
        input: 'Run both',
        tools: [fastTool, slowTool],
        toolExecutor: executor,
        concurrentTools: true,
      });

      const toolEvents = events.filter(
        (e) => e.type === 'tool_start' || e.type === 'tool_result',
      );

      // First two events must both be tool_start
      expect(toolEvents[0].type).toBe('tool_start');
      expect(toolEvents[1].type).toBe('tool_start');
      // Next two must both be tool_result
      expect(toolEvents[2].type).toBe('tool_result');
      expect(toolEvents[3].type).toBe('tool_result');
    });

    it('tool_result events are in the same order as tool_start events (call order)', async () => {
      const twoToolCalls: AIMessage = {
        content: '',
        tool_calls: [
          { name: 'first', args: '{}', id: 'c-first' },
          { name: 'second', args: '{}', id: 'c-second' },
        ],
      };
      const final: AIMessage = { content: 'Ordered.' };

      const runner = makeRunner([twoToolCalls, final]);
      const firstTool = makeTool('first', 'r1');
      const secondTool = makeTool('second', 'r2');
      const executor: ToolExecutor = async (toolName) => {
        if (toolName === 'first') return { result: 'r1' };
        return { result: 'r2' };
      };

      const events = await collectStream(runner, {
        input: 'Order test',
        tools: [firstTool, secondTool],
        toolExecutor: executor,
        concurrentTools: true,
      });

      const starts = events.filter((e) => e.type === 'tool_start');
      const results = events.filter((e) => e.type === 'tool_result');

      expect(starts).toHaveLength(2);
      expect(results).toHaveLength(2);

      // starts: first, second
      if (starts[0].type === 'tool_start') expect(starts[0].name).toBe('first');
      if (starts[1].type === 'tool_start') expect(starts[1].name).toBe('second');

      // results: same order — first, second
      if (results[0].type === 'tool_result') {
        expect(results[0].name).toBe('first');
        expect(results[0].result).toBe('r1');
      }
      if (results[1].type === 'tool_result') {
        expect(results[1].name).toBe('second');
        expect(results[1].result).toBe('r2');
      }
    });

    it('concurrent and sequential produce the same final done.messages', async () => {
      const twoToolCalls: AIMessage = {
        content: '',
        tool_calls: [
          { name: 'ta', args: '{}', id: 'id-a' },
          { name: 'tb', args: '{}', id: 'id-b' },
        ],
      };
      const final: AIMessage = { content: 'Same result.' };

      const executor: ToolExecutor = async (toolName) => ({
        result: toolName === 'ta' ? 'ra' : 'rb',
      });
      const tools = [makeTool('ta', 'ra'), makeTool('tb', 'rb')];

      const runnerSeq = makeRunner([{ ...twoToolCalls, tool_calls: [...(twoToolCalls.tool_calls ?? [])] }, { ...final }]);
      const runnerCon = makeRunner([{ ...twoToolCalls, tool_calls: [...(twoToolCalls.tool_calls ?? [])] }, { ...final }]);

      const seqEvents = await collectStream(runnerSeq, { input: 'x', tools, toolExecutor: executor, concurrentTools: false });
      const conEvents = await collectStream(runnerCon, { input: 'x', tools, toolExecutor: executor, concurrentTools: true });

      const seqDone = seqEvents.find((e) => e.type === 'done');
      const conDone = conEvents.find((e) => e.type === 'done');

      expect(seqDone?.type).toBe('done');
      expect(conDone?.type).toBe('done');

      if (seqDone?.type === 'done' && conDone?.type === 'done') {
        // Same number of messages
        expect(conDone.messages.length).toBe(seqDone.messages.length);
        // Same roles in same order
        expect(conDone.messages.map((m) => m.role)).toEqual(seqDone.messages.map((m) => m.role));
        // Same tool result contents
        const seqToolMsgs = seqDone.messages.filter((m) => m.role === 'tool');
        const conToolMsgs = conDone.messages.filter((m) => m.role === 'tool');
        expect(conToolMsgs.map((m) => m.toolName)).toEqual(seqToolMsgs.map((m) => m.toolName));
        expect(conToolMsgs.map((m) => m.content)).toEqual(seqToolMsgs.map((m) => m.content));
      }
    });
  });


  describe('stream() — token-level StreamEvent API', () => {
    it('yields token event then done event for simple text reply', async () => {
      const runner = makeRunner([{ content: 'Streamed reply' }]);

      const events = await collectStream(runner, {
        input: 'Stream this',
        tools: noTools,
        toolExecutor: noopExecutor,
      });

      const tokenEvents = events.filter((e) => e.type === 'token');
      const doneEvents = events.filter((e) => e.type === 'done');

      expect(tokenEvents.length).toBeGreaterThan(0);
      expect(tokenEvents[0]).toMatchObject({ type: 'token', content: 'Streamed reply' });
      expect(doneEvents).toHaveLength(1);
      expect(doneEvents[0].type).toBe('done');
    });

    it('done event carries final messages array', async () => {
      const runner = makeRunner([{ content: 'Final answer' }]);

      const events = await collectStream(runner, {
        input: 'Answer me',
        tools: noTools,
        toolExecutor: noopExecutor,
      });

      const done = events.find((e) => e.type === 'done');
      expect(done).toBeDefined();
      if (done?.type === 'done') {
        const roles = done.messages.map((m) => m.role);
        expect(roles).toContain('user');
        expect(roles).toContain('assistant');
      }
    });

    it('yields tool_start and tool_result events around tool execution', async () => {
      const toolCallResponse: AIMessage = {
        content: '',
        tool_calls: [{ name: 'ping', args: JSON.stringify({}), id: 'tc-1' }],
      };
      const finalResponse: AIMessage = { content: 'Pong done.' };

      const runner = makeRunner([toolCallResponse, finalResponse]);
      const pingTool = makeTool('ping', 'pong');
      const executor: ToolExecutor = async (toolName) => {
        if (toolName === 'ping') return { result: 'pong' };
        return { result: null };
      };

      const events = await collectStream(runner, {
        input: 'Ping',
        tools: [pingTool],
        toolExecutor: executor,
      });

      const toolStart = events.find((e) => e.type === 'tool_start');
      const toolResult = events.find((e) => e.type === 'tool_result');

      expect(toolStart).toBeDefined();
      if (toolStart?.type === 'tool_start') {
        expect(toolStart.name).toBe('ping');
      }

      expect(toolResult).toBeDefined();
      if (toolResult?.type === 'tool_result') {
        expect(toolResult.name).toBe('ping');
        expect(toolResult.result).toBe('pong');
        expect(toolResult.error).toBeUndefined();
      }
    });

    it('yields error event when provider fails', async () => {
      // Empty queue — MockProvider throws on first stream() call
      const runner = makeRunner([]);

      const events = await collectStream(runner, {
        input: 'Fail me',
        tools: noTools,
        toolExecutor: noopExecutor,
      });

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      if (errorEvent?.type === 'error') {
        expect(errorEvent.message).toContain('no more responses');
      }
    });

    it('supports history option — does not prepend extra user message', async () => {
      const runner = makeRunner([{ content: 'History reply' }]);

      const events = await collectStream(runner, {
        input: 'ignored',
        tools: noTools,
        toolExecutor: noopExecutor,
        history: [
          { role: 'user', content: 'Previous question', },
          { role: 'assistant', content: 'Previous answer', },
          { role: 'user', content: 'New question', },
        ],
      });

      const done = events.find((e) => e.type === 'done');
      expect(done).toBeDefined();
      if (done?.type === 'done') {
        // History had 3 messages + 1 assistant response = 4
        expect(done.messages).toHaveLength(4);
        expect(done.messages[0]).toMatchObject({ role: 'user', content: 'Previous question' });
      }
    });
  });
});
