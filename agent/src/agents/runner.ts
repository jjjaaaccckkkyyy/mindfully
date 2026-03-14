/**
 * AgentRunner — LangGraph-backed ReAct agent runner.
 *
 * Uses a StateGraph (call_model → execute_tools loop) built from the new
 * LLMChain (createLLMChain) provider factory.
 *
 * The public API surface is intentionally kept identical to the old runner:
 *   - run(options)    → Promise<AgentState>
 *   - stream(options) → AsyncGenerator<StreamEvent>
 *   - getCostInfo()   → CostEntry | undefined
 *   - getTotalCost()  → number
 *
 * StreamEvent types are unchanged so server/src/sse/agent-stream.ts compiles
 * without modification.
 */
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import type { Tool } from 'core';
import { createLogger } from 'core';
import {
  createLLMChain,
  type LLMChain,
  type LLMChainConfig,
  type CostEntry,
} from './providers/index.js';
import { buildAgentGraph } from './graph/index.js';

const logger = createLogger('agent:runner');

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tool_calls?: Array<{
    name: string;
    args: Record<string, unknown>;
    id?: string;
  }>;
  toolCallId?: string;
  toolName?: string;
}

export interface AgentState {
  messages: AgentMessage[];
  input: string;
  toolResults: ToolCallResult[];
  error?: string;
  cost?: CostEntry;
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
  /** Pre-built message history (e.g. from ContextManager). If provided, the
   *  input string is NOT prepended as an extra user message — callers are
   *  responsible for including it in the history. */
  history?: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: Array<{ name: string; args: Record<string, unknown>; id?: string }>;
    toolCallId?: string;
    toolName?: string;
  }>;
}

export interface AgentRunnerConfig {
  maxSteps?: number;
  llmChain?: LLMChain;
  llmChainConfig?: LLMChainConfig;
}

// ─── StreamEvent types (unchanged from old runner) ────────────────────────────

export interface StreamTokenEvent {
  type: 'token';
  content: string;
}

export interface StreamToolStartEvent {
  type: 'tool_start';
  name: string;
  args: Record<string, unknown>;
  id?: string;
}

export interface StreamToolResultEvent {
  type: 'tool_result';
  name: string;
  result: unknown;
  error?: string;
  id?: string;
}

export interface StreamDoneEvent {
  type: 'done';
  messages: AgentMessage[];
  cost?: CostEntry;
}

export interface StreamErrorEvent {
  type: 'error';
  message: string;
}

export type StreamEvent =
  | StreamTokenEvent
  | StreamToolStartEvent
  | StreamToolResultEvent
  | StreamDoneEvent
  | StreamErrorEvent;

// ─── Conversion helpers ───────────────────────────────────────────────────────

/**
 * Convert a history entry (plain object) into a LangChain BaseMessage.
 */
function historyEntryToBaseMessage(entry: {
  role: string;
  content: string;
  tool_calls?: Array<{ name: string; args: Record<string, unknown>; id?: string }>;
  toolCallId?: string;
  toolName?: string;
}): BaseMessage {
  switch (entry.role) {
    case 'system':
      return new SystemMessage(entry.content);
    case 'user':
      return new HumanMessage(entry.content);
    case 'assistant': {
      const msg = new AIMessage({ content: entry.content });
      if (entry.tool_calls && entry.tool_calls.length > 0) {
        // Attach tool_calls to the AIMessage
        (msg as AIMessage).tool_calls = entry.tool_calls.map((tc) => ({
          name: tc.name,
          args: tc.args,
          id: tc.id ?? tc.name,
          type: 'tool_call' as const,
        }));
      }
      return msg;
    }
    case 'tool':
      return new ToolMessage({
        content: entry.content,
        tool_call_id: entry.toolCallId ?? entry.toolName ?? 'unknown',
        name: entry.toolName,
      });
    default:
      return new HumanMessage(entry.content);
  }
}

/**
 * Convert a LangChain BaseMessage back to our AgentMessage shape.
 */
