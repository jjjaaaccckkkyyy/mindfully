import { z } from 'zod';
import { createTool, type Tool, type ToolContext } from '../index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

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

        const content = await fs.readFile(filePath, 'utf-8');
        return {
          success: true,
          content,
          path: filePath,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to read file',
        };
      }
    },
  });
}
