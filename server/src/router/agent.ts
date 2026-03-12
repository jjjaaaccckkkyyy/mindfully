import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { agentsRepository } from '../db/repositories/agents';
import { executionsRepository } from '../db/repositories/executions';
import { memoriesRepository } from '../db/repositories/memories';

export const agentRouter = router({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit || 50;
      const offset = input?.offset || 0;
      return agentsRepository.findByUserId(ctx.userId, limit, offset);
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const agent = await agentsRepository.findById(input.id);
      if (!agent || agent.user_id !== ctx.userId) {
        return null;
      }
      return agent;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().max(1000).optional(),
      model: z.string().optional(),
      tools: z.array(z.string()).optional(),
      memoryEnabled: z.boolean().optional(),
      systemPrompt: z.string().optional(),
      maxTokens: z.number().optional(),
      temperature: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return agentsRepository.create({
        user_id: ctx.userId,
        name: input.name,
        description: input.description,
        model: input.model,
        tools: input.tools,
        memory_enabled: input.memoryEnabled,
        system_prompt: input.systemPrompt,
        max_tokens: input.maxTokens,
        temperature: input.temperature,
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().max(1000).optional(),
      model: z.string().optional(),
      tools: z.array(z.string()).optional(),
      memoryEnabled: z.boolean().optional(),
      systemPrompt: z.string().optional(),
      maxTokens: z.number().optional(),
      temperature: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;
      const agent = await agentsRepository.findById(id);
      if (!agent || agent.user_id !== ctx.userId) {
        throw new Error('Agent not found');
      }
      return agentsRepository.update(id, {
        name: updateData.name,
        description: updateData.description,
        model: updateData.model,
        tools: updateData.tools,
        memory_enabled: updateData.memoryEnabled,
        system_prompt: updateData.systemPrompt,
        max_tokens: updateData.maxTokens,
        temperature: updateData.temperature,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const agent = await agentsRepository.findById(input.id);
      if (!agent || agent.user_id !== ctx.userId) {
        throw new Error('Agent not found');
      }
      await executionsRepository.deleteByAgentId(input.id);
      await memoriesRepository.deleteByAgentId(input.id);
      return agentsRepository.delete(input.id);
    }),

  count: protectedProcedure
    .query(async ({ ctx }) => {
      return agentsRepository.count(ctx.userId);
    }),
});

export const executionRouter = router({
  run: protectedProcedure
    .input(z.object({
      agentId: z.string(),
      input: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const agent = await agentsRepository.findById(input.agentId);
      if (!agent || agent.user_id !== ctx.userId) {
        throw new Error('Agent not found');
      }
      
      const execution = await executionsRepository.create({
        agent_id: input.agentId,
        input: input.input,
      });

      await executionsRepository.update(execution.id, {
        status: 'running',
      });

      return execution;
    }),

  status: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const execution = await executionsRepository.findById(input.id);
      if (!execution) {
        return null;
      }
      const agent = await agentsRepository.findById(execution.agent_id);
      if (!agent || agent.user_id !== ctx.userId) {
        return null;
      }
      return execution;
    }),

  history: protectedProcedure
    .input(z.object({
      agentId: z.string(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const agent = await agentsRepository.findById(input.agentId);
      if (!agent || agent.user_id !== ctx.userId) {
        throw new Error('Agent not found');
      }
      return executionsRepository.findByAgentId(input.agentId, input.limit, input.offset);
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const execution = await executionsRepository.findById(input.id);
      if (!execution) {
        throw new Error('Execution not found');
      }
      const agent = await agentsRepository.findById(execution.agent_id);
      if (!agent || agent.user_id !== ctx.userId) {
        throw new Error('Execution not found');
      }
      return executionsRepository.update(input.id, {
        status: 'failed',
        error: 'Cancelled by user',
        completed_at: new Date(),
      });
    }),
});

export const memoryRouter = router({
  search: protectedProcedure
    .input(z.object({
      query: z.string().optional(),
      agentId: z.string().optional(),
      memoryType: z.enum(['user', 'system', 'working', 'all']).optional(),
      limit: z.number().min(1).max(100).default(10),
    }))
    .query(async ({ ctx, input }) => {
      return memoriesRepository.search({
        userId: ctx.userId,
        agentId: input.agentId,
        query: input.query,
        memoryType: input.memoryType || 'all',
        limit: input.limit,
      });
    }),

  add: protectedProcedure
    .input(z.object({
      agentId: z.string().optional(),
      content: z.string(),
      memoryType: z.enum(['user', 'system', 'working']).default('user'),
      metadata: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.agentId) {
        const agent = await agentsRepository.findById(input.agentId);
        if (!agent || agent.user_id !== ctx.userId) {
          throw new Error('Agent not found');
        }
      }
      return memoriesRepository.create({
        user_id: ctx.userId,
        agent_id: input.agentId,
        content: input.content,
        memory_type: input.memoryType,
        metadata: input.metadata,
      });
    }),

  list: protectedProcedure
    .input(z.object({
      agentId: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      if (input.agentId) {
        const agent = await agentsRepository.findById(input.agentId);
        if (!agent || agent.user_id !== ctx.userId) {
          throw new Error('Agent not found');
        }
        return memoriesRepository.findByAgentId(input.agentId, input.limit, input.offset);
      }
      return memoriesRepository.findByUserId(ctx.userId, input.limit, input.offset);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const memory = await memoriesRepository.findById(input.id);
      if (!memory || memory.user_id !== ctx.userId) {
        throw new Error('Memory not found');
      }
      return memoriesRepository.delete(input.id);
    }),
});

export const toolRouter = router({
  list: protectedProcedure
    .query(async () => {
      return [
        { name: 'read', description: 'Read file contents' },
        { name: 'write', description: 'Write content to a file' },
        { name: 'edit', description: 'Edit a file by replacing text' },
        { name: 'bash', description: 'Execute shell commands' },
      ];
    }),
});
