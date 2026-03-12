import { ChatOpenAI } from '@langchain/openai';
import type { LLMProvider, LLMConfig, Message, AIMessage, CostInfo } from './base.js';

export interface OpenCodeZenConfig extends LLMConfig {
  provider: 'opencode-zen';
}

export class OpenCodeZenProvider implements LLMProvider {
  name = 'opencode-zen';
  config: OpenCodeZenConfig;
  private client: ChatOpenAI;

  constructor(config: Partial<OpenCodeZenConfig> = {}) {
    const apiKey = config.apiKey || process.env.OPENCODE_ZEN_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENCODE_ZEN_API_KEY is required');
    }

    this.config = {
      provider: 'opencode-zen',
      model: config.model || 'opencode/gpt-5.1-codex',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens || 4096,
      apiKey,
      baseURL: 'https://opencode.ai/zen/v1',
    };

    this.client = new ChatOpenAI({
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      apiKey: this.config.apiKey,
      configuration: {
        baseURL: this.config.baseURL,
      },
      streaming: true,
    });
  }

  private toLangChainMessages(messages: Message[]): Array<{ role: string; content: string }> {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  async invoke(messages: Message[]): Promise<AIMessage> {
    const response = await this.client.invoke(this.toLangChainMessages(messages));
    
    const content = typeof response.content === 'string' ? response.content : '';

    return {
      content,
    };
  }

  async *stream(messages: Message[]): AsyncGenerator<AIMessage> {
    const stream = await this.client.stream(this.toLangChainMessages(messages));
    
    for await (const chunk of stream) {
      const content = typeof chunk.content === 'string' ? chunk.content : '';
      yield { content };
    }
  }

  getCost(usage: { inputTokens: number; outputTokens: number }): CostInfo {
    const inputRate = 3.0 / 1_000_000;
    const outputRate = 15.0 / 1_000_000;
    
    return {
      provider: this.name,
      model: this.config.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalCost: (usage.inputTokens * inputRate) + (usage.outputTokens * outputRate),
      currency: 'USD',
    };
  }
}
