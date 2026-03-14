/**
 * LangChain provider factory.
 *
 * Creates a LangChain Runnable (BaseChatModel) for each configured provider,
 * wraps each in withRetry(), then chains them with withFallbacks().
 *
 * Cost tracking is handled by CostCallbackHandler which accumulates token
 * usage emitted by LangChain's callback system.
 */
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { LLMResult } from '@langchain/core/outputs';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Runnable } from '@langchain/core/runnables';
import type { BaseMessage } from '@langchain/core/messages';
import { createLogger } from 'core';

const logger = createLogger('agent:providers');

// ─── Cost tracking ────────────────────────────────────────────────────────────

export interface CostEntry {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  currency: 'USD';
}

/** Per-model pricing (USD per 1M tokens). */
const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  // OpenAI / OpenCodeZen
  'gpt-4o':                  { input: 2.5,  output: 10.0 },
  'gpt-4o-mini':             { input: 0.15, output: 0.6  },
  'gpt-4-turbo':             { input: 10.0, output: 30.0 },
  'gpt-3.5-turbo':           { input: 0.5,  output: 1.5  },
  'gpt-5.1-codex':           { input: 3.0,  output: 15.0 },
  'gpt-5.1-codex-mini':      { input: 1.5,  output: 7.5  },
  'gpt-5.1-codex-max':       { input: 6.0,  output: 30.0 },
  'gpt-5.3-codex':           { input: 3.0,  output: 15.0 },
  'gpt-5.4-pro':             { input: 2.5,  output: 15.0 },
  // Anthropic
  'claude-opus-4-5-20241022':   { input: 15.0, output: 75.0 },
  'claude-sonnet-4-20241022':   { input: 3.0,  output: 15.0 },
  'claude-haiku-3-20240307':    { input: 0.8,  output: 4.0  },
  'claude-3-5-haiku-20241022':  { input: 1.0,  output: 5.0  },
  'claude-opus-4-6':            { input: 5.0,  output: 25.0 },
  'claude-sonnet-4-6':          { input: 3.0,  output: 15.0 },
};

function getPrice(model: string): { input: number; output: number } {
  return MODEL_PRICES[model] ?? { input: 3.0, output: 15.0 };
}

/**
 * LangChain callback handler that accumulates cost entries from LLM token
 * usage reported after each generation.
 */
export class CostCallbackHandler extends BaseCallbackHandler {
  name = 'CostCallbackHandler';

  private readonly providerName: string;
  private readonly model: string;
  private readonly entries: CostEntry[] = [];

  constructor(providerName: string, model: string) {
    super();
    this.providerName = providerName;
    this.model = model;
  }

  override async handleLLMEnd(output: LLMResult): Promise<void> {
    const usage = output.llmOutput?.['tokenUsage'] as
      | { promptTokens?: number; completionTokens?: number }
      | undefined;
    if (!usage) return;

    const inputTokens = usage.promptTokens ?? 0;
    const outputTokens = usage.completionTokens ?? 0;
    const prices = getPrice(this.model);
    const totalCost =
      (inputTokens * prices.input) / 1_000_000 +
      (outputTokens * prices.output) / 1_000_000;

    this.entries.push({
      provider: this.providerName,
      model: this.model,
      inputTokens,
      outputTokens,
      totalCost,
      currency: 'USD',
    });
  }

  getCostHistory(): CostEntry[] {
    return [...this.entries];
  }

  getTotalCost(): number {
    return this.entries.reduce((sum, e) => sum + e.totalCost, 0);
  }

  getLastEntry(): CostEntry | undefined {
    return this.entries[this.entries.length - 1];
  }
}

// ─── Provider config ──────────────────────────────────────────────────────────

export type ProviderName = 'opencode-zen' | 'openai' | 'anthropic' | 'google' | 'ollama';

