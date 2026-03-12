import type { LLMProvider, Message, AIMessage, CostInfo, FallbackConfig, ToolSchema } from './base.js';
import { DEFAULT_FALLBACK_CONFIG } from './base.js';
import { createLogger } from 'core';

const logger = createLogger('agent:provider-chain');

export class ProviderChain {
  private providers: LLMProvider[];
  private config: FallbackConfig;
  private costHistory: CostInfo[] = [];

  constructor(providers: LLMProvider[], config: Partial<FallbackConfig> = {}) {
    if (providers.length === 0) {
      throw new Error('At least one provider is required');
    }
    this.providers = providers;
    this.config = { ...DEFAULT_FALLBACK_CONFIG, ...config };
  }

  async invoke(messages: Message[], tools: ToolSchema[] = []): Promise<AIMessage> {
    let lastError: Error | null = null;

    for (let providerIndex = 0; providerIndex < this.providers.length; providerIndex++) {
      const provider = this.providers[providerIndex];

      for (let retry = 0; retry < this.config.retryCount; retry++) {
        try {
          const response = await this.invokeWithTimeout(provider, messages, tools);

          if (response.usage) {
            const costInfo = provider.getCost({
              inputTokens: response.usage.inputTokens,
              outputTokens: response.usage.outputTokens,
            });
            this.costHistory.push(costInfo);
          }

          return response;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          logger.warn(
            `Provider ${provider.name} failed (attempt ${retry + 1}/${this.config.retryCount}): ${lastError.message}`,
          );

          if (this.config.delayMs && retry < this.config.retryCount - 1) {
            await this.delay(this.config.delayMs);
          }
        }
      }

      if (this.config.delayMs && providerIndex < this.providers.length - 1) {
        await this.delay(this.config.delayMs);
      }
    }

    throw new Error(`All providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  async *stream(messages: Message[], tools: ToolSchema[] = []): AsyncGenerator<AIMessage> {
    let lastError: Error | null = null;

    for (let providerIndex = 0; providerIndex < this.providers.length; providerIndex++) {
      const provider = this.providers[providerIndex];

      try {
        for await (const chunk of provider.stream(messages, tools)) {
          yield chunk;
        }
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Provider ${provider.name} stream failed: ${lastError.message}`);

        if (this.config.delayMs && providerIndex < this.providers.length - 1) {
          await this.delay(this.config.delayMs);
        }
      }
    }

    throw new Error(
      `All providers failed to stream. Last error: ${lastError?.message || 'Unknown error'}`,
    );
  }

  private async invokeWithTimeout(
    provider: LLMProvider,
    messages: Message[],
    tools: ToolSchema[],
  ): Promise<AIMessage> {
    const timeoutPromise = new Promise<AIMessage>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Provider ${provider.name} timed out`)),
        this.config.timeoutMs,
      );
    });

    const invokePromise = provider.invoke(messages, tools);

    return Promise.race([invokePromise, timeoutPromise]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getTotalCost(): number {
    return this.costHistory.reduce((sum, cost) => sum + cost.totalCost, 0);
  }

  getCostHistory(): CostInfo[] {
    return [...this.costHistory];
  }

  getProviders(): LLMProvider[] {
    return [...this.providers];
  }

  getCurrentProvider(): LLMProvider {
    return this.providers[0];
  }
}
