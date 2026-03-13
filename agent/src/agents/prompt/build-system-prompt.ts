import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Tool } from 'core';
import { PromptBuilder } from './builder.js';

export interface BuildSystemPromptOptions {
  /** Tools available to the agent — populates Layer 2. */
  tools: Tool[];
  /**
   * Absolute path to the workspace directory. Workspace files (IDENTITY.md,
   * AGENTS.md, MEMORY.md) are loaded from here. Defaults to `process.cwd()`.
   */
  workspaceDir?: string;
  /**
   * Per-agent custom system prompt (e.g. from the DB `agents.system_prompt`
   * column). Replaces the default "You are Mindful…" identity in Layer 1.
   */
  agentSystemPrompt?: string;
}

/**
 * Build a complete system prompt string by:
 *  1. Reading workspace files (IDENTITY.md, AGENTS.md, MEMORY.md) from
 *     `workspaceDir` — missing files are silently skipped.
 *  2. Calling PromptBuilder.build() with all populated layers.
 *
 * The result is a single string suitable for injection as `role: "system"`.
 */
export async function buildSystemPrompt(options: BuildSystemPromptOptions): Promise<string> {
  const workspaceDir = options.workspaceDir ?? process.cwd();

  // Read workspace files in parallel; ignore missing files
  const tryRead = async (filename: string): Promise<string | undefined> => {
    try {
      return await readFile(path.join(workspaceDir, filename), 'utf8');
    } catch {
      return undefined;
    }
  };

  const [identity, agents, memory] = await Promise.all([
    tryRead('CLI-IDENTITY.md'),
    tryRead('CLI-AGENTS.md'),
    tryRead('CLI-MEMORY.md'),
  ]);

  const builder = new PromptBuilder();

  return builder.build({
    coreInstructions: options.agentSystemPrompt,
    tools: options.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
    runtimeInfo: {
      currentTime: new Date().toISOString(),
      os: process.platform === 'darwin' ? 'macOS' : process.platform,
      workingDirectory: workspaceDir,
      environment: process.env.NODE_ENV ?? 'production',
    },
    workspaceFiles: {
      identity,
      agents,
      memory,
    },
  });
}