export interface ProviderEntry {
  name: ProviderName | string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMChainConfig {
  /**
   * Ordered list of providers to try. The first is primary; the rest are
   * fallbacks tried in order via withFallbacks().
   */
  providers?: Array<ProviderEntry | ProviderName>;
  /** Default model (can be overridden per-provider). */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Number of attempts per provider before moving to fallback. */
  retryAttempts?: number;
}

// ─── Model lists (for UI / validation) ────────────────────────────────────────

export const PROVIDER_MODELS: Record<string, string[]> = {
  'opencode-zen': [
    'glm-5', 'glm-4.7', 'glm-4.6',
    'gpt-5.1-codex', 'gpt-5.1-codex-mini', 'gpt-5.1-codex-max',
    'gpt-5.3-codex', 'gpt-5.4-pro',
    'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-3-5-haiku',
    'gemini-3-pro', 'gemini-3-flash',
    'kimi-k2', 'minimax-m2.5',
  ],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: [
    'claude-opus-4-5-20241022',
    'claude-sonnet-4-20241022',
    'claude-haiku-3-20240307',
    'claude-3-5-haiku-20241022',
  ],
  ollama: ['llama3.2', 'llama3.1', 'codellama', 'mistral'],
  google: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
};

export const DEFAULT_PROVIDER: ProviderName = 'opencode-zen';
export const DEFAULT_MODEL = 'gpt-5.1-codex';

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Shared constructor for OpenAI-compatible providers (openai + opencode-zen).
 * The only difference between them is the API key env var and an optional baseURL.
 */
function createOpenAICompatibleModel(
  opts: { model: string; temperature: number; maxTokens: number },
  apiKey: string,
  baseURL?: string,
): ChatOpenAI {
  return new ChatOpenAI({
    model: opts.model,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    apiKey,
    ...(baseURL ? { configuration: { baseURL } } : {}),
    streamUsage: true,
  });
}

/**
 * Build a single BaseChatModel for a named provider with the given options.
 * Throws if required API keys are absent.
 */
export function createChatModel(
  name: string,
  opts: { model: string; temperature: number; maxTokens: number },
): BaseChatModel {
  switch (name) {
    case 'opencode-zen': {
      const apiKey = process.env.OPENCODE_ZEN_API_KEY;
      if (!apiKey) throw new Error('OPENCODE_ZEN_API_KEY is required');
      return createOpenAICompatibleModel(opts, apiKey, 'https://opencode.ai/zen/v1');
    }
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY is required');
      return createOpenAICompatibleModel(opts, apiKey);
    }
    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required');
      return new ChatAnthropic({
        model: opts.model,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        apiKey,
      });
    }
    case 'google': {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) throw new Error('GOOGLE_API_KEY is required');
      return new ChatGoogleGenerativeAI({
        model: opts.model,
        temperature: opts.temperature,
        maxOutputTokens: opts.maxTokens,
        apiKey,
      });
    }
    case 'ollama': {
      return new ChatOllama({
        model: opts.model,
        temperature: opts.temperature,
        baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      });
    }
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

// ─── LLM chain with fallback ──────────────────────────────────────────────────

export interface LLMChain {
  /** The composed runnable (primary + fallbacks). */
  runnable: Runnable<BaseMessage[], BaseMessage>;
  /** Cost callback handlers, one per provider, in provider order. */
  costHandlers: CostCallbackHandler[];
  /** Combined cost across all handlers. */
  getTotalCost(): number;
  getCostHistory(): CostEntry[];
}

/**
 * Create a LangChain Runnable chain:
 *   primary.withRetry() -> .withFallbacks([fallback1.withRetry(), ...])
 *
 * Each model gets its own CostCallbackHandler injected via `callbacks`.
 */
export function createLLMChain(config: LLMChainConfig = {}): LLMChain {
  const defaultModel = config.model ?? process.env.LLM_MODEL ?? DEFAULT_MODEL;
  const defaultTemp = config.temperature ?? parseFloat(process.env.LLM_TEMPERATURE ?? '0.7');
  const defaultMaxTokens = config.maxTokens ?? parseInt(process.env.LLM_MAX_TOKENS ?? '4096', 10);
  const retryAttempts = config.retryAttempts ?? 2;

  const rawEntries = config.providers ?? getDefaultProviderEntries();
  const entries: ProviderEntry[] = rawEntries.map((e) =>
    typeof e === 'string' ? { name: e } : e,
  );

  const costHandlers: CostCallbackHandler[] = [];
  const runnables: Runnable<BaseMessage[], BaseMessage>[] = [];

  for (const entry of entries) {
    const model = entry.model ?? defaultModel;
    const temperature = entry.temperature ?? defaultTemp;
    const maxTokens = entry.maxTokens ?? defaultMaxTokens;

    let chatModel: BaseChatModel;
    try {
      chatModel = createChatModel(entry.name, { model, temperature, maxTokens });
    } catch (err) {
      logger.warn(
        `Skipping provider ${entry.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    const handler = new CostCallbackHandler(entry.name, model);
    costHandlers.push(handler);

    // Attach cost handler as a persistent callback on the model
    const modelWithCallbacks = chatModel.withConfig({ callbacks: [handler] });

    const withRetry = modelWithCallbacks.withRetry({ stopAfterAttempt: retryAttempts });
    runnables.push(withRetry as Runnable<BaseMessage[], BaseMessage>);
  }

  if (runnables.length === 0) {
    throw new Error('No valid providers could be created. Check your API keys.');
  }

  const [primary, ...fallbacks] = runnables;
  const runnable =
    fallbacks.length > 0
      ? (primary.withFallbacks(fallbacks) as Runnable<BaseMessage[], BaseMessage>)
      : primary;

  return {
    runnable,
    costHandlers,
    getTotalCost() {
      return costHandlers.reduce((sum, h) => sum + h.getTotalCost(), 0);
    },
    getCostHistory() {
      return costHandlers.flatMap((h) => h.getCostHistory());
    },
  };
}

function getDefaultProviderEntries(): ProviderEntry[] {
  const env = process.env.LLM_PROVIDERS;
  if (env) {
    return env.split(',').map((p) => ({ name: p.trim() as ProviderName }));
  }
  return [{ name: 'opencode-zen' }, { name: 'openai' }];
}

export function getProviderModels(provider: string): string[] {
  return PROVIDER_MODELS[provider] ?? [];
}

export function getAllProviderNames(): string[] {
  return ['opencode-zen', 'openai', 'anthropic', 'ollama', 'google'];
}
