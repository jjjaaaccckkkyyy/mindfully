#!/usr/bin/env node
/**
 * CLI runner for the AgentRunner.
 *
 * Usage:
 *   pnpm --filter agent run-agent run "Your prompt here"
 *   pnpm --filter agent run-agent run --cwd /some/dir "Your prompt"
 *   pnpm --filter agent run-agent run --tools read,bash "Your prompt"
 *   pnpm --filter agent run-agent run --session <id> "Your prompt"
 *   pnpm --filter agent run-agent run --context-dir /custom/dir "Your prompt"
 *   pnpm --filter agent run-agent run          # reads prompt from stdin
 *   pnpm --filter agent run-agent sessions
 *   pnpm --filter agent run-agent sessions --context-dir /custom/dir
 *
 * Context is persisted locally so sessions can be resumed:
 *   - Default context dir: ~/.mindful/cli-sessions/
 *   - A new session is created automatically each run unless --session is passed
 *   - Prior messages are summarised before injection into the context window
 *
 * Env vars are loaded from server/.env via --env-file flag in the npm script.
 */

import * as readline from 'node:readline';
import { Command } from 'commander';
import { AgentRunner } from '../agents/runner.js';
import { buildSystemPrompt } from '../agents/prompt/build-system-prompt.js';
import { createLLMChain } from '../agents/providers/index.js';
import { createBuiltinTools, builtinToolNames, type BuiltinToolName } from 'core';
import type { Tool, ToolContext } from 'core';
import { createLogger } from 'core';
import {
  CliContextStore,
  DEFAULT_CONTEXT_DIR,
  type CliMessage,
} from './context-store.js';

const logger = createLogger('agent:cli');

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function print(msg: string): void {
  process.stdout.write(msg);
}

function println(msg = ''): void {
  process.stdout.write(msg + '\n');
}

function printSeparator(): void {
  println('─'.repeat(60));
}

function truncate(s: string, maxLen: number): string {
  return s.length <= maxLen ? s : s.slice(0, maxLen) + '…';
}

// ---------------------------------------------------------------------------
// Inline-token flush helper
// ---------------------------------------------------------------------------

/**
 * If tokens are currently being streamed inline (no trailing newline yet),
 * emit a newline and reset the flag.  Must be called before any logger output
 * to avoid mixing log lines with partial token output.
 */
function flushInlineTokens(active: { value: boolean }): void {
  if (active.value) {
    println();
    active.value = false;
  }
}

