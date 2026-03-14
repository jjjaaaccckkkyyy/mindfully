/**
 * LangGraph ReAct agent graph.
 *
 * Graph topology:
 *   __start__ → call_model → (shouldContinue) → execute_tools → call_model
 *                                             ↘ END
 *
 * Usage:
 *   const graph = buildAgentGraph({ runnable, toolExecutor });
 *   const compiled = graph.compile({ checkpointer });  // optional MemorySaver
 */
import { StateGraph, END } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';
import type { Runnable } from '@langchain/core/runnables';
import type { BaseMessage } from '@langchain/core/messages';
import { AgentStateAnnotation } from './state.js';
import { buildCallModelNode, buildExecuteToolsNode, type ToolExecutorFn } from './nodes.js';
import { shouldContinue } from './router.js';

export interface AgentGraphConfig {
  runnable: Runnable<BaseMessage[], BaseMessage>;
  toolExecutor: ToolExecutorFn;
  /** If true, attach a MemorySaver checkpointer (in-memory cross-turn state). */
  useCheckpointer?: boolean;
}

/**
 * Build and compile the ReAct StateGraph.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function buildAgentGraph(config: AgentGraphConfig) {
  const { runnable, toolExecutor, useCheckpointer = false } = config;

  const callModel = buildCallModelNode(runnable);
  const executeTools = buildExecuteToolsNode(toolExecutor);

  const graph = new StateGraph(AgentStateAnnotation)
    .addNode('call_model', callModel)
    .addNode('execute_tools', executeTools)
    .addEdge('__start__', 'call_model')
    .addConditionalEdges('call_model', shouldContinue, {
      execute_tools: 'execute_tools',
      [END]: END,
    })
    .addEdge('execute_tools', 'call_model');

  if (useCheckpointer) {
    const checkpointer = new MemorySaver();
    return graph.compile({ checkpointer });
  }

  return graph.compile();
}

export { AgentStateAnnotation, type ToolExecutorFn };
export { shouldContinue } from './router.js';
export { buildCallModelNode, buildExecuteToolsNode } from './nodes.js';
