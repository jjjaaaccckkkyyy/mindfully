/**
 * LangGraph node implementations for the ReAct agent loop.
 *
 * Nodes:
 *  - callModel:    invoke the LLM runnable with current messages
 *  - executeTools: execute all tool_calls in the last AIMessage, append ToolMessages
 */
import { AIMessage, ToolMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';
import type { BaseMessage } from '@langchain/core/messages';
import { createLogger } from 'core';
import type { AgentGraphState } from './state.js';

const logger = createLogger('agent:graph:nodes');

export type ToolExecutorFn = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<{ result: unknown; error?: string }>;

/**
 * Build a `callModel` node that invokes the given LangChain Runnable.
 */
export function buildCallModelNode(
  runnable: Runnable<BaseMessage[], BaseMessage>,
): (state: AgentGraphState) => Promise<Partial<AgentGraphState>> {
  return async (state: AgentGraphState) => {
    logger.debug('callModel node', { messageCount: state.messages.length });
    const response = await runnable.invoke(state.messages);
    return { messages: [response] };
  };
}

/**
 * Build an `executeTools` node that executes all tool_calls in the last
 * AIMessage, appends ToolMessages to the state.
 */
export function buildExecuteToolsNode(
  toolExecutor: ToolExecutorFn,
): (state: AgentGraphState) => Promise<Partial<AgentGraphState>> {
  return async (state: AgentGraphState) => {
    const messages = state.messages;
    const last = messages[messages.length - 1];

    if (!(last instanceof AIMessage) || !last.tool_calls || last.tool_calls.length === 0) {
      return {};
    }

    const toolMessages: ToolMessage[] = [];

    for (const toolCall of last.tool_calls) {
      const toolCallId = toolCall.id ?? toolCall.name;
      logger.debug('executeTools: executing tool', { name: toolCall.name, args: toolCall.args });

      let content: string;
      try {
        const args =
          typeof toolCall.args === 'string'
            ? (JSON.parse(toolCall.args) as Record<string, unknown>)
            : (toolCall.args as Record<string, unknown>);

        const { result, error } = await toolExecutor(toolCall.name, args);

        if (error) {
          logger.warn('executeTools: tool returned error', { name: toolCall.name, error });
          content = error;
        } else {
          content = typeof result === 'string' ? result : JSON.stringify(result);
          logger.debug('executeTools: tool result', {
            name: toolCall.name,
            preview: content.slice(0, 200),
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Tool execution failed';
        logger.warn('executeTools: tool threw', { name: toolCall.name, error: message });
        content = message;
      }

      toolMessages.push(
        new ToolMessage({
          content,
          tool_call_id: toolCallId,
          name: toolCall.name,
        }),
      );
    }

    return { messages: toolMessages };
  };
}
