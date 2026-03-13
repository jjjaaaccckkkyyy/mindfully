import { OpenAICompatProvider } from './openai-compat.js';
import type { CostInfo } from './base.js';

export interface OpenAIConfig {
  provider?: 'openai';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

export class OpenAIProvider extends OpenAICompatProvider {
  override name = 'openai';

  private static readonly MODEL_PRICES: Record<string, { input: number; output: number }> = {
    'gpt-4o':          { input: 2.5,  output: 10.0 },
    'gpt-4o-mini':     { input: 0.15, output: 0.6  },
    'gpt-4-turbo':     { input: 10.0, output: 30.0 },
    'gpt-3.5-turbo':   { input: 0.5,  output: 1.5  },
  };

  constructor(config: OpenAIConfig = {}) {
    const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }

    super({
      apiKey,
      baseURL: 'https://api.openai.com/v1',
      model: config.model ?? 'gpt-4o-mini',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      streamUsage: true,
    });

    this.config.provider = 'openai';
  }

  getCost(usage: { inputTokens: number; outputTokens: number }): CostInfo {
    const prices = OpenAIProvider.MODEL_PRICES[this.config.model] ?? { input: 1.0, output: 3.0 };

    return {
      provider: this.name,
      model: this.config.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalCost:
        (usage.inputTokens * prices.input) / 1_000_000 +
        (usage.outputTokens * prices.output) / 1_000_000,
      currency: 'USD',
    };
  }
}
