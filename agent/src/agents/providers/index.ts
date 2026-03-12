import { OpenCodeZenProvider } from './opencode-zen.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';
import { GoogleProvider } from './google.js';
import { ProviderChain } from './chain.js';
import type { LLMProvider, FallbackConfig } from './base.js';
import { DEFAULT_MODEL } from './base.js';
import { createLogger } from 'core';

const logger = createLogger('agent:providers');

export interface ProviderFactoryConfig {
  providers?: string[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  fallback?: Partial<FallbackConfig>;
}

export function createProvider(name: string, config?: {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): LLMProvider {
  switch (name) {
    case 'opencode-zen':
      return new OpenCodeZenProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'google':
      return new GoogleProvider(config);
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

export function createProviderChain(config: ProviderFactoryConfig = {}): ProviderChain {
  const providerNames = config.providers || getDefaultProviders();
  const model = config.model || process.env.LLM_MODEL || DEFAULT_MODEL;
  const temperature = config.temperature ?? parseFloat(process.env.LLM_TEMPERATURE || '0.7');
  const maxTokens = config.maxTokens ?? parseInt(process.env.LLM_MAX_TOKENS || '4096', 10);

  const providers = providerNames
    .map((name) => {
      try {
        return createProvider(name, { model, temperature, maxTokens });
      } catch (error) {
        logger.warn(`Failed to create provider ${name}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    })
    .filter((p): p is LLMProvider => p !== null);

  if (providers.length === 0) {
    throw new Error('No valid providers could be created. Please check your API keys.');
  }

  return new ProviderChain(providers, config.fallback);
}

function getDefaultProviders(): string[] {
  const envProviders = process.env.LLM_PROVIDERS;
  if (envProviders) {
    return envProviders.split(',').map((p) => p.trim()).filter(Boolean);
  }
  return ['opencode-zen', 'openai'];
}

export function getProviderModels(provider: string): string[] {
  const models: Record<string, string[]> = {
    'opencode-zen': ['big-pickle','glm-5-go',
      'glm-5', 'glm-4.7', 'glm-4.6',
      'gpt-5.1-codex', 'gpt-5.1-codex-mini', 'gpt-5.1-codex-max',
      'gpt-5.3-codex', 'gpt-5.4-pro',
      'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-3-5-haiku',
      'gemini-3-pro', 'gemini-3-flash',
      'kimi-k2', 'minimax-m2.5',
    ],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    anthropic: ['claude-opus-4-5-20241022', 'claude-sonnet-4-20241022', 'claude-haiku-3-20240307'],
    ollama: ['llama3.2', 'llama3.1', 'codellama', 'mistral'],
    google: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  };
  return models[provider] || [];
}

export function getAllProviderNames(): string[] {
  return ['opencode-zen', 'openai', 'anthropic', 'ollama', 'google'];
}

export { ProviderChain } from './chain.js';
export type { LLMProvider, Message, AIMessage, CostInfo, FallbackConfig, ToolSchema } from './base.js';
