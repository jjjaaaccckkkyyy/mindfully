import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { agentSessionsRepository, sessionMessagesRepository } from '../db/repositories/agent-sessions.js';
import { agentsRepository } from '../db/repositories/agents.js';

const DEFAULT_MESSAGES_LIMIT = 50;

export const sessionRouter = router({
  /**
   * Create a new session for an agent.
   */
  create: protectedProcedure
    .input(z.object({ agentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const agent = await agentsRepository.findById(input.agentId);
      if (!agent || agent.user_id !== ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
      }
      return agentSessionsRepository.create({
        agent_id: input.agentId,
        user_id: ctx.userId,
      });
    }),

  /**
   * List sessions for an agent (cursor-based pagination).
   */
  list: protectedProcedure
    .input(
      z.object({
        agentId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const agent = await agentsRepository.findById(input.agentId);
      if (!agent || agent.user_id !== ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agent not found' });
      }
      return agentSessionsRepository.findByAgentId(input.agentId, input.limit, input.cursor);
    }),

  /**
   * Get a session by ID, including the last N messages.
   */
  get: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        messageLimit: z.number().min(1).max(200).default(DEFAULT_MESSAGES_LIMIT),
      }),
    )
    .query(async ({ ctx, input }) => {
      const session = await agentSessionsRepository.findById(input.sessionId);
      if (!session || session.user_id !== ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
      }

      const messages = await sessionMessagesRepository.getLastN(
        input.sessionId,
        input.messageLimit,
      );

      return { session, messages };
    }),

  /**
   * Full paginated message history for a session.
   */
  messages: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        limit: z.number().min(1).max(200).default(DEFAULT_MESSAGES_LIMIT),
        cursor: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const session = await agentSessionsRepository.findById(input.sessionId);
      if (!session || session.user_id !== ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
      }
      return sessionMessagesRepository.findBySessionId(input.sessionId, input.limit, input.cursor);
    }),

  /**
   * Archive a session.
   */
  archive: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await agentSessionsRepository.findById(input.sessionId);
      if (!session || session.user_id !== ctx.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
      }
      const updated = await agentSessionsRepository.archive(input.sessionId);
      if (!updated) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to archive session' });
      }
      return updated;
    }),
});
