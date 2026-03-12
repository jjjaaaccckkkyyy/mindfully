import { ChatOpenAI } from '@langchain/openai';
import type { LLMProvider, LLMConfig, Message, AIMessage, CostInfo } from './base.js';

export interface OpenAIConfig extends LLMConfig {
  provider: 'openai';
}

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  config: OpenAIConfig;
  private client: ChatOpenAI;

  constructor(config: Partial<OpenAIConfig> = {}) {
    this.config = {
      provider: 'openai',
      model: config.model || 'gpt-4o-mini',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens || 4096,
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
    };

    if (!this.config.apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }

    this.client = new ChatOpenAI({
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      apiKey: this.config.apiKey,
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
    const modelPrices: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.5, output: 10.0 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'gpt-4-turbo': { input: 10.0, output: 30.0 },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
    };
    
    const prices = modelPrices[this.config.model] || { input: 1.0, output: 3.0 };
    
    return {
      provider: this.name,
      model: this.config.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalCost: (usage.inputTokens * prices.input / 1_000_000) + 
                 (usage.outputTokens * prices.output / 1_000_000),
      currency: 'USD',
    };
  }
}
