import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from './openai.js';

// ---------------------------------------------------------------------------
// openai.test.ts — constructor, getCost, inherits from OpenAICompatProvider
// ---------------------------------------------------------------------------

describe('OpenAIProvider — constructor', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws when OPENAI_API_KEY is absent and no key passed', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(() => new OpenAIProvider()).toThrow('OPENAI_API_KEY is required');
  });

  it('accepts apiKey from config', () => {
    const p = new OpenAIProvider({ apiKey: 'sk-test' });
    expect(p.name).toBe('openai');
  });

  it('reads OPENAI_API_KEY from env', () => {
    vi.stubEnv('OPENAI_API_KEY', 'env-key');
    const p = new OpenAIProvider();
    expect(p.config.apiKey).toBe('env-key');
  });

  it('defaults model to gpt-4o-mini', () => {
    const p = new OpenAIProvider({ apiKey: 'sk-test' });
    expect(p.config.model).toBe('gpt-4o-mini');
  });

  it('uses provided model override', () => {
    const p = new OpenAIProvider({ apiKey: 'sk-test', model: 'gpt-4o' });
    expect(p.config.model).toBe('gpt-4o');
  });

  it('sets provider field to "openai"', () => {
    const p = new OpenAIProvider({ apiKey: 'sk-test' });
    expect(p.config.provider).toBe('openai');
  });

  it('sets baseURL to api.openai.com/v1', () => {
    const p = new OpenAIProvider({ apiKey: 'sk-test' });
    expect(p.config.baseURL).toBe('https://api.openai.com/v1');
  });
});

// ---------------------------------------------------------------------------
// getCost — pricing table
// ---------------------------------------------------------------------------

describe('OpenAIProvider.getCost', () => {
  const make = (model: string) => new OpenAIProvider({ apiKey: 'sk-test', model });

  it('calculates cost for gpt-4o', () => {
    const cost = make('gpt-4o').getCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost.totalCost).toBeCloseTo(2.5 + 10.0, 5);
  });

  it('calculates cost for gpt-4o-mini', () => {
    const cost = make('gpt-4o-mini').getCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost.totalCost).toBeCloseTo(0.15 + 0.6, 5);
  });

  it('calculates cost for gpt-4-turbo', () => {
    const cost = make('gpt-4-turbo').getCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost.totalCost).toBeCloseTo(10.0 + 30.0, 5);
  });

  it('calculates cost for gpt-3.5-turbo', () => {
    const cost = make('gpt-3.5-turbo').getCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost.totalCost).toBeCloseTo(0.5 + 1.5, 5);
  });

  it('falls back to default pricing for unknown model', () => {
    const cost = make('unknown-model').getCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
    // default: input=1.0, output=3.0 per million
    expect(cost.totalCost).toBeCloseTo(1.0 + 3.0, 5);
  });

  it('returns USD currency', () => {
    const cost = make('gpt-4o-mini').getCost({ inputTokens: 100, outputTokens: 100 });
    expect(cost.currency).toBe('USD');
    expect(cost.provider).toBe('openai');
  });

  it('cost is 0 for 0 tokens', () => {
    const cost = make('gpt-4o').getCost({ inputTokens: 0, outputTokens: 0 });
    expect(cost.totalCost).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// invoke / stream via inherited OpenAICompatProvider (fetch mock)
// ---------------------------------------------------------------------------

describe('OpenAIProvider.invoke', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the OpenAI chat completions endpoint', async () => {
    const responseBody = {
      choices: [{ message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));

    const p = new OpenAIProvider({ apiKey: 'sk-test' });
    const result = await p.invoke([{ role: 'user', content: 'hi' }]);

    expect(result.content).toBe('Hello');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('passes tools when provided', async () => {
    const responseBody = {
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{ id: 'c1', type: 'function', function: { name: 'bash', arguments: '{}' } }],
          },
          finish_reason: 'tool_calls',
        },
      ],
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));

    const p = new OpenAIProvider({ apiKey: 'sk-test' });
    const result = await p.invoke(
      [{ role: 'user', content: 'run bash' }],
      [{ name: 'bash', description: 'run shell', parameters: {} }],
    );

    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls![0]?.name).toBe('bash');

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as { tools: unknown[]; tool_choice: string };
    expect(body.tools).toHaveLength(1);
    expect(body.tool_choice).toBe('auto');
  });
});
