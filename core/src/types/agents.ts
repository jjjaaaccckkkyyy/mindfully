export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  tools: string[];
  memoryEnabled: boolean;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentCreateInput {
  name: string;
  description: string;
  model: string;
  tools?: string[];
  memoryEnabled?: boolean;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AgentUpdateInput {
  name?: string;
  description?: string;
  model?: string;
  tools?: string[];
  memoryEnabled?: boolean;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AgentExecution {
  id: string;
  agentId: string;
  input: string;
  output: string;
  status: ExecutionStatus;
  error?: string;
  tokenUsage?: TokenUsage;
  startedAt: Date;
  completedAt?: Date;
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AgentExecutionInput {
  input: string;
  context?: Record<string, unknown>;
}

export interface AgentExecutionStream {
  type: 'chunk' | 'tool' | 'error' | 'done';
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
}

export interface AgentListOptions {
  userId?: string;
  limit?: number;
  offset?: number;
}

export const DEFAULT_AGENT_CONFIG = {
  model: 'gpt-4o-mini',
  maxTokens: 4096,
  temperature: 0.7,
  memoryEnabled: false,
} as const;

export const SUPPORTED_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
] as const;

export type SupportedModel = typeof SUPPORTED_MODELS[number];
