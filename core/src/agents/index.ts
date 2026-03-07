export interface Agent {
  name: string;
  description: string;
  tools: string[];
  execute(input: AgentInput): Promise<AgentOutput>;
}

export interface AgentInput {
  task: string;
  context?: Record<string, unknown>;
}

export interface AgentOutput {
  result: string;
  success: boolean;
  error?: string;
}

export abstract class BaseAgent implements Agent {
  abstract name: string;
  abstract description: string;
  abstract tools: string[];

  abstract execute(input: AgentInput): Promise<AgentOutput>;
}

export function createAgent(config: {
  name: string;
  description: string;
  tools: string[];
  execute: (input: AgentInput) => Promise<AgentOutput>;
}): Agent {
  return {
    name: config.name,
    description: config.description,
    tools: config.tools,
    execute: config.execute,
  };
}
