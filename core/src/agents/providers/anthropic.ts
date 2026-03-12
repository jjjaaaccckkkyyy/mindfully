import { ChatAnthropic } from '@langchain/anthropic';
import type { LLMProvider, LLMConfig, Message, AIMessage, CostInfo } from './base.js';

export interface AnthropicConfig extends LLMConfig {
  provider: 'anthropic';
}

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  config: AnthropicConfig;
  private client: ChatAnthropic;

  constructor(config: Partial<AnthropicConfig> = {}) {
    this.config = {
      provider: 'anthropic',
      model: config.model || 'claude-3-5-haiku-20241022',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens || 4096,
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
    };

    if (!this.config.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }

    this.client = new ChatAnthropic({
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      anthropicApiKey: this.config.apiKey,
      streaming: true,
    });
  }

  private toLangChainMessages(messages: Message[]): Array<{ role: string; content: string }> {
    return messages.map((m) => ({
      role: m.role === 'tool' ? 'user' : m.role,
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
      'claude-opus-4-5-20241022': { input: 15.0, output: 75.0 },
      'claude-sonnet-4-20241022': { input: 3.0, output: 15.0 },
      'claude-haiku-3-20240307': { input: 0.8, output: 4.0 },
    };
    
    const prices = modelPrices[this.config.model] || { input: 3.0, output: 15.0 };
    
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
