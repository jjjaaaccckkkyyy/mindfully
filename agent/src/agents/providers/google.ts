import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { LLMProvider, LLMConfig, Message, AIMessage, CostInfo } from './base.js';

export interface GoogleConfig extends LLMConfig {
  provider: 'google';
}

export class GoogleProvider implements LLMProvider {
  name = 'google';
  config: GoogleConfig;
  private client: ChatGoogleGenerativeAI;

  constructor(config: Partial<GoogleConfig> = {}) {
    this.config = {
      provider: 'google',
      model: config.model || 'gemini-2.0-flash-exp',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens || 4096,
      apiKey: config.apiKey || process.env.GOOGLE_API_KEY,
    };

    if (!this.config.apiKey) {
      throw new Error('GOOGLE_API_KEY is required');
    }

    this.client = new ChatGoogleGenerativeAI({
      model: this.config.model,
      temperature: this.config.temperature,
      maxOutputTokens: this.config.maxTokens,
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
