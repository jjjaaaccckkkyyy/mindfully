#!/usr/bin/env node
/**
 * CLI runner for the AgentRunner.
 *
 * Usage:
 *   pnpm --filter agent run-agent "Your prompt here"
 *   pnpm --filter agent run-agent --cwd /some/dir "Your prompt"
 *   pnpm --filter agent run-agent --tools read,bash "Your prompt"
 *   pnpm --filter agent run-agent          # reads prompt from stdin
 *
 * Env vars are loaded from server/.env via --env-file flag in the npm script.
 */

import * as readline from 'node:readline';
import { AgentRunner } from '../agents/runner.js';
import { createProviderChain } from '../agents/providers/index.js';
import { createBuiltinTools, builtinToolNames, type BuiltinToolName } from 'core';
import type { Tool, ToolContext } from 'core';
import { createLogger } from 'core';

const logger = createLogger('agent:cli');

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  prompt: string | null;
  cwd: string;
  tools: BuiltinToolName[] | 'all';
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2); // strip node + script path
  let prompt: string | null = null;
  let cwd = process.cwd();
  let tools: BuiltinToolName[] | 'all' = 'all';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--cwd') {
      cwd = args[++i] ?? cwd;
    } else if (arg === '--tools') {
      const raw = args[++i] ?? '';
      const parsed = raw
        .split(',')
        .map((t) => t.trim())
        .filter((t): t is BuiltinToolName =>
          (builtinToolNames as readonly string[]).includes(t),
        );
      tools = parsed.length > 0 ? parsed : 'all';
    } else if (!arg.startsWith('--')) {
      prompt = arg;
    }
  }

  return { prompt, cwd, tools };
}

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------

async function readStdin(): Promise<string> {
  const isTTY = process.stdin.isTTY;
  if (isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question('Enter your prompt: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
  // piped input
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { prompt: promptArg, cwd, tools: toolFilter } = parseArgs(process.argv);

  // Resolve prompt
  const prompt = promptArg ?? (await readStdin());
  if (!prompt) {
    logger.error('No prompt provided.');
    process.exit(1);
  }

  // Build tools
  const allTools = createBuiltinTools();
  const selectedTools: Tool[] =
    toolFilter === 'all'
      ? allTools
      : allTools.filter((t) => (toolFilter as string[]).includes(t.name));

  // Build provider chain (reads LLM_* env vars)
  let providerChain;
  try {
    providerChain = createProviderChain();
  } catch (err) {
    logger.error(
      `Error creating provider chain: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  const runner = new AgentRunner({ providerChain });

  // Tool executor — runs the tool with workspace context
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
  println(`Prompt : ${prompt}`);
  println(`CWD    : ${cwd}`);
  println(`Tools  : ${selectedTools.map((t) => t.name).join(', ')}`);
  printSeparator();
  println();

  // Stream responses
  let prevMessageCount = 1; // start after initial user message
  let hadError = false;

  for await (const state of runner.stream({
    input: prompt,
    tools: selectedTools,
    toolExecutor,
  })) {
    if (state.error && !hadError) {
      hadError = true;
      println();
      println(`[error] ${state.error}`);
      break;
    }

    // Print any new messages since last yield
    const newMessages = state.messages.slice(prevMessageCount);
    prevMessageCount = state.messages.length;

    for (const msg of newMessages) {
      if (msg.role === 'assistant') {
        if (msg.content) {
          print(msg.content);
        }
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          for (const call of msg.tool_calls) {
            println();
            println(`[tool-call] ${call.name}(${JSON.stringify(call.args)})`);
          }
        }
      } else if (msg.role === 'tool') {
        println(`[tool-result:${msg.toolName}] ${msg.content}`);
      }
    }
  }

  // Final newline + cost summary
  println();
  println();
  printSeparator();
  const totalCost = runner.getTotalCost();
  println(`Total cost: $${totalCost.toFixed(6)}`);
  printSeparator();
  println();
}

main().catch((err) => {
  logger.error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
