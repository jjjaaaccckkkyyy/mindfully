import { createBuiltinTools, type Tool } from 'core';

/**
 * Returns the builtin tool list for the server-side agent runner.
 */
export function getBuiltinTools(): Tool[] {
  return createBuiltinTools();
}

/**
 * Execute a named tool by finding it in the builtin list and calling execute().
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: unknown; error?: string }> {
  const tools = getBuiltinTools();
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return { result: null, error: `Tool "${name}" not found` };
  }
  try {
    const result = await tool.execute(args);
    return { result };
  } catch (err) {
    return {
      result: null,
      error: err instanceof Error ? err.message : 'Tool execution failed',
    };
  }
}
