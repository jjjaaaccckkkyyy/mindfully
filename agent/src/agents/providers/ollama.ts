import type { LLMProvider, LLMConfig, Message, AIMessage, CostInfo } from './base.js';

export interface OllamaConfig extends LLMConfig {
  provider: 'ollama';
}

export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  config: OllamaConfig;

  constructor(config: Partial<OllamaConfig> = {}) {
    const baseURL = config.baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

    this.config = {
      provider: 'ollama',
      model: config.model || 'llama3.2',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens || 4096,
      baseURL,
    };
  }

  async invoke(_messages: Message[]): Promise<AIMessage> {
    throw new Error('Ollama provider requires @langchain/community. Install with: pnpm add @langchain/community');
  }

  // eslint-disable-next-line require-yield
  async *stream(_messages: Message[]): AsyncGenerator<AIMessage> {
    throw new Error('Ollama provider requires @langchain/community. Install with: pnpm add @langchain/community');
  }

  getCost(usage: { inputTokens: number; outputTokens: number }): CostInfo {
    return {
      provider: this.name,
      model: this.config.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalCost: 0,
      currency: 'USD',
    };
  }
}
