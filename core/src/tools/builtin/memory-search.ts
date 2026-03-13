import { z } from 'zod';
import { createLogger } from '../../logger.js';
import { createTool, type Tool, type ToolContext } from '../index.js';
import type { MemoryService } from '../../memory/service.js';

const logger = createLogger('core:memory-search');

const MemorySearchSchema = z.object({
  query: z.string().describe('Natural language query to search memories'),
  userId: z.string().describe('User ID to scope the search'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum results to return (default: 10)'),
  scoreThreshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Minimum similarity score (0–1). Only applies to vector search.'),
  agentId: z
    .string()
    .optional()
    .describe('Restrict search to a specific agent'),
  memoryType: z
    .enum(['user', 'system', 'working', 'all'])
    .optional()
    .describe('Filter by memory type (default: all)'),
});

type MemorySearchInput = z.infer<typeof MemorySearchSchema>;

export function createMemorySearchTool(memoryService: MemoryService): Tool {
  return createTool({
    name: 'memory_search',
    description:
      'Search agent/user memories using semantic similarity and keyword matching. ' +
      'Returns the most relevant memory entries with similarity scores.',
    inputSchema: MemorySearchSchema,
    execute: async (input: unknown, _context?: ToolContext) => {
      const args = input as MemorySearchInput;

      logger.debug('memory_search', {
        query: args.query,
        userId: args.userId,
        limit: args.limit,
      });

      try {
        const results = await memoryService.search(args.query, args.userId, {
          limit: args.limit ?? 10,
          scoreThreshold: args.scoreThreshold,
          agentId: args.agentId,
          memoryType: args.memoryType ?? 'all',
        });

        logger.debug('memory_search complete', { count: results.length });

        return {
          success: true,
          results: results.map((r) => ({
            id: r.entry.id,
            content: r.entry.content,
            memoryType: r.entry.memoryType,
            agentId: r.entry.agentId,
            score: r.score,
            createdAt: r.entry.createdAt.toISOString(),
          })),
          count: results.length,
          query: args.query,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('memory_search error', { error: message });
        return { success: false, error: message };
      }
    },
  });
}
