import { z } from 'zod';
import { createLogger } from '../../logger.js';
import { createTool, type Tool, type ToolContext } from '../index.js';
import type { MemoryService } from '../../memory/service.js';

const logger = createLogger('core:memory-get');

const MemoryGetSchema = z.object({
  userId: z.string().describe('User ID whose memory to retrieve'),
  agentId: z
    .string()
    .optional()
    .describe('Agent ID to scope the memory file. Omit for global user memory.'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of recent entries to return (default: 10)'),
});

type MemoryGetInput = z.infer<typeof MemoryGetSchema>;

export function createMemoryGetTool(memoryService: MemoryService): Tool {
  return createTool({
    name: 'memory_get',
    description:
      'Retrieve the recent memory entries for a user/agent pair, ' +
      'or read the raw memory markdown file.',
    inputSchema: MemoryGetSchema,
    execute: async (input: unknown, _context?: ToolContext) => {
      const args = input as MemoryGetInput;

      logger.debug('memory_get', { userId: args.userId, agentId: args.agentId });

      try {
        const entries = await memoryService.getRecent(
          args.userId,
          args.agentId,
          args.limit ?? 10,
        );

        logger.debug('memory_get complete', { count: entries.length });

        return {
          success: true,
          entries: entries.map((e) => ({
            id: e.id,
            content: e.content,
            memoryType: e.memoryType,
            agentId: e.agentId,
            createdAt: e.createdAt.toISOString(),
          })),
          count: entries.length,
          userId: args.userId,
          agentId: args.agentId,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('memory_get error', { error: message });
        return { success: false, error: message };
      }
    },
  });
}
