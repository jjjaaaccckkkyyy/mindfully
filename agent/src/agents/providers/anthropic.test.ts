import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicProvider } from './anthropic.js';

// ---------------------------------------------------------------------------
// anthropic.test.ts — message mappers, invoke, stream, getCost
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helper: build a mock SSE streaming response
// ---------------------------------------------------------------------------

function makeMockStreamResponse(body: string, status = 200): Response {
  const chunks = [new TextEncoder().encode(body)];
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++]!);
      } else {
        controller.close();
      }
    },
  });
  return new Response(stream, { status });
}

// ---------------------------------------------------------------------------
// constructor
// ---------------------------------------------------------------------------

describe('AnthropicProvider — constructor', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws when ANTHROPIC_API_KEY is absent', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(() => new AnthropicProvider()).toThrow('ANTHROPIC_API_KEY is required');
  });

  it('accepts apiKey from config', () => {
    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    expect(p.name).toBe('anthropic');
  });

  it('reads ANTHROPIC_API_KEY from env', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'env-ant');
    const p = new AnthropicProvider();
    expect(p.config.apiKey).toBe('env-ant');
  });

  it('defaults model to claude-3-5-haiku-20241022', () => {
    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    expect(p.config.model).toBe('claude-3-5-haiku-20241022');
  });

  it('sets provider field to "anthropic"', () => {
    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    expect(p.config.provider).toBe('anthropic');
  });
});

// ---------------------------------------------------------------------------
// toAnthropicMessages
// ---------------------------------------------------------------------------

