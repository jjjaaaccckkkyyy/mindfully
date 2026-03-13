import express from 'express';
import type { Request, Response, Router } from 'express';
import { AgentRunner, buildSystemPrompt } from 'agent';
import { ContextManager, type StoredMessage } from 'core';
import { verifyIdToken } from '../auth/utils/id-token.js';
import { agentsRepository } from '../db/repositories/agents.js';
import {
  agentSessionsRepository,
  sessionMessagesRepository,
} from '../db/repositories/agent-sessions.js';
import { executionsRepository } from '../db/repositories/executions.js';
import { getBuiltinTools, executeTool } from '../tools/index.js';
import { logger } from '../logger.js';

const router: Router = express.Router();

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function sendEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── Title generation (async, fire-and-forget) ────────────────────────────────

async function generateTitle(
  sessionId: string,
  firstUserMessage: string,
  openaiApiKey?: string,
): Promise<void> {
  if (!openaiApiKey) {
    // Fallback: truncate first message
    const fallback = firstUserMessage.slice(0, 50);
    await agentSessionsRepository.update(sessionId, { title: fallback });
    return;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Generate a short, descriptive title (max 6 words) for this conversation based on the first user message. Reply with only the title — no quotes, no punctuation.',
          },
          { role: 'user', content: firstUserMessage },
        ],
        temperature: 0.5,
        max_tokens: 20,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        choices: Array<{ message: { content: string | null } }>;
      };
      const title = data.choices[0]?.message?.content?.trim() || firstUserMessage.slice(0, 50);
      await agentSessionsRepository.update(sessionId, { title });
    }
  } catch (err) {
    logger.warn('Failed to generate session title', {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
    await agentSessionsRepository.update(sessionId, {
      title: firstUserMessage.slice(0, 50),
    });
  }
}

// ─── POST /agent/:agentId/run ─────────────────────────────────────────────────

router.post('/agent/:agentId/run', async (req: Request, res: Response) => {
  // --- Auth ---
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const payload = verifyIdToken(token);
  if (!payload?.sub) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  const userId = payload.sub;

  // --- Validate agent ---
  const agentId = String(req.params['agentId']);
  const agent = await agentsRepository.findById(agentId);
  if (!agent || agent.user_id !== userId) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const { sessionId: inputSessionId, message } = req.body as {
    sessionId?: string;
    message: string;
  };

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  // --- SSE headers ---
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    // --- Load or create session ---
    let session = inputSessionId
      ? await agentSessionsRepository.findById(inputSessionId)
      : null;

    if (!session) {
      session = await agentSessionsRepository.create({
        agent_id: agentId,
        user_id: userId,
      });
    }

    const sessionId = session.id;
    const isFirstMessage = (await sessionMessagesRepository.count(sessionId)) === 0;

    // --- Persist user message ---
    const userSeq = await sessionMessagesRepository.nextSequenceNumber(sessionId);
    await sessionMessagesRepository.create({
      session_id: sessionId,
      sequence_number: userSeq,
      role: 'user',
      content: message,
    });

    // --- Async title generation on first message ---
    if (isFirstMessage && !session.title) {
      generateTitle(sessionId, message, process.env.OPENAI_API_KEY).catch(() => {
        // swallow — title is cosmetic
      });
    }

    // --- Build context ---
    const tools = getBuiltinTools();
    const systemPrompt = await buildSystemPrompt({
      tools,
      workspaceDir: process.cwd(),
      agentSystemPrompt: agent.system_prompt ?? undefined,
    });
    const contextManager = new ContextManager({ systemPrompt });
    const allStoredMessages = (await sessionMessagesRepository.findBySessionId(sessionId, 1000)).items;
    const sessionRecord = {
      id: session.id,
      agentId: session.agent_id,
      summary: session.summary,
      summaryUpTo: session.summary_up_to,
    };
    const contextMessages = await contextManager.buildMessages(sessionRecord, allStoredMessages.map(toStoredMessage));

    // --- Maybe summarise (async, non-blocking) ---
    contextManager.maybeSummarise(sessionRecord, allStoredMessages.map(toStoredMessage)).then(async (update) => {
      if (update) {
        await agentSessionsRepository.update(sessionId, {
          summary: update.summary,
          summary_up_to: update.summaryUpTo,
        });
      }
    }).catch(() => {
      // swallow summarisation errors
    });

    // --- Create execution record ---
    const execution = await executionsRepository.create({
      agent_id: agentId,
      input: message,
    });
    await executionsRepository.update(execution.id, { status: 'running' });

    // --- Run agent stream ---
    const runner = new AgentRunner();
    const newMessages: Array<{
      role: 'assistant' | 'tool';
      content: string;
      tool_calls?: Array<{ name: string; args: Record<string, unknown>; id?: string }>;
      toolCallId?: string;
      toolName?: string;
    }> = [];

    let totalTokens = 0;
    let costUsd = 0;

    for await (const event of runner.stream({
      input: message,
      tools,
      toolExecutor: (name, args) => executeTool(name, args, { workspaceDir: process.cwd() }),
      history: contextMessages,
    })) {
      switch (event.type) {
        case 'token':
          sendEvent(res, 'chunk', { content: event.content });
          break;

        case 'tool_start':
          sendEvent(res, 'tool', { phase: 'start', name: event.name, args: event.args, id: event.id });
          break;

        case 'tool_result':
          sendEvent(res, 'tool', {
            phase: 'result',
            name: event.name,
            result: event.result,
            error: event.error,
            id: event.id,
          });
          // Collect tool message
          newMessages.push({
            role: 'tool',
            content: event.error ?? JSON.stringify(event.result),
            toolCallId: event.id,
            toolName: event.name,
          });
          break;

        case 'done': {
          // Collect assistant messages from done event
          const assistantMsgs = event.messages.filter(
            (m) => m.role === 'assistant' || m.role === 'tool',
          );
          // Only include messages that are new (not already in context)
          const contextLen = contextMessages.filter((m) => m.role !== 'system').length;
          const freshMsgs = assistantMsgs.slice(contextLen);
          for (const m of freshMsgs) {
            if (m.role === 'assistant') {
              newMessages.push({
                role: 'assistant',
                content: m.content,
                ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
              });
            }
          }

          if (event.cost) {
            totalTokens = event.cost.inputTokens + event.cost.outputTokens;
            costUsd = event.cost.totalCost;
          }

          sendEvent(res, 'done', {
            sessionId,
            cost: event.cost
              ? { inputTokens: event.cost.inputTokens, outputTokens: event.cost.outputTokens, totalCost: event.cost.totalCost }
              : null,
          });
          break;
        }

        case 'error':
          sendEvent(res, 'error', { message: event.message });
          await executionsRepository.update(execution.id, {
            status: 'failed',
            error: event.message,
            completed_at: new Date(),
          });
          res.end();
          return;
      }
    }

    // --- Persist new assistant/tool messages ---
    let seq = userSeq + 1;
    const messagesToPersist = newMessages.map((m) => ({
      session_id: sessionId,
      sequence_number: seq++,
      role: m.role,
      content: m.content,
      tool_calls: m.tool_calls,
      tool_call_id: m.toolCallId,
      tool_name: m.toolName,
    }));
    const persistedMessages = await sessionMessagesRepository.createBatch(messagesToPersist);

    // --- Upsert to Qdrant (fire-and-forget) ---
    const qdrantMessages: StoredMessage[] = persistedMessages.map((pm) => ({
      id: pm.id,
      sessionId: pm.session_id,
      sequenceNumber: pm.sequence_number,
      role: pm.role,
      content: pm.content,
      toolCalls: pm.tool_calls ?? undefined,
      toolCallId: pm.tool_call_id ?? undefined,
      toolName: pm.tool_name ?? undefined,
      tokenCount: pm.token_count,
      createdAt: pm.created_at,
    }));
    contextManager.upsertMessages(agentId, qdrantMessages).catch(() => {
      // swallow
    });

    // Also upsert the user message
    const userMsg = allStoredMessages[allStoredMessages.length - 1];
    if (userMsg) {
      contextManager.upsertMessages(agentId, [toStoredMessage(userMsg)]).catch(() => {});
    }

    // --- Update execution record ---
    await executionsRepository.update(execution.id, {
      status: 'completed',
      completed_at: new Date(),
      token_usage: { inputTokens: 0, outputTokens: 0, totalTokens },
    });

    // Update session_id on execution
    await executionsRepository.linkSession(execution.id, sessionId);

    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    logger.error('SSE agent stream error', { agentId, error: message });
    try {
      sendEvent(res, 'error', { message });
    } catch {
      // response may already be flushed
    }
    res.end();
  }
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function toStoredMessage(m: {
  id: string;
  session_id: string;
  sequence_number: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls: Array<{ name: string; args: Record<string, unknown>; id?: string }> | null;
  tool_call_id: string | null;
  tool_name: string | null;
  token_count: number;
  created_at: Date;
}): StoredMessage {
  return {
    id: m.id,
    sessionId: m.session_id,
    sequenceNumber: m.sequence_number,
    role: m.role,
    content: m.content,
    toolCalls: m.tool_calls ?? undefined,
    toolCallId: m.tool_call_id ?? undefined,
    toolName: m.tool_name ?? undefined,
    tokenCount: m.token_count,
    createdAt: m.created_at,
  };
}

export default router;