function baseMessageToAgentMessage(msg: BaseMessage): AgentMessage {
  if (msg instanceof SystemMessage) {
    return { role: 'system', content: String(msg.content) };
  }
  if (msg instanceof HumanMessage) {
    return { role: 'user', content: String(msg.content) };
  }
  if (msg instanceof AIMessage) {
    const toolCalls =
      msg.tool_calls && msg.tool_calls.length > 0
        ? msg.tool_calls.map((tc) => ({
            name: tc.name,
            args: tc.args as Record<string, unknown>,
            id: tc.id,
          }))
        : undefined;
    return {
      role: 'assistant',
      content: String(msg.content),
      ...(toolCalls ? { tool_calls: toolCalls } : {}),
    };
  }
  if (msg instanceof ToolMessage) {
    return {
      role: 'tool',
      content: String(msg.content),
      toolCallId: msg.tool_call_id,
      toolName: msg.name ?? undefined,
    };
  }
  return { role: 'user', content: String(msg.content) };
}

// ─── AgentRunner ──────────────────────────────────────────────────────────────

export class AgentRunner {
  private maxSteps: number;
  private llmChain: LLMChain;

  constructor(config: AgentRunnerConfig = {}) {
    this.maxSteps = config.maxSteps ?? 50;
    this.llmChain =
      config.llmChain ??
      createLLMChain(config.llmChainConfig);
  }

  // ─── run() ─────────────────────────────────────────────────────────────────

  async run(options: AgentRunOptions): Promise<AgentState> {
    const maxSteps = options.maxSteps ?? this.maxSteps;

    const initialMessages: BaseMessage[] = options.history
      ? options.history.map(historyEntryToBaseMessage)
      : [new HumanMessage(options.input)];

    const toolResults: ToolCallResult[] = [];
    let error: string | undefined;

    const toolExecutorWrapper = async (
      toolName: string,
      args: Record<string, unknown>,
    ): Promise<{ result: unknown; error?: string }> => {
      const res = await options.toolExecutor(toolName, args);
      toolResults.push({
        toolName,
        result: res.result,
        error: res.error,
      });
      return res;
    };

    const graph = buildAgentGraph({
      runnable: this.llmChain.runnable,
      toolExecutor: toolExecutorWrapper,
    });

    logger.debug('AgentRunner.run started', {
      input: options.input,
      toolCount: options.tools.length,
      maxSteps,
    });

    let finalMessages: BaseMessage[] = initialMessages;

    try {
      const result = await graph.invoke(
        { messages: initialMessages, input: options.input },
        { recursionLimit: maxSteps * 2 },
      );
      finalMessages = result.messages as BaseMessage[];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Agent graph execution failed';
      logger.warn(`AgentRunner.run failed: ${error}`);
    }

    const cost = this.getCostInfo();

    return {
      messages: finalMessages.map(baseMessageToAgentMessage),
      input: options.input,
      toolResults,
      error,
      cost,
    };
  }

  // ─── stream() ──────────────────────────────────────────────────────────────

