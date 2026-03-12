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
        // No tool calls — treat this as the final response and stop
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

  async *stream(options: AgentRunOptions): AsyncGenerator<AgentState> {
    const maxSteps = options.maxSteps || this.maxSteps;
    const state: AgentState = {
      messages: [{ role: 'user', content: options.input }],
      input: options.input,
      toolResults: [],
    };

    yield state;

    const toolSchemas = toToolSchemas(options.tools);
    let stepCount = 0;

    logger.debug(`AgentRunner.stream started`, { input: options.input, toolCount: options.tools.length, maxSteps });

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
        logger.warn(`AgentRunner.stream LLM invocation failed at step ${stepCount}: ${state.error}`);
        yield state;
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
        logger.debug(`AgentRunner.stream completed at step ${stepCount}`);
        yield state;
        break;
      }

      for (const call of assistantMessage.tool_calls || []) {
        const tool = options.tools.find((t) => t.name === call.name);

        let result: unknown;
        let error: string | undefined;

        if (!tool) {
          error = `Tool "${call.name}" not found`;
          logger.warn(`AgentRunner.stream: tool not found: ${call.name}`);
        } else {
          logger.debug(`AgentRunner.stream: executing tool "${call.name}"`, { args: call.args });
          try {
            const execResult = await options.toolExecutor(call.name, call.args);
            result = execResult.result;
            error = execResult.error;
            if (error) {
              logger.warn(`AgentRunner.stream: tool "${call.name}" returned error: ${error}`);
            }
          } catch (e) {
            error = e instanceof Error ? e.message : 'Tool execution failed';
            logger.warn(`AgentRunner.stream: tool "${call.name}" threw: ${error}`);
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
  // Unwrap Optional and Default wrappers transparently
  if (schema instanceof z.ZodOptional) return zodTypeToJsonSchema(schema.unwrap());
  if (schema instanceof z.ZodDefault) return zodTypeToJsonSchema(schema._def.innerType);
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
  if (schema instanceof z.ZodArray) return { type: 'array', items: zodTypeToJsonSchema(schema.element) };
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(shape)) props[k] = zodTypeToJsonSchema(v);
    return { type: 'object', properties: props };
  }
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: schema.options };
  return {};
}
