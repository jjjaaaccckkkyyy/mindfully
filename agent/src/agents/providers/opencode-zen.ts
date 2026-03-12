import type { LLMProvider, LLMConfig, Message, AIMessage, CostInfo, ToolSchema } from './base.js';

export interface OpenCodeZenConfig extends LLMConfig {
  provider: 'opencode-zen';
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIResponse {
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

interface OpenAIStreamChunk {
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
}

export class OpenCodeZenProvider implements LLMProvider {
  name = 'opencode-zen';
  config: OpenCodeZenConfig;

  constructor(config: Partial<OpenCodeZenConfig> = {}) {
    const apiKey = config.apiKey || process.env.OPENCODE_ZEN_API_KEY;

    if (!apiKey) {
      throw new Error('OPENCODE_ZEN_API_KEY is required');
    }

    this.config = {
      provider: 'opencode-zen',
      model: config.model || 'gpt-5.1-codex',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens || 4096,
      apiKey,
      baseURL: 'https://opencode.ai/zen/v1',
    };
  }

  private toOpenAIMessages(messages: Message[]): OpenAIMessage[] {
    return messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.content,
          tool_call_id: m.toolCallId || 'unknown',
        };
      }
      return { role: m.role, content: m.content };
    });
  }

  private toOpenAITools(tools: ToolSchema[]): Record<string, unknown>[] {
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  private buildBody(
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
    if (tools.length > 0) {
      body.tools = this.toOpenAITools(tools);
      body.tool_choice = 'auto';
    }
    return body;
  }

  async invoke(messages: Message[], tools: ToolSchema[] = []): Promise<AIMessage> {
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(this.buildBody(messages, tools, false)),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenCodeZen API error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const msg = data.choices[0]?.message;
    const content = msg?.content ?? '';
    const tool_calls = msg?.tool_calls?.map((tc) => ({
      name: tc.function.name,
      args: tc.function.arguments,
      id: tc.id,
    }));

    return { content, ...(tool_calls && tool_calls.length > 0 ? { tool_calls } : {}) };
  }

  async *stream(messages: Message[], tools: ToolSchema[] = []): AsyncGenerator<AIMessage> {
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(this.buildBody(messages, tools, true)),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenCodeZen API error ${response.status}: ${err}`);
    }

    if (!response.body) {
      throw new Error('OpenCodeZen: no response body for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // Accumulate tool call deltas keyed by index
    const toolCallAccum: Record<number, { id: string; name: string; arguments: string }> = {};
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
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
        if (!delta) continue;

        // Accumulate tool call argument fragments
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallAccum[tc.index]) {
              toolCallAccum[tc.index] = { id: '', name: '', arguments: '' };
            }
            if (tc.id) toolCallAccum[tc.index].id = tc.id;
            if (tc.function?.name) toolCallAccum[tc.index].name += tc.function.name;
            if (tc.function?.arguments) toolCallAccum[tc.index].arguments += tc.function.arguments;
          }
        }

        if (delta.content) {
          yield { content: delta.content };
        }

        // On final chunk (finish_reason set), emit accumulated tool calls
        const finishReason = chunk.choices[0]?.finish_reason;
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
