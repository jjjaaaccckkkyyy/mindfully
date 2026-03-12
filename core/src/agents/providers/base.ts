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

export interface LLMProvider {
  name: string;
  config: LLMConfig;
  invoke(messages: Message[]): Promise<AIMessage>;
  stream(messages: Message[]): AsyncGenerator<AIMessage>;
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
    'opencode/gpt-5.1-codex',
    'opencode/claude-opus-4-6',
    'opencode/gpt-4.5',
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
export const DEFAULT_MODEL = 'opencode/gpt-5.1-codex';
