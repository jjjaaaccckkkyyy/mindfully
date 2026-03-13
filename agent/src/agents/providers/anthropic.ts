import type { LLMProvider, LLMConfig, Message, AIMessage, CostInfo, ToolSchema } from './base.js';

export interface AnthropicConfig {
  provider?: 'anthropic';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

// ---------------------------------------------------------------------------
// Anthropic wire-format types
// ---------------------------------------------------------------------------

interface AnthropicTextContent {
  type: 'text';
  text: string;
}

interface AnthropicToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface AnthropicToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

type AnthropicContent = AnthropicTextContent | AnthropicToolUseContent;

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContent[] | AnthropicToolResultContent[];
}

interface AnthropicToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

interface AnthropicResponse {
  content: AnthropicContent[];
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  config: LLMConfig;

  private readonly apiKey: string;
  private readonly connectTimeoutMs: number;
  private readonly idleTimeoutMs: number;

  private static readonly MODEL_PRICES: Record<string, { input: number; output: number }> = {
    'claude-opus-4-5-20241022':   { input: 15.0, output: 75.0 },
    'claude-sonnet-4-20241022':   { input: 3.0,  output: 15.0 },
    'claude-haiku-3-20240307':    { input: 0.8,  output: 4.0  },
  };

  constructor(config: AnthropicConfig = {}) {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }
    this.apiKey = apiKey;
    this.connectTimeoutMs = parseInt(process.env.LLM_CONNECT_TIMEOUT_MS ?? '15000', 10);
    this.idleTimeoutMs = parseInt(process.env.LLM_IDLE_TIMEOUT_MS ?? '30000', 10);

