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
  // stream() tests — new token-level StreamEvent API
  // ---------------------------------------------------------------------------

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
