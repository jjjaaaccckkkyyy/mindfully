/**
 * LangGraph state definition for the ReAct agent loop.
 *
 * The state holds:
 *  - messages: accumulated BaseMessages (HumanMessage, AIMessage, ToolMessage)
 *  - input:    the original user input string (convenience)
 */
import { Annotation, messagesStateReducer } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

export const AgentStateAnnotation = Annotation.Root({
  /**
   * The conversation message list.  LangGraph merges arrays by appending,
   * but we use the built-in messagesStateReducer so that ToolMessages are
   * matched to their AIMessage tool_call by ID correctly.
   */
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  /** Original user input — carried through the graph for convenience. */
  input: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
});

export type AgentGraphState = typeof AgentStateAnnotation.State;
