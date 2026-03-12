import { z } from 'zod';
import { createTool, type Tool, type ToolContext } from '../index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

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

        let content = await fs.readFile(filePath, 'utf-8');

        if (!content.includes(args.search)) {
          return {
            success: false,
            error: `Search text not found in file: ${args.search}`,
          };
        }

        content = content.replace(args.search, args.replace);
        await fs.writeFile(filePath, content, 'utf-8');

        return {
          success: true,
          path: filePath,
          replacements: 1,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to edit file',
        };
      }
    },
  });
}
