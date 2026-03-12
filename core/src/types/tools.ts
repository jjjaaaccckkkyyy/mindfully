export type ToolHandler = (input: ToolInput) => Promise<ToolResult>;

export interface ToolInput {
  params: Record<string, unknown>;
  context?: ToolContext;
}

export interface ToolContext {
  agentId: string;
  executionId: string;
  userId: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  schema: ToolSchema;
  handler: ToolHandler;
  provider: ToolProvider;
}

export interface ToolSchema {
  type: 'object';
  properties: Record<string, ToolSchemaProperty>;
  required?: string[];
}

export interface ToolSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  default?: unknown;
}

export type ToolProvider = 'builtin' | 'mcp' | 'custom';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolSchema;
}

export interface MCPToolConfig {
  type: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  transport: MCPToolConfig;
  tools: string[];
  enabled: boolean;
}

export interface ToolExecution {
  toolId: string;
  toolName: string;
  input: Record<string, unknown>;
  result?: ToolResult;
  startedAt: Date;
  completedAt?: Date;
}

export const BUILTIN_TOOLS = {
  calculator: {
    name: 'calculator',
    description: 'Perform mathematical calculations',
    inputSchema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)")',
        },
      },
      required: ['expression'],
    },
  },
  http_request: {
    name: 'http_request',
    description: 'Make HTTP requests to fetch data from URLs',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to request',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE'],
          default: 'GET',
        },
        headers: {
          type: 'object',
          description: 'Optional HTTP headers',
        },
        body: {
          type: 'string',
          description: 'Request body (for POST/PUT)',
        },
      },
      required: ['url'],
    },
  },
  code_interpreter: {
    name: 'code_interpreter',
    description: 'Execute JavaScript code in a sandboxed environment',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript code to execute',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 5000)',
          default: 5000,
        },
      },
      required: ['code'],
    },
  },
} as const;
