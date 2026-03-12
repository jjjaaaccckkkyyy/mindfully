import { type Tool, createToolRegistry } from '../index.js';
import { createReadTool } from './read.js';
import { createWriteTool } from './write.js';
import { createEditTool } from './edit.js';
import { createBashTool } from './bash.js';

export { createReadTool } from './read.js';
export { createWriteTool } from './write.js';
export { createEditTool } from './edit.js';
export { createBashTool } from './bash.js';

export function createBuiltinTools(): Tool[] {
  return [
    createReadTool(),
    createWriteTool(),
    createEditTool(),
    createBashTool(),
  ];
}

export function createBuiltinRegistry() {
  const registry = createToolRegistry();
  const tools = createBuiltinTools();
  tools.forEach((tool) => registry.register(tool));
  return registry;
}

export const builtinToolNames = ['read', 'write', 'edit', 'bash'] as const;
export type BuiltinToolName = typeof builtinToolNames[number];
