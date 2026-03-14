import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { createLogger } from '../../logger.js';
import type { ToolContext } from '../index.js';

const logger = createLogger('core:compact-session');

const CompactSessionSchema = z.object({
  reason: z
    .string()
    .optional()
    .describe('Optional reason for compacting (e.g. "context getting long")'),
});

type CompactSessionInput = z.infer<typeof CompactSessionSchema>;

export function createCompactSessionTool(context?: ToolContext) {
  return tool(
    async (args: CompactSessionInput) => {
      if (!context?.compact) {
        logger.debug('compact_session: no compact handler available, skipping');
        return JSON.stringify({
          success: false,
          error: 'compact_session is not available in this environment',
        });
      }

      logger.debug('compact_session: compacting', { reason: args.reason, sessionId: context.sessionId });

      const result = await context.compact();

      logger.debug('compact_session: complete', {
        sessionId: context.sessionId,
        messageCount: result.messageCount,
        summaryLength: result.summary.length,
      });

      return JSON.stringify({
        success: true,
        messageCount: result.messageCount,
        summaryLength: result.summary.length,
        summary: result.summary,
        message: `Session compacted: ${result.messageCount} messages summarised into ${result.summary.split(/\s+/).length} words.`,
      });
    },
    {
      name: 'compact_session',
      description:
        'Summarise the current conversation session into a concise summary, replacing the ' +
        'full message history with a compressed version. Use this when the conversation is ' +
        'getting long, context is running low, or you want to reduce token usage. ' +
        'The summary is injected back into the context so you retain full awareness of ' +
        'what was discussed. This tool is a no-op if no compact handler is available.',
      schema: CompactSessionSchema,
    },
  );
}
