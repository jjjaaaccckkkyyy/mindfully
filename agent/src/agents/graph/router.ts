/**
 * Conditional edge router for the ReAct graph.
 *
 * After `call_model` runs, this function inspects the last message:
 *  - If the AIMessage contains tool_calls → route to `execute_tools`
 *  - Otherwise                            → route to END
 */
import { END } from '@langchain/langgraph';
import { AIMessage } from '@langchain/core/messages';
import type { AgentGraphState } from './state.js';

export function shouldContinue(state: AgentGraphState): 'execute_tools' | typeof END {
  const messages = state.messages;
  const last = messages[messages.length - 1];

  if (last instanceof AIMessage && last.tool_calls && last.tool_calls.length > 0) {
    return 'execute_tools';
  }

  return END;
}
