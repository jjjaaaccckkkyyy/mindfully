import { createLogger } from '../logger.js';
import { createEmbeddingProvider, type EmbeddingProvider } from './embeddings.js';
import { QdrantClient } from './qdrant.js';

const logger = createLogger('core:context-manager');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContextMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{ name: string; args: Record<string, unknown>; id?: string }>;
  toolCallId?: string;
  toolName?: string;
}

export interface SessionSummaryUpdate {
  summary: string;
  summaryUpTo: number;
}

export interface ContextManagerConfig {
  qdrantUrl?: string;
  qdrantApiKey?: string;
  openaiApiKey?: string;
  windowSize?: number;
  summariseThreshold?: number;
  ragResults?: number;
  summaryModel?: string;
  /**
   * Base URL for the summary LLM endpoint.
   * Defaults to `process.env.SUMMARY_BASE_URL` → `https://api.openai.com/v1`.
   */
  summaryBaseUrl?: string;
  /**
   * Pre-built system prompt string. When set it is injected as the very first
   * message (`role: 'system'`) in the array returned by `buildMessages()`,
   * before any RAG or summary messages.
   */
  systemPrompt?: string;
}

export interface StoredMessage {
  id: string;
  sessionId: string;
  sequenceNumber: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; id?: string }>;
  toolCallId?: string;
  toolName?: string;
  tokenCount: number;
  createdAt: Date;
}

export interface SessionRecord {
  id: string;
  agentId: string;
  summary?: string | null;
  summaryUpTo?: number;
}

// ─── OpenAI chat helper (raw fetch, same pattern as OpenCodeZenProvider) ───────

interface OpenAIChatResponse {
  choices: Array<{ message: { content: string | null } }>;
}

async function llmComplete(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string,
  baseUrl: string = process.env['SUMMARY_BASE_URL'] ?? 'https://opencode.ai/zen/v1',
): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI chat completions error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as OpenAIChatResponse;
  return data.choices[0]?.message?.content ?? '';
}

// ─── ContextManager ───────────────────────────────────────────────────────────

export class ContextManager {
  private embeddingProvider: EmbeddingProvider;
  private qdrantClient?: QdrantClient;
  private openaiApiKey?: string;
  private windowSize: number;
  private summariseThreshold: number;
  private ragResults: number;
  private summaryModel: string;
  private summaryBaseUrl: string;
  private systemPrompt?: string;

  constructor(config: ContextManagerConfig = {}) {
    this.systemPrompt = config.systemPrompt;
    this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    this.windowSize = config.windowSize ?? parseInt(process.env.CONTEXT_WINDOW_SIZE || '20', 10);
    this.summariseThreshold = config.summariseThreshold ?? parseInt(process.env.CONTEXT_SUMMARISE_THRESHOLD || '40', 10);
    this.ragResults = config.ragResults ?? parseInt(process.env.CONTEXT_RAG_RESULTS || '5', 10);
    this.summaryModel = config.summaryModel || process.env.SUMMARY_MODEL || 'glm-5';
    this.summaryBaseUrl = config.summaryBaseUrl || process.env['SUMMARY_BASE_URL'] || 'https://opencode.ai/zen/v1';

    this.embeddingProvider = createEmbeddingProvider(this.openaiApiKey);

    const qdrantUrl = config.qdrantUrl || process.env.QDRANT_URL;
    if (qdrantUrl) {
      this.qdrantClient = new QdrantClient({
        url: qdrantUrl,
        apiKey: config.qdrantApiKey || process.env.QDRANT_API_KEY,
      });
    }
  }

  /**
   * Collection name for a given agent — one collection per agent.
   */
  collectionName(agentId: string): string {
    return `agent_${agentId}_messages`;
  }

