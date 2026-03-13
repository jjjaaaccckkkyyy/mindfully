import { z } from 'zod';
import path from 'node:path';
import fg from 'fast-glob';
import { createTool } from '../index.js';
import { createLogger } from '../../logger.js';
import type { ToolContext } from '../index.js';

const logger = createLogger('core:glob');

const GlobSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files, e.g. "**/*.ts", "src/**/*.tsx"'),
  cwd: z.string().optional().describe('Directory to search in (relative to workspaceDir). Defaults to workspaceDir.'),
  ignore: z.array(z.string()).optional().describe('Glob patterns to exclude, e.g. ["**/node_modules/**", "**/*.test.ts"]'),
  absolute: z.boolean().optional().describe('Return absolute paths instead of relative paths. Default false.'),
});

type GlobInput = z.infer<typeof GlobSchema>;

export function createGlobTool() {
  return createTool({
    name: 'glob',
    description:
      'Find files matching a glob pattern. Faster and safer than using bash find/ls. ' +
      'Returns a list of matching file paths relative to the search directory.',
    inputSchema: GlobSchema,
    execute: async (input: unknown, context?: ToolContext) => {
      const args = input as GlobInput;
      const workspaceDir = context?.workspaceDir || process.cwd();

      const searchDir = args.cwd
        ? path.resolve(workspaceDir, args.cwd)
        : workspaceDir;

      logger.debug('glob', { pattern: args.pattern, searchDir, ignore: args.ignore });

      try {
        const matches = await fg(args.pattern, {
          cwd: searchDir,
          ignore: args.ignore ?? ['**/node_modules/**', '**/.git/**'],
          absolute: args.absolute ?? false,
          dot: false,
          onlyFiles: false,
        });

        matches.sort();

        logger.debug(`glob matched ${matches.length} entries`, { pattern: args.pattern });

        return {
          success: true,
          matches,
          count: matches.length,
          pattern: args.pattern,
          cwd: searchDir,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn('glob error', { pattern: args.pattern, error: message });
        return { success: false, error: message };
      }
    },
  });
}