    this.config = {
      provider: 'anthropic',
      model: config.model ?? 'claude-3-5-haiku-20241022',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      apiKey,
      baseURL: 'https://api.anthropic.com',
    };
  }

  // ---------------------------------------------------------------------------
  // Message mappers
  // ---------------------------------------------------------------------------

  toAnthropicMessages(messages: Message[]): { system: string; messages: AnthropicMessage[] } {
    // Extract system prompt
    const systemParts: string[] = [];
    const rest: Message[] = [];
    for (const m of messages) {
      if (m.role === 'system') {
        systemParts.push(m.content);
      } else {
        rest.push(m);
      }
    }
    const system = systemParts.join('\n\n');

    const mapped: AnthropicMessage[] = rest.map((m) => {
      if (m.role === 'tool') {
        // Tool results → user message with tool_result content block
        return {
          role: 'user' as const,
          content: [
            {
              type: 'tool_result' as const,
              tool_use_id: m.toolCallId ?? 'unknown',
              content: m.content,
            } as AnthropicToolResultContent,
          ],
        };
      }

      if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
        // Assistant with tool calls → content array
        const content: AnthropicContent[] = [];
        if (m.content) {
          content.push({ type: 'text', text: m.content });
        }
        for (const tc of m.tool_calls) {
          let input: Record<string, unknown>;
          try {
            input = typeof tc.args === 'string' ? JSON.parse(tc.args) : (tc.args as Record<string, unknown>);
          } catch {
            input = { raw: tc.args };
          }
          content.push({
            type: 'tool_use',
            id: tc.id ?? 'unknown',
            name: tc.name,
            input,
          });
        }
        return { role: 'assistant' as const, content };
      }

      return { role: m.role as 'user' | 'assistant', content: m.content };
    });

    return { system, messages: mapped };
  }

  toAnthropicTools(tools: ToolSchema[]): Record<string, unknown>[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  private buildBody(
    system: string,
    messages: AnthropicMessage[],
    tools: ToolSchema[],
    stream: boolean,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages,
      stream,
    };
    if (system) {
      body.system = system;
    }
    if (tools.length > 0) {
      body.tools = this.toAnthropicTools(tools);
    }
    return body;
  }

  // ---------------------------------------------------------------------------
  // invoke
  // ---------------------------------------------------------------------------

  async invoke(messages: Message[], tools: ToolSchema[] = []): Promise<AIMessage> {
    const { system, messages: mapped } = this.toAnthropicMessages(messages);

    const connectAbort = new AbortController();
    const connectTimer = setTimeout(
      () => connectAbort.abort(new Error(`Connect timeout after ${this.connectTimeoutMs}ms`)),
      this.connectTimeoutMs,
    );
    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(this.buildBody(system, mapped, tools, false)),
        signal: connectAbort.signal,
      });
    } finally {
      clearTimeout(connectTimer);
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as AnthropicResponse;

    let content = '';
    const tool_calls: Array<{ name: string; args: string; id: string }> = [];

    for (const block of data.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        tool_calls.push({
          name: block.name,
          args: JSON.stringify(block.input),
          id: block.id,
        });
      }
    }

    return { content, ...(tool_calls.length > 0 ? { tool_calls } : {}), usage: {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    } };
  }

  // ---------------------------------------------------------------------------
  // stream
  // ---------------------------------------------------------------------------

  async *stream(messages: Message[], tools: ToolSchema[] = []): AsyncGenerator<AIMessage> {
    const { system, messages: mapped } = this.toAnthropicMessages(messages);

    const connectAbort = new AbortController();
    const connectTimer = setTimeout(
      () => connectAbort.abort(new Error(`Connect timeout after ${this.connectTimeoutMs}ms`)),
      this.connectTimeoutMs,
    );
    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(this.buildBody(system, mapped, tools, true)),
        signal: connectAbort.signal,
      });
    } finally {
      clearTimeout(connectTimer);
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    if (!response.body) {
      throw new Error('Anthropic: no response body for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // Accumulate tool_use blocks by index
    const toolBlocks: Record<number, { id: string; name: string; input: string }> = {};
    let buffer = '';
    let currentBlockIndex = -1;
    let currentBlockType = '';
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await this.readWithIdleTimeout(reader);
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let eventType = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('event: ')) {
          eventType = trimmed.slice(7);
          continue;
        }

        if (!trimmed.startsWith('data: ')) continue;

        if (eventType === 'message_stop') break;

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
        } catch {
          continue;
        }

        if (eventType === 'message_start') {
          const msg = payload.message as { usage?: { input_tokens?: number } } | undefined;
          if (msg?.usage?.input_tokens != null) {
            inputTokens = msg.usage.input_tokens;
          }
          continue;
        }

        if (eventType === 'content_block_start') {
          const block = payload.content_block as { type: string; id?: string; name?: string } | undefined;
          currentBlockIndex = (payload.index as number) ?? -1;
          currentBlockType = block?.type ?? '';
          if (currentBlockType === 'tool_use') {
            toolBlocks[currentBlockIndex] = {
              id: block?.id ?? '',
              name: block?.name ?? '',
              input: '',
            };
          }
          continue;
        }

        if (eventType === 'content_block_delta') {
          const delta = payload.delta as { type: string; text?: string; partial_json?: string } | undefined;
          if (!delta) continue;
          if (delta.type === 'text_delta' && delta.text) {
            yield { content: delta.text };
          } else if (delta.type === 'input_json_delta' && delta.partial_json) {
            if (toolBlocks[currentBlockIndex]) {
              toolBlocks[currentBlockIndex]!.input += delta.partial_json;
            }
          }
          continue;
        }

        if (eventType === 'message_delta') {
          const delta = payload.delta as { stop_reason?: string } | undefined;
          const usageField = payload.usage as { output_tokens?: number } | undefined;
          if (usageField?.output_tokens != null) {
            outputTokens = usageField.output_tokens;
          }
          if (delta?.stop_reason === 'tool_use' || delta?.stop_reason === 'end_turn') {
            const accumulated = Object.values(toolBlocks);
            if (accumulated.length > 0) {
              yield {
                content: '',
                tool_calls: accumulated.map((tc) => ({
                  name: tc.name,
                  args: tc.input,
                  id: tc.id,
                })),
              };
            }
          }
          continue;
        }
      }
    }

    // Yield final usage chunk after stream completes
    if (inputTokens > 0 || outputTokens > 0) {
      yield {
        content: '',
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // getCost
  // ---------------------------------------------------------------------------

  getCost(usage: { inputTokens: number; outputTokens: number }): CostInfo {
    const prices = AnthropicProvider.MODEL_PRICES[this.config.model] ?? { input: 3.0, output: 15.0 };

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

  // ---------------------------------------------------------------------------
  // Idle timeout helper
  // ---------------------------------------------------------------------------

  private readWithIdleTimeout(
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
}
