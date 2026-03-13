import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProviderChain, createProvider } from './index.js';

// ---------------------------------------------------------------------------
// Mock all individual provider classes to avoid real API calls
// ---------------------------------------------------------------------------

vi.mock('./opencode-zen.js', () => ({
  OpenCodeZenProvider: vi.fn().mockImplementation((config?: { model?: string; temperature?: number; maxTokens?: number }) => ({
    name: 'opencode-zen',
    config: { provider: 'opencode-zen', model: config?.model ?? 'gpt-5.1-codex' },
    invoke: vi.fn(),
    stream: vi.fn(),
    getCost: vi.fn(),
  })),
}));
vi.mock('./openai.js', () => ({
  OpenAIProvider: vi.fn().mockImplementation((config?: { model?: string; temperature?: number; maxTokens?: number }) => ({
    name: 'openai',
    config: { provider: 'openai', model: config?.model ?? 'gpt-4o-mini' },
    invoke: vi.fn(),
    stream: vi.fn(),
    getCost: vi.fn(),
  })),
}));
vi.mock('./anthropic.js', () => ({
  AnthropicProvider: vi.fn().mockImplementation((config?: { model?: string }) => ({
    name: 'anthropic',
    config: { provider: 'anthropic', model: config?.model ?? 'claude-sonnet' },
    invoke: vi.fn(),
    stream: vi.fn(),
    getCost: vi.fn(),
  })),
}));
vi.mock('./ollama.js', () => ({
  OllamaProvider: vi.fn().mockImplementation(() => ({
    name: 'ollama',
    config: { provider: 'ollama', model: 'llama3.2' },
    invoke: vi.fn(),
    stream: vi.fn(),
    getCost: vi.fn(),
  })),
}));
vi.mock('./google.js', () => ({
  GoogleProvider: vi.fn().mockImplementation(() => ({
    name: 'google',
    config: { provider: 'google', model: 'gemini-1.5-pro' },
    invoke: vi.fn(),
    stream: vi.fn(),
    getCost: vi.fn(),
  })),
}));
vi.mock('./chain.js', () => ({
  ProviderChain: vi.fn().mockImplementation((providers: unknown[]) => ({
    providers,
  })),
}));
vi.mock('core', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

import { OpenCodeZenProvider } from './opencode-zen.js';
import { OpenAIProvider } from './openai.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createProvider', () => {
  it('creates an opencode-zen provider', () => {
    const p = createProvider('opencode-zen');
    expect(p.name).toBe('opencode-zen');
  });

  it('creates an openai provider', () => {
    const p = createProvider('openai');
    expect(p.name).toBe('openai');
  });

  it('throws for an unknown provider name', () => {
    expect(() => createProvider('unknown')).toThrow('Unknown provider: unknown');
  });
});

describe('createProviderChain — string providers (backwards-compatible)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env['LLM_PROVIDERS'];
    delete process.env['LLM_MODEL'];
  });

  it('creates a chain with default providers from env when no config passed', () => {
    process.env['LLM_PROVIDERS'] = 'opencode-zen';
    const chain = createProviderChain();
    expect((chain as unknown as { providers: unknown[] }).providers).toHaveLength(1);
  });

  it('accepts a string array in providers', () => {
    const chain = createProviderChain({ providers: ['openai', 'opencode-zen'] });
    expect((chain as unknown as { providers: unknown[] }).providers).toHaveLength(2);
  });

  it('passes top-level model to all string entries', () => {
    createProviderChain({ providers: ['openai'], model: 'gpt-4o' });
    expect(OpenAIProvider).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o' }),
    );
  });

  it('throws when all providers fail to construct', () => {
    expect(() => createProviderChain({ providers: ['unknown-provider-xyz'] })).toThrow(
      'No valid providers could be created',
    );
  });
});

describe('createProviderChain — ProviderEntry object overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env['LLM_MODEL'];
  });

  it('uses per-provider model when ProviderEntry object specifies model', () => {
    createProviderChain({
      providers: [{ name: 'openai', model: 'gpt-4o' }],
      model: 'gpt-3.5-turbo',  // top-level default
    });
    // openai entry has its own model override — must use 'gpt-4o', not 'gpt-3.5-turbo'
    expect(OpenAIProvider).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o' }),
    );
  });

  it('falls back to top-level model for entries without their own model', () => {
    createProviderChain({
      providers: [
        { name: 'opencode-zen' },  // no model specified
      ],
      model: 'big-pickle',
    });
    expect(OpenCodeZenProvider).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'big-pickle' }),
    );
  });

  it('uses per-provider temperature override', () => {
    createProviderChain({
      providers: [{ name: 'openai', temperature: 0.1 }],
      temperature: 0.9,
    });
    expect(OpenAIProvider).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.1 }),
    );
  });

  it('uses per-provider maxTokens override', () => {
    createProviderChain({
      providers: [{ name: 'openai', maxTokens: 512 }],
      maxTokens: 8192,
    });
    expect(OpenAIProvider).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 512 }),
    );
  });

  it('mixes string entries and object entries in the same chain', () => {
    createProviderChain({
      providers: [
        { name: 'openai', model: 'gpt-4o' },
        'opencode-zen',
      ],
      model: 'big-pickle',
    });
    // openai: uses its own model
    expect(OpenAIProvider).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o' }),
    );
    // opencode-zen (string entry): falls back to top-level model
    expect(OpenCodeZenProvider).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'big-pickle' }),
    );
  });

  it('skips invalid providers gracefully and still returns a chain', () => {
    // Mixes a valid and an invalid entry — invalid is skipped
    const chain = createProviderChain({
      providers: [{ name: 'unknown-xyz', model: 'whatever' }, 'openai'],
    });
    expect((chain as unknown as { providers: unknown[] }).providers).toHaveLength(1);
  });
});
