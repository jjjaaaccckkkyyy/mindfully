import { describe, it, expect, vi } from 'vitest';
import { AgentRunner } from '../agents/runner.js';
import { ProviderChain } from '../agents/providers/chain.js';
import type { LLMProvider, Message, AIMessage, CostInfo, LLMConfig } from '../agents/providers/base.js';
import type { Tool } from '../tools/index.js';
import type { ToolExecutor } from '../agents/runner.js';

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

// ---------------------------------------------------------------------------
// Tests
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

  // 6. stream() method
  describe('stream() — yields states progressively', () => {
    it('yields initial state first, then state after each LLM step', async () => {
      const runner = makeRunner([{ content: 'Streamed reply' }]);

      const states = [];
      for await (const state of runner.stream({
        input: 'Stream this',
        tools: noTools,
        toolExecutor: noopExecutor,
      })) {
        states.push({
          messageCount: state.messages.length,
          lastRole: state.messages[state.messages.length - 1]?.role,
        });
      }

      // First yield: only user message
      expect(states[0]).toMatchObject({ messageCount: 1, lastRole: 'user' });

      // Final yield: user + assistant
      const last = states[states.length - 1];
      expect(last.messageCount).toBe(2);
      expect(last.lastRole).toBe('assistant');
    });

    it('yields error state when provider fails', async () => {
      // Give an empty queue so MockProvider throws on first invoke
      const runner = makeRunner([]);

      const states = [];
      for await (const state of runner.stream({
        input: 'Fail me',
        tools: noTools,
        toolExecutor: noopExecutor,
      })) {
        states.push(state);
      }

      const errorState = states.find((s) => s.error);
      expect(errorState).toBeDefined();
      expect(errorState?.error).toContain('no more responses');
    });
  });
});