describe('AnthropicProvider.toAnthropicMessages', () => {
  const provider = new AnthropicProvider({ apiKey: 'ant-test' });

  it('extracts system messages into system field', () => {
    const { system, messages } = provider.toAnthropicMessages([
      { role: 'system', content: 'Be helpful.' },
      { role: 'user', content: 'Hello' },
    ]);
    expect(system).toBe('Be helpful.');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: 'user', content: 'Hello' });
  });

  it('concatenates multiple system messages', () => {
    const { system } = provider.toAnthropicMessages([
      { role: 'system', content: 'Part one.' },
      { role: 'system', content: 'Part two.' },
    ]);
    expect(system).toBe('Part one.\n\nPart two.');
  });

  it('returns empty system when none present', () => {
    const { system } = provider.toAnthropicMessages([{ role: 'user', content: 'Hi' }]);
    expect(system).toBe('');
  });

  it('maps tool role → user message with tool_result content', () => {
    const { messages } = provider.toAnthropicMessages([
      { role: 'tool', content: '{"ok":true}', toolCallId: 'call_1', toolName: 'bash' },
    ]);
    expect(messages[0]?.role).toBe('user');
    const content = messages[0]?.content as Array<{ type: string; tool_use_id: string; content: string }>;
    expect(content[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'call_1',
      content: '{"ok":true}',
    });
  });

  it('defaults tool_use_id to "unknown" when toolCallId is absent', () => {
    const { messages } = provider.toAnthropicMessages([
      { role: 'tool', content: 'result' },
    ]);
    const content = messages[0]?.content as Array<{ tool_use_id: string }>;
    expect(content[0]?.tool_use_id).toBe('unknown');
  });

  it('maps assistant with tool_calls to content array', () => {
    const { messages } = provider.toAnthropicMessages([
      {
        role: 'assistant',
        content: 'thinking…',
        tool_calls: [{ id: 'tc1', name: 'read', args: { path: '/tmp' } }],
      },
    ]);
    const content = messages[0]?.content as Array<{ type: string }>;
    expect(content[0]).toMatchObject({ type: 'text', text: 'thinking…' });
    expect(content[1]).toMatchObject({ type: 'tool_use', id: 'tc1', name: 'read' });
  });

  it('handles already-stringified args in assistant tool_calls', () => {
    const { messages } = provider.toAnthropicMessages([
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'tc2', name: 'bash', args: '{"cmd":"ls"}' as unknown as Record<string, unknown> }],
      },
    ]);
    const content = messages[0]?.content as Array<{ type: string; input: unknown }>;
    const toolUse = content.find((b) => b.type === 'tool_use');
    expect(toolUse?.input).toMatchObject({ cmd: 'ls' });
  });

  it('omits text block when assistant content is empty', () => {
    const { messages } = provider.toAnthropicMessages([
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'tc3', name: 'read', args: {} }],
      },
    ]);
    const content = messages[0]?.content as Array<{ type: string }>;
    expect(content.filter((b) => b.type === 'text')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// toAnthropicTools
// ---------------------------------------------------------------------------

describe('AnthropicProvider.toAnthropicTools', () => {
  const provider = new AnthropicProvider({ apiKey: 'ant-test' });

  it('converts tool schemas to Anthropic format', () => {
    const result = provider.toAnthropicTools([
      { name: 'bash', description: 'Run shell command', parameters: { type: 'object', properties: {} } },
    ]);
    expect(result).toEqual([
      {
        name: 'bash',
        description: 'Run shell command',
        input_schema: { type: 'object', properties: {} },
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// invoke
// ---------------------------------------------------------------------------

describe('AnthropicProvider.invoke', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the Anthropic messages endpoint', async () => {
    const responseBody = {
      content: [{ type: 'text', text: 'Hi there' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));

    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    const result = await p.invoke([{ role: 'user', content: 'Hello' }]);

    expect(result.content).toBe('Hi there');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
  });

  it('sends correct auth headers', async () => {
    const responseBody = {
      content: [{ type: 'text', text: 'ok' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));

    const p = new AnthropicProvider({ apiKey: 'ant-key-123' });
    await p.invoke([{ role: 'user', content: 'hi' }]);

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('ant-key-123');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('returns tool_calls from response', async () => {
    const responseBody = {
      content: [
        { type: 'tool_use', id: 'tu1', name: 'bash', input: { cmd: 'ls' } },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 20, output_tokens: 10 },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));

    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    const result = await p.invoke([{ role: 'user', content: 'run ls' }]);

    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls![0]).toMatchObject({
      name: 'bash',
      args: '{"cmd":"ls"}',
      id: 'tu1',
    });
  });

  it('passes system prompt in body', async () => {
    const responseBody = {
      content: [{ type: 'text', text: 'ok' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 5, output_tokens: 2 },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));

    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    await p.invoke([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'hi' },
    ]);

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string) as { system: string };
    expect(body.system).toBe('You are helpful.');
  });

  it('throws on non-200 response', async () => {
    fetchMock.mockResolvedValue(new Response('Bad Request', { status: 400 }));

    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    await expect(p.invoke([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      'Anthropic API error 400',
    );
  });
});

// ---------------------------------------------------------------------------
// stream
// ---------------------------------------------------------------------------

describe('AnthropicProvider.stream', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yields text from content_block_delta events', async () => {
    const sse = [
      'event: content_block_start',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ].join('\n');

    fetchMock.mockResolvedValue(makeMockStreamResponse(sse));

    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    const tokens: string[] = [];
    for await (const msg of p.stream([{ role: 'user', content: 'hi' }])) {
      if (msg.content) tokens.push(msg.content);
    }
    expect(tokens).toEqual(['Hello', ' World']);
  });

  it('yields tool_calls from tool_use blocks on stop_reason tool_use', async () => {
    const sse = [
      'event: content_block_start',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tu1","name":"bash"}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"cmd\\":\\"ls\\"}"}}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ].join('\n');

    fetchMock.mockResolvedValue(makeMockStreamResponse(sse));

    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    const msgs: Array<{ content: string; tool_calls?: Array<{ name: string; args: string; id?: string }> }> = [];
    for await (const msg of p.stream([{ role: 'user', content: 'run ls' }])) {
      msgs.push(msg);
    }
    const withCalls = msgs.find((m) => m.tool_calls && m.tool_calls.length > 0);
    expect(withCalls).toBeDefined();
    expect(withCalls!.tool_calls![0]).toMatchObject({ name: 'bash', id: 'tu1' });
    expect(withCalls!.tool_calls![0]?.args).toContain('cmd');
  });

  it('throws on non-200 streaming response', async () => {
    fetchMock.mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    await expect(async () => {
      for await (const _ of p.stream([{ role: 'user', content: 'hi' }])) {
        // consume
      }
    }).rejects.toThrow('Anthropic API error 500');
  });
});

// ---------------------------------------------------------------------------
// getCost
// ---------------------------------------------------------------------------

describe('AnthropicProvider.getCost', () => {
  const make = (model: string) => new AnthropicProvider({ apiKey: 'ant-test', model });

  it('calculates cost for claude-opus-4-5-20241022', () => {
    const cost = make('claude-opus-4-5-20241022').getCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost.totalCost).toBeCloseTo(15.0 + 75.0, 5);
  });

  it('calculates cost for claude-sonnet-4-20241022', () => {
    const cost = make('claude-sonnet-4-20241022').getCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost.totalCost).toBeCloseTo(3.0 + 15.0, 5);
  });

  it('calculates cost for claude-haiku-3-20240307', () => {
    const cost = make('claude-haiku-3-20240307').getCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost.totalCost).toBeCloseTo(0.8 + 4.0, 5);
  });

  it('falls back to default pricing for unknown model', () => {
    const cost = make('claude-unknown').getCost({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost.totalCost).toBeCloseTo(3.0 + 15.0, 5);
  });

  it('returns USD and correct provider/model', () => {
    const cost = make('claude-haiku-3-20240307').getCost({ inputTokens: 0, outputTokens: 0 });
    expect(cost.currency).toBe('USD');
    expect(cost.provider).toBe('anthropic');
    expect(cost.model).toBe('claude-haiku-3-20240307');
  });
});

