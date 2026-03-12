import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { createLogger } from '../../logger.js';
import { createTool, type Tool, type ToolContext } from '../index.js';

const logger = createLogger('core:read');

const ReadSchema = z.object({
  path: z.string().describe('The file path to read'),
});

export type ReadInput = z.infer<typeof ReadSchema>;

export function createReadTool(): Tool {
  return createTool({
    name: 'read',
    description: 'Read the contents of a file from the file system',
    inputSchema: ReadSchema,
    execute: async (input: unknown, context?: ToolContext) => {
      const args = input as ReadInput;
      try {
        const workspaceDir = context?.workspaceDir || process.cwd();
        const filePath = path.isAbsolute(args.path)
          ? args.path
          : path.join(workspaceDir, args.path);

        logger.debug('read file', { path: filePath });
        const content = await fs.readFile(filePath, 'utf-8');
        logger.debug('read file succeeded', { path: filePath, bytes: content.length });

        return {
          success: true,
          content,
          path: filePath,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to read file';
        logger.warn('read file failed', { path: args.path, error: message });
        return {
          success: false,
          error: message,
        };
      }
    },
  });
}