  /**
   * Token-level streaming generator using LangGraph streamEvents().
   *
   * Yields:
   *   - `{ type: 'token', content }` for each text token chunk from the LLM
   *   - `{ type: 'tool_start', name, args, id }` before executing a tool
   *   - `{ type: 'tool_result', name, result, error?, id }` after executing a tool
   *   - `{ type: 'done', messages, cost? }` when the agent finishes
   *   - `{ type: 'error', message }` on fatal error
   */
  async *stream(options: AgentRunOptions): AsyncGenerator<StreamEvent> {
    const maxSteps = options.maxSteps ?? this.maxSteps;

    const initialMessages: BaseMessage[] = options.history
      ? options.history.map(historyEntryToBaseMessage)
      : [new HumanMessage(options.input)];

    // Track pending tool calls so we can match them to their ToolMessage results.
    const pendingToolCalls = new Map<
      string,
      { name: string; args: Record<string, unknown>; id?: string }
    >();

    const graph = buildAgentGraph({
      runnable: this.llmChain.runnable,
      toolExecutor: options.toolExecutor,
    });

    logger.debug('AgentRunner.stream started', {
      input: options.input,
      toolCount: options.tools.length,
      maxSteps,
    });

    let finalMessages: BaseMessage[] = initialMessages;

    try {
      // Stream events from the graph
      for await (const event of graph.streamEvents(
        { messages: initialMessages, input: options.input },
        {
          version: 'v2',
          recursionLimit: maxSteps * 2,
        },
      )) {
        const { event: eventType, name, data } = event;

        // Token chunks from the LLM node
        if (eventType === 'on_chat_model_stream' && name !== 'execute_tools') {
          const chunk = data?.chunk;
          if (chunk?.content && typeof chunk.content === 'string' && chunk.content.length > 0) {
            yield { type: 'token', content: chunk.content };
          }
        }

        // Tool call start — from execute_tools node starting
        if (eventType === 'on_chain_start' && name === 'execute_tools') {
          const messages = (data?.input?.messages ?? []) as BaseMessage[];
          const lastMsg = messages[messages.length - 1];
          if (lastMsg instanceof AIMessage && lastMsg.tool_calls) {
            for (const tc of lastMsg.tool_calls) {
              const toolId = tc.id ?? tc.name;
              const args = tc.args as Record<string, unknown>;
              pendingToolCalls.set(toolId, { name: tc.name, args, id: tc.id });
              yield { type: 'tool_start', name: tc.name, args, id: tc.id };
            }
          }
        }

        // Tool execution result — from execute_tools node ending.
        // Whether the tool succeeded or failed is determined by reading the
        // ToolMessage content: nodes.ts wraps errors as plain strings, so we
        // surface them here by checking if the matched pending call has an
        // error-shaped result. Since the ToolMessage content IS the result
        // string (or error string), we emit it as result unconditionally and
        // let the caller inspect event.error if they need to distinguish.
        if (eventType === 'on_chain_end' && name === 'execute_tools') {
          const outputMessages = (data?.output?.messages ?? []) as BaseMessage[];
          for (const msg of outputMessages) {
            if (msg instanceof ToolMessage) {
              const toolId = msg.tool_call_id;
              const pendingCall = pendingToolCalls.get(toolId);
              const resultContent = String(msg.content);

              if (pendingCall) {
                yield {
                  type: 'tool_result',
                  name: pendingCall.name,
                  result: resultContent,
                  id: pendingCall.id,
                };
                pendingToolCalls.delete(toolId);
              } else {
                // Tool result without a matching pending call — still emit
                yield {
                  type: 'tool_result',
                  name: msg.name ?? 'unknown',
                  result: resultContent,
                  id: msg.tool_call_id,
                };
              }
            }
          }
        }

        // Graph end — final state
        if (eventType === 'on_chain_end' && name === '__end__') {
          const messages = (data?.output?.messages ?? []) as BaseMessage[];
          if (messages.length > 0) {
            finalMessages = messages;
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Agent graph stream failed';
      logger.warn(`AgentRunner.stream failed: ${message}`);
      yield { type: 'error', message };
      return;
    }

    const cost = this.getCostInfo();
    logger.debug('AgentRunner.stream completed', {
      messageCount: finalMessages.length,
      totalCost: cost?.totalCost,
    });

    yield {
      type: 'done',
      messages: finalMessages.map(baseMessageToAgentMessage),
      cost,
    };
  }

  // ─── Cost helpers ─────────────────────────────────────────────────────────

  getCostInfo(): CostEntry | undefined {
    const history = this.llmChain.getCostHistory();
    if (history.length === 0) return undefined;
    return history[history.length - 1];
  }

  getTotalCost(): number {
    return this.llmChain.getTotalCost();
  }
}

export function createAgentRunner(config?: AgentRunnerConfig): AgentRunner {
  return new AgentRunner(config);
}
