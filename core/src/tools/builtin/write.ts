import { z } from 'zod';
import { createTool, type Tool, type ToolContext } from '../index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const WriteSchema = z.object({
  path: z.string().describe('The file path to write'),
  content: z.string().describe('The content to write to the file'),
});

export type WriteInput = z.infer<typeof WriteSchema>;

export function createWriteTool(): Tool {
  return createTool({
    name: 'write',
    description: 'Write content to a file. Creates the file if it does not exist.',
    inputSchema: WriteSchema,
    execute: async (input: unknown, context?: ToolContext) => {
      const args = input as WriteInput;
      try {
        const workspaceDir = context?.workspaceDir || process.cwd();
        const filePath = path.isAbsolute(args.path)
          ? args.path
          : path.join(workspaceDir, args.path);

        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, args.content, 'utf-8');

        return {
          success: true,
          path: filePath,
          bytesWritten: args.content.length,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to write file',
        };
      }
    },
  });
}
