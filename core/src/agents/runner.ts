import { z } from 'zod';
import { createProviderChain, type ProviderChain, type CostInfo } from './providers/index.js';
import type { Tool } from '../tools/index.js';

export interface AgentState {
  messages: AgentMessage[];
  input: string;
  toolResults: ToolCallResult[];
  error?: string;
  cost?: CostInfo;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    name: string;
    args: Record<string, unknown>;
    id?: string;
  }>;
  toolCallId?: string;
  toolName?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
}

export interface ToolCallResult {
  toolName: string;
  result: unknown;
  error?: string;
  toolCallId?: string;
}

export interface ToolExecutor {
  (toolName: string, args: Record<string, unknown>): Promise<{ result: unknown; error?: string }>;
}

export interface AgentRunOptions {
  input: string;
  tools: Tool[];
  toolExecutor: ToolExecutor;
  maxSteps?: number;
}

export interface AgentRunnerConfig {
  maxSteps?: number;
  providerChain?: ProviderChain;
}

export class AgentRunner {
  private maxSteps: number;
  private providerChain: ProviderChain;

  constructor(config: AgentRunnerConfig = {}) {
    this.maxSteps = config.maxSteps || 50;
    this.providerChain = config.providerChain || createProviderChain();
  }

  async run(options: AgentRunOptions): Promise<AgentState> {
    const maxSteps = options.maxSteps || this.maxSteps;
    const state: AgentState = {
      messages: [{ role: 'user', content: options.input }],
      input: options.input,
      toolResults: [],
    };

    let stepCount = 0;

    while (stepCount < maxSteps) {
      const messages = state.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let response;
      try {
        response = await this.providerChain.invoke(messages);
      } catch (err) {
        state.error = err instanceof Error ? err.message : 'LLM invocation failed';
        break;
      }

      const content = response.content || '';
      
      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content,
      };

      state.messages.push(assistantMessage);
      stepCount++;

      if (!content.trim()) {
        break;
      }

      const hasToolCalls = assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0;
      if (!hasToolCalls) {
        break;
      }

      for (const call of assistantMessage.tool_calls || []) {
        const tool = options.tools.find((t) => t.name === call.name);

        let result: unknown;
        let error: string | undefined;

        if (!tool) {
          error = `Tool "${call.name}" not found`;
        } else {
          try {
            const execResult = await options.toolExecutor(call.name, call.args);
            result = execResult.result;
            error = execResult.error;
          } catch (e) {
            error = e instanceof Error ? e.message : 'Tool execution failed';
          }
        }

        state.toolResults.push({
          toolName: call.name,
          result,
          error,
          toolCallId: call.id,
        });

        state.messages.push({
          role: 'tool',
          content: error || JSON.stringify(result),
          toolName: call.name,
          toolCallId: call.id,
        });
      }
    }

    return state;
  }

  async *stream(options: AgentRunOptions): AsyncGenerator<AgentState> {
    const maxSteps = options.maxSteps || this.maxSteps;
    const state: AgentState = {
      messages: [{ role: 'user', content: options.input }],
      input: options.input,
      toolResults: [],
    };

    yield state;

    let stepCount = 0;

    while (stepCount < maxSteps) {
      const messages = state.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let response;
      try {
        response = await this.providerChain.invoke(messages);
      } catch (err) {
        state.error = err instanceof Error ? err.message : 'LLM invocation failed';
        yield state;
        break;
      }

      const content = response.content || '';
      
      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content,
      };

      state.messages.push(assistantMessage);
      stepCount++;

      if (!content.trim()) {
        yield state;
        break;
      }

      const hasToolCalls = assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0;
      if (!hasToolCalls) {
        yield state;
        break;
      }

      for (const call of assistantMessage.tool_calls || []) {
        const tool = options.tools.find((t) => t.name === call.name);

        let result: unknown;
        let error: string | undefined;

        if (!tool) {
          error = `Tool "${call.name}" not found`;
        } else {
          try {
            const execResult = await options.toolExecutor(call.name, call.args);
            result = execResult.result;
            error = execResult.error;
          } catch (e) {
            error = e instanceof Error ? e.message : 'Tool execution failed';
          }
        }

        state.toolResults.push({
          toolName: call.name,
          result,
          error,
          toolCallId: call.id,
        });

        state.messages.push({
          role: 'tool',
          content: error || JSON.stringify(result),
          toolName: call.name,
          toolCallId: call.id,
        });
      }

      yield state;
    }
  }

  getCostInfo(): CostInfo | undefined {
    const history = this.providerChain.getCostHistory();
    if (history.length === 0) return undefined;
    return history[history.length - 1];
  }

  getTotalCost(): number {
    return this.providerChain.getTotalCost();
  }
}

export function createAgentRunner(config?: AgentRunnerConfig): AgentRunner {
  return new AgentRunner(config);
}