  /**
   * Ensure the Qdrant collection for an agent exists (lazy creation).
   */
  async ensureCollection(agentId: string): Promise<void> {
    if (!this.qdrantClient) return;
    try {
      await this.qdrantClient.ensureCollection(
        this.collectionName(agentId),
        this.embeddingProvider.dimensions,
      );
    } catch (err) {
      logger.warn('Failed to ensure Qdrant collection', {
        agentId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Upsert messages into Qdrant for future RAG retrieval.
   * Safe to call fire-and-forget (errors are logged, not thrown).
   */
  async upsertMessages(agentId: string, messages: StoredMessage[]): Promise<void> {
    if (!this.qdrantClient || messages.length === 0) return;
    const collectionName = this.collectionName(agentId);

    try {
      await this.ensureCollection(agentId);

      const points = await Promise.all(
        messages.map(async (msg) => {
          const vector = await this.embeddingProvider.embed(msg.content);
          return {
            id: msg.id,
            vector,
            payload: {
              sessionId: msg.sessionId,
              role: msg.role,
              sequenceNumber: msg.sequenceNumber,
              content: msg.content,
              createdAt: msg.createdAt.toISOString(),
            },
          };
        }),
      );

      await this.qdrantClient.upsert(collectionName, points);
      logger.debug('Upserted messages to Qdrant', { agentId, count: points.length });
    } catch (err) {
      logger.warn('Failed to upsert messages to Qdrant', {
        agentId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Layer 1 — RAG: query Qdrant for relevant past messages based on the latest
   * user message. Returns injected system context messages.
   */
  async ragQuery(
    agentId: string,
    sessionId: string,
    latestUserMessage: string,
  ): Promise<ContextMessage[]> {
    if (!this.qdrantClient) return [];

    try {
      const queryVector = await this.embeddingProvider.embed(latestUserMessage);
      const results = await this.qdrantClient.search(
        this.collectionName(agentId),
        queryVector,
        {
          limit: this.ragResults,
          scoreThreshold: 0.5,
          filter: { sessionId: { '!=': sessionId } }, // cross-session RAG only
        },
      );

      if (results.length === 0) return [];

      const snippets = results
        .map((r) => `[${String(r.payload.role)}] ${String(r.payload.content)}`)
        .join('\n');

      return [
        {
          role: 'system',
          content:
            `Relevant context from previous conversations:\n${snippets}`,
        },
      ];
    } catch (err) {
      logger.warn('RAG query failed', {
        agentId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * Layer 2 — Summarisation: if total messages exceed the threshold, summarise
   * the oldest messages (up to `summaryUpTo` cursor) via LLM and return the
   * update to be persisted on the session.
   */
  async maybeSummarise(
    session: SessionRecord,
    messages: StoredMessage[],
  ): Promise<SessionSummaryUpdate | null> {
    if (!this.openaiApiKey) return null;
    if (messages.length <= this.summariseThreshold) return null;

    // Determine which messages haven't been summarised yet
    const summaryUpTo = session.summaryUpTo ?? 0;
    const unsummarised = messages.filter((m) => m.sequenceNumber > summaryUpTo);

    // Only summarise the oldest half of unsummarised messages
    const cutoff = Math.floor(unsummarised.length / 2);
    if (cutoff < 5) return null; // not enough to bother

    const toSummarise = unsummarised.slice(0, cutoff);
    const lastSeq = toSummarise[toSummarise.length - 1].sequenceNumber;

    const transcript = toSummarise
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const existingSummary = session.summary
      ? `Previous summary:\n${session.summary}\n\n`
      : '';

    try {
      const summary = await llmComplete(
        'You are a precise summariser. Summarise the conversation below into 3-5 sentences, preserving key facts, decisions, and tool results. Be concise.',
        `${existingSummary}New conversation to summarise:\n${transcript}`,
        this.openaiApiKey,
        this.summaryModel,
        this.summaryBaseUrl,
      );

      logger.debug('Generated session summary', {
        sessionId: session.id,
        summaryUpTo: lastSeq,
      });

      return { summary, summaryUpTo: lastSeq };
    } catch (err) {
      logger.warn('Failed to generate session summary', {
        sessionId: session.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Build the final message array for the AgentRunner from full message history.
   *
   * Pipeline:
   *   1. RAG: prepend relevant cross-session context as a system message
   *   2. Summary: prepend existing session summary as a system message
   *   3. Sliding window: keep only the last `windowSize` stored messages
   */
  async buildMessages(
    session: SessionRecord,
    messages: StoredMessage[],
  ): Promise<ContextMessage[]> {
    const result: ContextMessage[] = [];

    // --- Layer 0: System prompt (injected first, before all context) ---
    if (this.systemPrompt) {
      result.push({ role: 'system', content: this.systemPrompt });
    }

    // --- Layer 1: RAG ---
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      const ragMessages = await this.ragQuery(
        session.agentId,
        session.id,
        lastUserMsg.content,
      );
      result.push(...ragMessages);
    }

    // --- Layer 2: Summary ---
    if (session.summary) {
      result.push({
        role: 'system',
        content: `Summary of earlier conversation:\n${session.summary}`,
      });
    }

    // --- Layer 3: Sliding window ---
    const window = messages.slice(-this.windowSize);
    for (const msg of window) {
      result.push({
        role: msg.role,
        content: msg.content,
        ...(msg.toolCalls ? { tool_calls: msg.toolCalls } : {}),
        ...(msg.toolCallId ? { toolCallId: msg.toolCallId } : {}),
        ...(msg.toolName ? { toolName: msg.toolName } : {}),
      });
    }

    logger.debug('Built context window', {
      sessionId: session.id,
      ragMessages: result.filter((m) => m.role === 'system').length,
      windowMessages: window.length,
      total: result.length,
    });

    return result;
  }
}
