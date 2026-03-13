import type { LLMProvider, LLMConfig, Message, AIMessage, CostInfo, ToolSchema } from './base.js';

// ---------------------------------------------------------------------------
// Wire-format types (OpenAI chat completions API)
// ---------------------------------------------------------------------------

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIResponse {
  choices: Array<{
    message: OpenAIMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIStreamChunk {
  choices: Array<{
    delta: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// Constructor config
// ---------------------------------------------------------------------------

export interface OpenAICompatConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  temperature: number;
  maxTokens: number;
  connectTimeoutMs?: number;
  idleTimeoutMs?: number;
  streamUsage?: boolean;
}

// ---------------------------------------------------------------------------
// Abstract base class
// ---------------------------------------------------------------------------

export abstract class OpenAICompatProvider implements LLMProvider {
  abstract name: string;
  config: LLMConfig;

  protected readonly baseURL: string;
  protected readonly apiKey: string;
  protected readonly connectTimeoutMs: number;
  protected readonly idleTimeoutMs: number;
  protected readonly streamUsage: boolean;

  constructor(cfg: OpenAICompatConfig) {
    this.baseURL = cfg.baseURL;
    this.apiKey = cfg.apiKey;
    this.connectTimeoutMs = cfg.connectTimeoutMs ?? 15000;
    this.idleTimeoutMs = cfg.idleTimeoutMs ?? 30000;
    this.streamUsage = cfg.streamUsage ?? false;

    this.config = {
      provider: '',      // subclass sets via `name`
      model: cfg.model,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
      apiKey: cfg.apiKey,
      baseURL: cfg.baseURL,
    };
  }

  // ---------------------------------------------------------------------------
  // Message / tool mappers
  // ---------------------------------------------------------------------------

  toOpenAIMessages(messages: Message[]): OpenAIMessage[] {
    return messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.content,
          tool_call_id: m.toolCallId ?? 'unknown',
        };
      }
      const msg: OpenAIMessage = { role: m.role, content: m.content };
      if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
        msg.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id ?? 'unknown',
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args),
          },
        }));
      }
      return msg;
    });
  }

  toOpenAITools(tools: ToolSchema[]): Record<string, unknown>[] {
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  buildBody(
    messages: Message[],
    tools: ToolSchema[],
    stream: boolean,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: this.toOpenAIMessages(messages),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream,
    };
    if (stream && this.streamUsage) {
      body.stream_options = { include_usage: true };
    }
    if (tools.length > 0) {
      body.tools = this.toOpenAITools(tools);
      body.tool_choice = 'auto';
    }
    return body;
  }

  // ---------------------------------------------------------------------------
  // invoke
  // ---------------------------------------------------------------------------

  async invoke(messages: Message[], tools: ToolSchema[] = []): Promise<AIMessage> {
    const connectAbort = new AbortController();
    const connectTimer = setTimeout(
      () => connectAbort.abort(new Error(`Connect timeout after ${this.connectTimeoutMs}ms`)),
      this.connectTimeoutMs,
    );
    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(this.buildBody(messages, tools, false)),
        signal: connectAbort.signal,
      });
    } finally {
      clearTimeout(connectTimer);
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${this.name} API error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const msg = data.choices[0]?.message;
    const content = msg?.content ?? '';
    const tool_calls = msg?.tool_calls?.map((tc) => ({
      name: tc.function.name,
      args: tc.function.arguments,
      id: tc.id,
    }));

    const result: AIMessage = { content, ...(tool_calls && tool_calls.length > 0 ? { tool_calls } : {}) };
    if (data.usage) {
      result.usage = {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      };
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // stream
  // ---------------------------------------------------------------------------

  async *stream(messages: Message[], tools: ToolSchema[] = []): AsyncGenerator<AIMessage> {
    const connectAbort = new AbortController();
    const connectTimer = setTimeout(
      () => connectAbort.abort(new Error(`Connect timeout after ${this.connectTimeoutMs}ms`)),
      this.connectTimeoutMs,
    );
    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(this.buildBody(messages, tools, true)),
        signal: connectAbort.signal,
      });
    } finally {
      clearTimeout(connectTimer);
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${this.name} API error ${response.status}: ${err}`);
    }

    if (!response.body) {
      throw new Error(`${this.name}: no response body for streaming`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const toolCallAccum: Record<number, { id: string; name: string; arguments: string }> = {};
    let buffer = '';

    while (true) {
      const { done, value } = await this.readWithIdleTimeout(reader);
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        let chunk: OpenAIStreamChunk;
        try {
          chunk = JSON.parse(trimmed.slice(6)) as OpenAIStreamChunk;
        } catch {
          continue;
        }

        const delta = chunk.choices[0]?.delta;
        const finishReason = chunk.choices[0]?.finish_reason;

        // Trailing usage-only chunk (choices is empty but usage is populated)
        if (chunk.choices.length === 0 && chunk.usage) {
          yield {
            content: '',
            usage: {
              inputTokens: chunk.usage.prompt_tokens,
              outputTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            },
          };
          continue;
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallAccum[tc.index]) {
              toolCallAccum[tc.index] = { id: '', name: '', arguments: '' };
            }
            if (tc.id) toolCallAccum[tc.index]!.id = tc.id;
            if (tc.function?.name) toolCallAccum[tc.index]!.name += tc.function.name;
            if (tc.function?.arguments) toolCallAccum[tc.index]!.arguments += tc.function.arguments;
          }
        }

        if (delta?.content) {
          yield { content: delta.content };
        }

        if (finishReason === 'tool_calls' || finishReason === 'stop') {
          const accumulated = Object.values(toolCallAccum);
          if (accumulated.length > 0) {
            yield {
              content: '',
              tool_calls: accumulated.map((tc) => ({
                name: tc.name,
                args: tc.arguments,
                id: tc.id,
              })),
            };
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Idle timeout helper
  // ---------------------------------------------------------------------------

  protected readWithIdleTimeout(
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ): Promise<{ done: boolean; value: Uint8Array | undefined }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Stream idle timeout: no data received for ${this.idleTimeoutMs}ms`)),
        this.idleTimeoutMs,
      );
      reader.read().then(
        (result) => {
          clearTimeout(timer);
          resolve({ done: result.done, value: result.value });
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  // ---------------------------------------------------------------------------
  // getCost — must be implemented by subclass
  // ---------------------------------------------------------------------------

  abstract getCost(usage: { inputTokens: number; outputTokens: number }): CostInfo;
}
