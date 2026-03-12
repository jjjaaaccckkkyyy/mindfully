export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    name: string;
    args: Record<string, unknown>;
    id?: string;
  }>;
  toolCallId?: string;
  toolName?: string;
}

export interface AIMessage {
  content: string;
  tool_calls?: Array<{
    name: string;
    args: string;
    id?: string;
  }>;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface LLMConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  baseURL?: string;
}

export interface CostInfo {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  currency: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
}

export interface LLMProvider {
  name: string;
  config: LLMConfig;
  invoke(messages: Message[], tools?: ToolSchema[]): Promise<AIMessage>;
  stream(messages: Message[], tools?: ToolSchema[]): AsyncGenerator<AIMessage>;
  getCost(usage: { inputTokens: number; outputTokens: number }): CostInfo;
}

export interface FallbackConfig {
  retryCount: number;
  timeoutMs: number;
  delayMs?: number;
}

export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  retryCount: 3,
  timeoutMs: 30000,
  delayMs: 1000,
};

export const PROVIDER_MODELS: Record<string, string[]> = {
  'opencode-zen': [
    'glm-5',
    'glm-4.7',
    'glm-4.6',
    'gpt-5.1-codex',
    'gpt-5.1-codex-mini',
    'gpt-5.1-codex-max',
    'gpt-5.3-codex',
    'gpt-5.4-pro',
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-3-5-haiku',
    'gemini-3-pro',
    'gemini-3-flash',
    'kimi-k2',
    'minimax-m2.5',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ],
  anthropic: [
    'claude-opus-4-5-20241022',
    'claude-sonnet-4-20241022',
    'claude-haiku-3-20240307',
  ],
  ollama: [
    'llama3.2',
    'llama3.1',
    'codellama',
    'mistral',
  ],
  google: [
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
};

export const DEFAULT_PROVIDER = 'opencode-zen';
export const DEFAULT_MODEL = 'gpt-5.1-codex';