// ---------------------------------------------------------------------------
// invoke — usage populated
// ---------------------------------------------------------------------------

describe('AnthropicProvider.invoke — usage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('populates usage from response data', async () => {
    const responseBody = {
      content: [{ type: 'text', text: 'Hello' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 15, output_tokens: 25 },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));

    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    const result = await p.invoke([{ role: 'user', content: 'hi' }]);
    expect(result.usage).toEqual({ inputTokens: 15, outputTokens: 25, totalTokens: 40 });
  });

  it('totalTokens is sum of input and output tokens', async () => {
    const responseBody = {
      content: [{ type: 'text', text: 'ok' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 200 },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 }));

    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    const result = await p.invoke([{ role: 'user', content: 'hi' }]);
    expect(result.usage!.totalTokens).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// stream — usage from message_start / message_delta events
// ---------------------------------------------------------------------------

describe('AnthropicProvider.stream — usage', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('yields a final usage chunk after stream with inputTokens from message_start and outputTokens from message_delta', async () => {
    const sse = [
      'event: message_start',
      'data: {"type":"message_start","message":{"usage":{"input_tokens":12}}}',
      '',
      'event: content_block_start',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":8}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ].join('\n');

    fetchMock.mockResolvedValue(makeMockStreamResponse(sse));

    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    const msgs: Array<{ content: string; usage?: { inputTokens: number; outputTokens: number; totalTokens: number } }> = [];
    for await (const msg of p.stream([{ role: 'user', content: 'hi' }])) {
      msgs.push(msg);
    }

    const usageChunk = msgs.find((m) => m.usage !== undefined);
    expect(usageChunk).toBeDefined();
    expect(usageChunk!.usage).toEqual({ inputTokens: 12, outputTokens: 8, totalTokens: 20 });
    expect(usageChunk!.content).toBe('');
  });

  it('does not yield usage chunk when no token counts are received', async () => {
    const sse = [
      'event: content_block_start',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ].join('\n');

    fetchMock.mockResolvedValue(makeMockStreamResponse(sse));

    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    const msgs: Array<{ content: string; usage?: unknown }> = [];
    for await (const msg of p.stream([{ role: 'user', content: 'hi' }])) {
      msgs.push(msg);
    }

    expect(msgs.every((m) => m.usage === undefined)).toBe(true);
  });

  it('usage chunk totalTokens is sum of input and output', async () => {
    const sse = [
      'event: message_start',
      'data: {"type":"message_start","message":{"usage":{"input_tokens":50}}}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":30}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ].join('\n');

    fetchMock.mockResolvedValue(makeMockStreamResponse(sse));

    const p = new AnthropicProvider({ apiKey: 'ant-test' });
    const msgs: Array<{ content: string; usage?: { totalTokens: number } }> = [];
    for await (const msg of p.stream([{ role: 'user', content: 'hi' }])) {
      msgs.push(msg);
    }

    const usageChunk = msgs.find((m) => m.usage !== undefined);
    expect(usageChunk!.usage!.totalTokens).toBe(80);
  });
});
