import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHttpTool } from '../tools/builtin/http.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchResponse(
  body: string,
  status = 200,
  headers: Record<string, string> = { 'content-type': 'text/plain' },
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : String(status),
    text: async () => body,
    headers: {
      forEach: (cb: (value: string, key: string) => void) => {
        for (const [k, v] of Object.entries(headers)) cb(v, k);
      },
    },
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('http tool', () => {
  const tool = createHttpTool();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // --- Private IP blocking ---

  describe('private IP blocking', () => {
    const privateUrls = [
      'http://localhost/api',
      'http://127.0.0.1/secret',
      'http://127.0.0.2/',
      'http://0.0.0.0/',
      'http://10.0.0.1/',
      'http://10.255.255.255/',
      'http://172.16.0.1/',
      'http://172.31.0.1/',
      'http://192.168.1.1/',
      'http://192.168.0.254/',
      'http://169.254.0.1/',
    ];

    it.each(privateUrls)('blocks %s', async (url) => {
      const result = await tool.execute({ url });
      expect(result).toMatchObject({ success: false });
      expect((result as { error: string }).error).toMatch(/[Bb]locked/);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  // --- Invalid URL ---

  it('returns error for invalid URL', async () => {
    const result = await tool.execute({ url: 'not-a-url' });
    expect(result).toMatchObject({ success: false });
    expect((result as { error: string }).error).toMatch(/[Ii]nvalid URL/);
  });

  // --- Successful GET ---

  it('performs a GET request and returns status + body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeFetchResponse('{"hello":"world"}', 200, { 'content-type': 'application/json' }),
    );

    const result = await tool.execute({ url: 'https://api.example.com/data' }) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.statusText).toBe('OK');
    expect(result.body).toBe('{"hello":"world"}');
    expect((result.headers as Record<string, string>)['content-type']).toBe('application/json');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/data',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  // --- POST with body ---

  it('sends body for POST requests', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeFetchResponse('created', 201));

    await tool.execute({
      url: 'https://api.example.com/items',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"name":"test"}',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/items',
      expect.objectContaining({
        method: 'POST',
        body: '{"name":"test"}',
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  // --- GET does not send body ---

  it('does not send body for GET requests even if provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeFetchResponse('ok'));

    await tool.execute({
      url: 'https://api.example.com/',
      method: 'GET',
      body: 'should-be-ignored',
    });

    const callArgs = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(callArgs.body).toBeUndefined();
  });

  // --- Non-2xx still returns success:true ---

  it('returns success:true for non-2xx responses (agent decides what to do)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(makeFetchResponse('Not Found', 404));

    const result = await tool.execute({ url: 'https://api.example.com/missing' }) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.status).toBe(404);
    expect(result.body).toBe('Not Found');
  });

  // --- Timeout ---

  it('returns error when request times out', async () => {
    vi.mocked(fetch).mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          // Listen for the abort signal and reject with AbortError
          const signal = (init as RequestInit).signal as AbortSignal;
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    const result = await tool.execute({
      url: 'https://api.example.com/slow',
      timeout: 10, // 10ms — will abort almost instantly
    }) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/timed out/i);
  });

  // --- Network error ---

  it('returns error on network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await tool.execute({ url: 'https://api.example.com/' }) as Record<string, unknown>;

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('ECONNREFUSED');
  });

  // --- builtinToolNames includes http ---

  it('is registered in createBuiltinTools', async () => {
    const { createBuiltinTools, builtinToolNames } = await import('../tools/builtin/index.js');
    const tools = createBuiltinTools();
    expect(tools.find((t) => t.name === 'http')).toBeDefined();
    expect(builtinToolNames).toContain('http');
  });
});
