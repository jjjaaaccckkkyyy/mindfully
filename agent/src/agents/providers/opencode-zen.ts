import { OpenAICompatProvider } from './openai-compat.js';
import type { CostInfo } from './base.js';

export interface OpenCodeZenConfig {
  provider?: 'opencode-zen';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

export class OpenCodeZenProvider extends OpenAICompatProvider {
  override name = 'opencode-zen';

  constructor(config: OpenCodeZenConfig = {}) {
    const apiKey = config.apiKey ?? process.env.OPENCODE_ZEN_API_KEY;
    if (!apiKey) {
      throw new Error('OPENCODE_ZEN_API_KEY is required');
    }

    super({
      apiKey,
      baseURL: 'https://opencode.ai/zen/v1',
      model: config.model ?? 'gpt-5.1-codex',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      connectTimeoutMs: parseInt(process.env.LLM_CONNECT_TIMEOUT_MS ?? '15000', 10),
      idleTimeoutMs: parseInt(process.env.LLM_IDLE_TIMEOUT_MS ?? '30000', 10),
      streamUsage: true,
    });

    // Keep config.provider aligned for consumers that inspect it
    this.config.provider = 'opencode-zen';
  }

  getCost(usage: { inputTokens: number; outputTokens: number }): CostInfo {
    const inputRate = 3.0 / 1_000_000;
    const outputRate = 15.0 / 1_000_000;

    return {
      provider: this.name,
      model: this.config.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalCost: usage.inputTokens * inputRate + usage.outputTokens * outputRate,
      currency: 'USD',
    };
  }
}
