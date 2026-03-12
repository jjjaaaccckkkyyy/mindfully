import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { createLogger } from '../../logger.js';
import { createTool, type Tool, type ToolContext } from '../index.js';

const logger = createLogger('core:edit');

const EditSchema = z.object({
  path: z.string().describe('The file path to edit'),
  search: z.string().describe('The text to search for in the file'),
  replace: z.string().describe('The text to replace the search text with'),
});

export type EditInput = z.infer<typeof EditSchema>;

export function createEditTool(): Tool {
  return createTool({
    name: 'edit',
    description: 'Edit a file by replacing specific text with new text',
    inputSchema: EditSchema,
    execute: async (input: unknown, context?: ToolContext) => {
      const args = input as EditInput;
      try {
        const workspaceDir = context?.workspaceDir || process.cwd();
        const filePath = path.isAbsolute(args.path)
          ? args.path
          : path.join(workspaceDir, args.path);

        logger.debug('edit file', { path: filePath, searchLength: args.search.length });
        let content = await fs.readFile(filePath, 'utf-8');

        if (!content.includes(args.search)) {
          logger.warn('edit file: search text not found', { path: filePath });
          return {
            success: false,
            error: `Search text not found in file: ${args.search}`,
          };
        }

        content = content.replace(args.search, args.replace);
        await fs.writeFile(filePath, content, 'utf-8');
        logger.debug('edit file succeeded', { path: filePath });

        return {
          success: true,
          path: filePath,
          replacements: 1,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to edit file';
        logger.warn('edit file failed', { path: args.path, error: message });
        return {
          success: false,
          error: message,
        };
      }
    },
  });
}
