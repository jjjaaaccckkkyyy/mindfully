export interface Tool {
  name: string;
  description: string;
  execute(input: unknown): Promise<unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