// ---------------------------------------------------------------------------
// Stdin helper
// ---------------------------------------------------------------------------

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question('Enter your prompt: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

// ---------------------------------------------------------------------------
// `sessions` subcommand action
// ---------------------------------------------------------------------------

async function handleListSessions(opts: { contextDir: string }): Promise<void> {
  const store = new CliContextStore(opts.contextDir);
  const sessions = await store.listSessions();

  if (sessions.length === 0) {
    println('No sessions found.');
    return;
  }

  println();
  printSeparator();
  println('Sessions (most recent first)');
  printSeparator();
  for (const s of sessions) {
    const updated = new Date(s.updatedAt).toLocaleString();
    println(`  ${s.id}  messages: ${s.messageCount}  updated: ${updated}`);
    if (s.summary) {
      println(`          ${truncate(s.summary, 80)}`);
    }
  }
  printSeparator();
  println();
}

// ---------------------------------------------------------------------------
// `run` subcommand action
// ---------------------------------------------------------------------------

interface RunOptions {
  cwd: string;
  tools?: string;
  contextDir: string;
  session?: string;
}

async function runAgent(promptArg: string | undefined, opts: RunOptions): Promise<void> {
  const { cwd, contextDir } = opts;

  // Resolve prompt
  const prompt = promptArg ?? (await readStdin());
  if (!prompt) {
    logger.error('No prompt provided.');
    process.exit(1);
  }

  // Initialise context store
  const store = new CliContextStore(contextDir);

  // Resolve or create session
  let session;
  if (opts.session) {
    session = await store.getSession(opts.session);
    if (!session) {
      logger.error(`Session "${opts.session}" not found. Run "sessions" to see available sessions.`);
      process.exit(1);
    }
    logger.info(`Resuming session ${session.id} (${session.messageCount} prior messages)`);
  } else {
    session = await store.createSession();
    logger.info(`New session: ${session.id}`);
  }

  // Build tools
  const allTools = createBuiltinTools();
  const toolFilter: BuiltinToolName[] | 'all' = opts.tools
    ? opts.tools
        .split(',')
        .map((t) => t.trim())
        .filter((t): t is BuiltinToolName =>
          (builtinToolNames as readonly string[]).includes(t),
        )
    : 'all';

  const selectedTools: Tool[] =
    toolFilter === 'all'
      ? allTools
      : allTools.filter((t) => (toolFilter as string[]).includes(t.name));

  // Build provider chain (LLMChain)
  let llmChain;
  try {
    llmChain = createLLMChain();
  } catch (err) {
    logger.error(
      `Error creating LLM chain: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  const runner = new AgentRunner({ llmChain });

  // Tool executor
  const context: ToolContext = { workspaceDir: cwd };
  const toolExecutor = async (
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<{ result: unknown; error?: string }> => {
    const tool = selectedTools.find((t) => t.name === toolName);
    if (!tool) return { result: null, error: `Tool "${toolName}" not found` };
    try {
      const result = await tool.execute(args, context);
      return { result };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : String(err) };
    }
  };

  // Print header
  println();
  printSeparator();
  println(`Prompt  : ${prompt}`);
  println(`CWD     : ${cwd}`);
  println(`Tools   : ${selectedTools.map((t) => t.name).join(', ')}`);
  println(`Session : ${session.id}`);
  printSeparator();
  println();

  // Build system prompt
  const systemPromptContent = await buildSystemPrompt({
    tools: selectedTools,
    workspaceDir: cwd,
  });

  // Build history: system prompt + optional summary + sliding window
  const history = await store.buildHistory(session.id, systemPromptContent);

  // Append user message for the runner
  history.push({ role: 'user', content: prompt });

  // Collect new messages to persist after the run
  const newMessages: CliMessage[] = [];
  let nextSeq = (await store.readMessages(session.id)).length + 1;

  newMessages.push({
    seq: nextSeq++,
    role: 'user',
    content: prompt,
    createdAt: new Date().toISOString(),
  });

  // Stream responses
  const inlineTokensActive = { value: false };

  for await (const event of runner.stream({
    input: prompt,
    tools: selectedTools,
    toolExecutor,
    history,
  })) {
    switch (event.type) {
      case 'token':
        inlineTokensActive.value = true;
        print(event.content);
        break;

      case 'tool_start':
        flushInlineTokens(inlineTokensActive);
        logger.info(`tool_start: ${event.name}`, { args: event.args });
        break;

      case 'tool_result':
        flushInlineTokens(inlineTokensActive);
        if (event.error) {
          logger.warn(`tool_result: ${event.name}`, { error: event.error });
          newMessages.push({
            seq: nextSeq++,
            role: 'tool',
            content: event.error,
            toolCallId: event.id,
            toolName: event.name,
            createdAt: new Date().toISOString(),
          });
        } else {
          const preview = truncate(JSON.stringify(event.result), 200);
          logger.info(`tool_result: ${event.name}`, { result: preview });
          newMessages.push({
            seq: nextSeq++,
            role: 'tool',
            content: JSON.stringify(event.result),
            toolCallId: event.id,
            toolName: event.name,
            createdAt: new Date().toISOString(),
          });
        }
        break;

      case 'done': {
        flushInlineTokens(inlineTokensActive);
        const cost = event.cost;
        logger.debug('done', {
          messages: event.messages.length,
          ...(cost ? { totalCost: cost.totalCost, model: cost.model } : {}),
        });

        // Collect new assistant messages from the done event
        const contextLen = history.filter((m) => m.role !== 'system').length;
        const freshMsgs = event.messages
          .filter((m) => m.role === 'assistant' || m.role === 'tool')
          .slice(contextLen);

        for (const m of freshMsgs) {
          if (m.role === 'assistant') {
            newMessages.push({
              seq: nextSeq++,
              role: 'assistant',
              content: m.content,
              ...(m.tool_calls ? { toolCalls: m.tool_calls } : {}),
              createdAt: new Date().toISOString(),
            });
          }
        }
        break;
      }

      case 'error':
        flushInlineTokens(inlineTokensActive);
        logger.error(`stream error: ${event.message}`);
        break;
    }
  }

  // Persist new messages
  await store.appendMessages(session.id, newMessages);

  // Footer
  println();
  println();
  printSeparator();
  const totalCost = runner.getTotalCost();
  println(`Total cost : $${totalCost.toFixed(6)}`);
  println(`Session ID : ${session.id}  (use --session ${session.id} to resume)`);
  printSeparator();
  println();
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

const program = new Command()
  .name('run-agent')
  .description('Mindful CLI agent runner')
  .version('0.1.5')
  // Top-level options (work with both bare invocation and subcommands)
  .option('-c, --cwd <dir>', 'Working directory', process.cwd())
  .option('-t, --tools <names>', 'Comma-separated tool names (default: all)')
  .option('--context-dir <path>', 'Context directory', DEFAULT_CONTEXT_DIR)
  .option('-s, --session <id>', 'Resume a specific session by ID')
  .option('--list-sessions', 'List all sessions and exit')
  // Default action: bare `run-agent [prompt]` with no subcommand
  .argument('[prompt]', 'Prompt to run (reads stdin if omitted)')
  .action(async (promptArg: string | undefined, opts: RunOptions & { listSessions?: boolean }) => {
    if (opts.listSessions) {
      await handleListSessions({ contextDir: opts.contextDir });
    } else {
      await runAgent(promptArg, opts);
    }
  });

// Explicit `run` subcommand — kept for users who prefer the verbose form
program
  .command('run [prompt]')
  .description('Run the agent with an optional prompt (reads stdin if omitted)')
  .option('-c, --cwd <dir>', 'Working directory', process.cwd())
  .option('-t, --tools <names>', 'Comma-separated tool names (default: all)')
  .option('--context-dir <path>', 'Context directory', DEFAULT_CONTEXT_DIR)
  .option('-s, --session <id>', 'Resume a specific session by ID')
  .action(async (prompt: string | undefined, opts: RunOptions) => {
    await runAgent(prompt, opts);
  });

// Explicit `sessions` subcommand
program
  .command('sessions')
  .description('List all sessions in the context directory')
  .option('--context-dir <path>', 'Context directory', DEFAULT_CONTEXT_DIR)
  .action(async (opts: { contextDir: string }) => {
    await handleListSessions(opts);
  });

program.parseAsync(process.argv).catch((err) => {
  logger.error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
