import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import { createLogger } from '../../logger.js';
import { createTool, type Tool, type ToolContext } from '../index.js';

const logger = createLogger('core:bash');
const execAsync = promisify(exec);

const BashSchema = z.object({
  command: z.string().describe('The shell command to execute'),
  cwd: z.string().optional().describe('Working directory for the command'),
  timeout: z.number().optional().describe('Timeout in milliseconds (default: 60000)'),
});

export type BashInput = z.infer<typeof BashSchema>;

export function createBashTool(): Tool {
  return createTool({
    name: 'bash',
    description: 'Execute a shell command in the workspace',
    inputSchema: BashSchema,
    execute: async (input: unknown, context?: ToolContext) => {
      const args = input as BashInput;
      const workspaceDir = context?.workspaceDir || process.cwd();
      const cwd = args.cwd || workspaceDir;
      const timeout = args.timeout || 60000;

      logger.debug('bash command', { command: args.command, cwd });

      try {
        const { stdout, stderr } = await execAsync(args.command, {
          cwd,
          timeout,
          maxBuffer: 10 * 1024 * 1024,
        });

        logger.debug('bash command succeeded', {
          command: args.command,
          stdoutLength: stdout.length,
          hasStderr: stderr.length > 0,
        });

        return {
          success: true,
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: 0,
        };
      } catch (error) {
        if (error instanceof Error) {
          if ('stdout' in error && 'stderr' in error) {
            const execError = error as { stdout?: string; stderr?: string; code?: number };
            logger.warn('bash command failed', {
              command: args.command,
              exitCode: execError.code ?? 1,
              stderr: execError.stderr,
            });
            return {
              success: false,
              stdout: execError.stdout || '',
              stderr: execError.stderr || error.message,
              exitCode: execError.code || 1,
            };
          }
          logger.warn('bash command error', { command: args.command, error: error.message });
          return {
            success: false,
            error: error.message,
          };
        }
        logger.warn('bash command unknown error', { command: args.command });
        return {
          success: false,
          error: 'Unknown error executing command',
        };
      }
    },
  });
}
