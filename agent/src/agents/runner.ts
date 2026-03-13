import { z } from 'zod';
import { createProviderChain, type ProviderChain, type CostInfo, type ToolSchema } from './providers/index.js';
import type { Tool } from 'core';
import { createLogger } from 'core';

const logger = createLogger('agent:runner');

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
  providerChain?: ProviderChain;
}

// ─── Token-level stream event types ──────────────────────────────────────────

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
  cost?: CostInfo;
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

// ─── AgentRunner ──────────────────────────────────────────────────────────────

export class AgentRunner {
  private maxSteps: number;
  private providerChain: ProviderChain;

  constructor(config: AgentRunnerConfig = {}) {
    this.maxSteps = config.maxSteps || 50;
    this.providerChain = config.providerChain || createProviderChain();
  }

  async run(options: AgentRunOptions): Promise<AgentState> {
    const maxSteps = options.maxSteps || this.maxSteps;
    const initialMessages: AgentMessage[] = options.history
      ? options.history.map((m) => ({
          role: m.role as AgentMessage['role'],
          content: m.content,
          ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
          ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
          ...(m.toolName ? { toolName: m.toolName } : {}),
        }))
      : [{ role: 'user', content: options.input }];

    const state: AgentState = {
      messages: initialMessages,
      input: options.input,
      toolResults: [],
    };

    const toolSchemas = toToolSchemas(options.tools);
    let stepCount = 0;

    logger.debug(`AgentRunner.run started`, { input: options.input, toolCount: options.tools.length, maxSteps });

    while (stepCount < maxSteps) {
      const messages = state.messages.map((m) => ({
        role: m.role,
        content: m.content,
        toolCallId: m.toolCallId,
        toolName: m.toolName,
      }));

      let response;
      try {
        response = await this.providerChain.invoke(messages, toolSchemas);
      } catch (err) {
        state.error = err instanceof Error ? err.message : 'LLM invocation failed';
        logger.warn(`AgentRunner LLM invocation failed at step ${stepCount}: ${state.error}`);
        break;
      }

      const content = response.content || '';

      // Map tool_calls from AIMessage (args: string) → AgentMessage (args: Record)
      const toolCalls = response.tool_calls?.map((tc) => ({
        name: tc.name,
        args: (() => {
          try {
            return JSON.parse(tc.args) as Record<string, unknown>;
          } catch {
            return {} as Record<string, unknown>;
          }
        })(),
        id: tc.id,
      }));

      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content,
        ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      };

      state.messages.push(assistantMessage);
      stepCount++;

      const hasToolCalls = assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0;

      if (!hasToolCalls) {
        logger.debug(`AgentRunner.run completed at step ${stepCount}`);
        break;
      }

      for (const call of assistantMessage.tool_calls || []) {
        const tool = options.tools.find((t) => t.name === call.name);

        let result: unknown;
        let error: string | undefined;

        if (!tool) {
          error = `Tool "${call.name}" not found`;
          logger.warn(`AgentRunner: tool not found: ${call.name}`);
        } else {
          logger.debug(`AgentRunner: executing tool "${call.name}"`, { args: call.args });
          try {
            const execResult = await options.toolExecutor(call.name, call.args);
            result = execResult.result;
            error = execResult.error;
            if (error) {
              logger.warn(`AgentRunner: tool "${call.name}" returned error: ${error}`);
            }
          } catch (e) {
            error = e instanceof Error ? e.message : 'Tool execution failed';
            logger.warn(`AgentRunner: tool "${call.name}" threw: ${error}`);
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

  /**
   * Token-level streaming generator.
   *
   * Yields:
   *   - `{ type: 'token', content }` for each text token chunk from the LLM
   *   - `{ type: 'tool_start', name, args, id }` before executing a tool
   *   - `{ type: 'tool_result', name, result, error?, id }` after executing a tool
   *   - `{ type: 'done', messages, cost? }` when the agent finishes
   *   - `{ type: 'error', message }` on fatal error (after which no more events)
   */
  async *stream(options: AgentRunOptions): AsyncGenerator<StreamEvent> {
    const maxSteps = options.maxSteps || this.maxSteps;
    const messages: AgentMessage[] = options.history
      ? options.history.map((m) => ({
          role: m.role as AgentMessage['role'],
          content: m.content,
          ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
          ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
          ...(m.toolName ? { toolName: m.toolName } : {}),
        }))
      : [{ role: 'user', content: options.input }];

    const toolSchemas = toToolSchemas(options.tools);
    let stepCount = 0;

    logger.debug(`AgentRunner.stream started`, {
      input: options.input,
      toolCount: options.tools.length,
      maxSteps,
    });

    while (stepCount < maxSteps) {
      const providerMessages = messages.map((m) => ({
        role: m.role,
        content: m.content,
        tool_calls: m.tool_calls,
        toolCallId: m.toolCallId,
        toolName: m.toolName,
      }));

      // Accumulate tokens + tool calls for this turn
      let turnContent = '';
      const toolCallAccum: Record<
        string,
        { name: string; args: Record<string, unknown>; id?: string }
      > = {};

      try {
        for await (const chunk of this.providerChain.stream(providerMessages, toolSchemas)) {
          // Text token
          if (chunk.content) {
            turnContent += chunk.content;
            yield { type: 'token', content: chunk.content };
          }

          // Tool call chunk — accumulate
          if (chunk.tool_calls) {
            for (const tc of chunk.tool_calls) {
              const key = tc.id || tc.name;
              if (!toolCallAccum[key]) {
                let parsedArgs: Record<string, unknown>;
                try {
                  parsedArgs = JSON.parse(tc.args) as Record<string, unknown>;
                } catch {
                  parsedArgs = {};
                }
                toolCallAccum[key] = { name: tc.name, args: parsedArgs, id: tc.id };
              } else {
                // Merge streaming args fragments
                try {
                  const merged = JSON.parse(tc.args) as Record<string, unknown>;
                  Object.assign(toolCallAccum[key].args, merged);
                } catch {
                  // partial fragment — ignore
                }
              }
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'LLM stream failed';
        logger.warn(`AgentRunner.stream LLM failed at step ${stepCount}: ${message}`);
        yield { type: 'error', message };
        return;
      }

      const toolCalls = Object.values(toolCallAccum);
      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content: turnContent,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      };

      messages.push(assistantMessage);
      stepCount++;

      if (toolCalls.length === 0) {
        // Final text-only response
        const cost = this.getCostInfo();
        logger.debug(`AgentRunner.stream completed`, {
          steps: stepCount,
          messages: messages.length,
          totalCost: cost?.totalCost,
        });
        yield { type: 'done', messages, cost };
        return;
      }

      // Execute tools
      for (const call of toolCalls) {
        const tool = options.tools.find((t) => t.name === call.name);

        logger.debug(`AgentRunner.stream: tool_start "${call.name}"`, { args: call.args });
        yield { type: 'tool_start', name: call.name, args: call.args, id: call.id };

        let result: unknown;
        let error: string | undefined;

        if (!tool) {
          error = `Tool "${call.name}" not found`;
          logger.warn(`AgentRunner.stream: tool not found: ${call.name}`);
        } else {
          try {
            const execResult = await options.toolExecutor(call.name, call.args);
            result = execResult.result;
            error = execResult.error;
            if (error) {
              logger.warn(`AgentRunner.stream: tool "${call.name}" returned error`, { error });
            } else {
              const preview = truncate(JSON.stringify(result), 200);
              logger.debug(`AgentRunner.stream: tool_result "${call.name}"`, { result: preview });
            }
          } catch (e) {
            error = e instanceof Error ? e.message : 'Tool execution failed';
            logger.warn(`AgentRunner.stream: tool "${call.name}" threw`, { error });
          }
        }

        yield { type: 'tool_result', name: call.name, result, error, id: call.id };

        messages.push({
          role: 'tool',
          content: error || JSON.stringify(result),
          toolName: call.name,
          toolCallId: call.id,
        });
      }
    }

    // Hit maxSteps
    logger.warn(`AgentRunner.stream hit maxSteps (${maxSteps})`);
    const cost = this.getCostInfo();
    yield { type: 'done', messages, cost };
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

/** Truncate a string to at most `maxLen` chars, appending '…' if cut. */
function truncate(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen) + '…';
}

/**
 * Convert our Tool[] (with Zod schemas) into the ToolSchema[] the provider
 * expects (JSON Schema parameters object).
 */
function toToolSchemas(tools: Tool[]): ToolSchema[] {
  return tools.map((tool) => {
    // zodToJsonSchema would be ideal, but to avoid the extra dep we call
    // zod's built-in _def walking via a minimal inline converter.
    let parameters: Record<string, unknown>;
    try {
      // If the schema is a ZodObject, extract its shape as JSON Schema
      const zodSchema = tool.inputSchema as z.ZodObject<z.ZodRawShape>;
      if (zodSchema._def?.typeName === 'ZodObject') {
        const shape = zodSchema.shape as Record<string, z.ZodTypeAny>;
        const props: Record<string, unknown> = {};
        const required: string[] = [];
        for (const [key, val] of Object.entries(shape)) {
          props[key] = zodTypeToJsonSchema(val);
          if (!isOptionalOrDefault(val)) required.push(key);
        }
        parameters = {
          type: 'object',
          properties: props,
          ...(required.length > 0 ? { required } : {}),
        };
      } else {
        parameters = { type: 'object', properties: {} };
      }
    } catch {
      parameters = { type: 'object', properties: {} };
    }
    return { name: tool.name, description: tool.description, parameters };
  });
}

/** Returns true if the field is optional or has a default (i.e. not required). */
function isOptionalOrDefault(schema: z.ZodTypeAny): boolean {
  return schema instanceof z.ZodOptional || schema instanceof z.ZodDefault;
}

function zodTypeToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // Unwrap transparent wrappers
  if (schema instanceof z.ZodOptional) return zodTypeToJsonSchema(schema.unwrap());
  if (schema instanceof z.ZodDefault) return zodTypeToJsonSchema(schema._def.innerType);
  if (schema instanceof z.ZodNullable) {
    const inner = zodTypeToJsonSchema(schema.unwrap());
    return { ...inner, nullable: true };
  }

  if (schema instanceof z.ZodString) {
    const result: Record<string, unknown> = { type: 'string' };
    if (schema.description) result.description = schema.description;
    return result;
  }
  if (schema instanceof z.ZodNumber) {
    const result: Record<string, unknown> = { type: 'number' };
    if (schema.description) result.description = schema.description;
    return result;
  }
  if (schema instanceof z.ZodBoolean) {
    const result: Record<string, unknown> = { type: 'boolean' };
    if (schema.description) result.description = schema.description;
    return result;
  }
  if (schema instanceof z.ZodLiteral) {
    const val = schema._def.value;
    const type = typeof val === 'number' ? 'number' : typeof val === 'boolean' ? 'boolean' : 'string';
    return { type, const: val };
  }
  if (schema instanceof z.ZodArray) {
    return { type: 'array', items: zodTypeToJsonSchema(schema.element) };
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const props: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(shape)) {
      props[k] = zodTypeToJsonSchema(v);
      if (!isOptionalOrDefault(v)) required.push(k);
    }
    return { type: 'object', properties: props, ...(required.length > 0 ? { required } : {}) };
  }
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: schema.options };
  if (schema instanceof z.ZodUnion) {
    const options = schema._def.options as z.ZodTypeAny[];
    return { oneOf: options.map(zodTypeToJsonSchema) };
  }
  if (schema instanceof z.ZodDiscriminatedUnion) {
    const options = Array.from(
      (schema._def.optionsMap as Map<unknown, z.ZodTypeAny>).values(),
    );
    return { oneOf: options.map(zodTypeToJsonSchema) };
  }
  return {};
}

