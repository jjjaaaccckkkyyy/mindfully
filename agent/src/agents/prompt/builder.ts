import type { ToolDefinition } from 'core';

export interface PromptBuildOptions {
  coreInstructions?: string;
  tools?: ToolDefinition[];
  skills?: SkillInfo[];
  modelAlias?: string;
  runtimeInfo?: RuntimeInfo;
  workspaceFiles?: WorkspaceFiles;
  bootstrapHooks?: BootstrapHook[];
  conversationHistory?: Message[];
  maxContextTokens?: number;
}

export interface RuntimeInfo {
  currentTime: string;
  os: string;
  workingDirectory: string;
  environment: string;
}

export interface WorkspaceFiles {
  identity?: string;
  agents?: string;
  memory?: string;
  custom?: Record<string, string>;
}

export interface BootstrapHook {
  name: string;
  content: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  path?: string;
}

const DEFAULT_CORE_INSTRUCTIONS = `You are Mindful, an AI agent assistant. You help users accomplish tasks using available tools.

## Behavioral Rules
- Always prioritize user safety and privacy
- Ask for clarification when instructions are ambiguous
- Provide clear explanations of your actions
- Admit when you don't know something`;

const DEFAULT_PROTOCOL_SPECS = `# Protocol Specifications

## Silent Replies
You may perform internal reasoning without verbose output to the user.

## Heartbeats
For long-running operations, periodically signal your status to keep the user informed.

## Reply Tags
Use structured tags for downstream parsing:
<thinking>...</thinking>
<action>tool_name</action>
<result>...</result>`;

export class PromptBuilder {
  private maxContextTokens: number;

  constructor(maxContextTokens = 100000) {
    this.maxContextTokens = maxContextTokens;
  }

  build(options: PromptBuildOptions): string {
    const layers: string[] = [];

    layers.push(this.buildCoreInstructions(options.coreInstructions));
    layers.push(this.buildToolDefinitions(options.tools));
    layers.push(this.buildSkillsRegistry(options.skills));
    layers.push(this.buildModelAliases(options.modelAlias));
    layers.push(this.buildProtocolSpecs());
    layers.push(this.buildRuntimeInfo(options.runtimeInfo));
    layers.push(this.buildWorkspaceFiles(options.workspaceFiles));
    layers.push(this.buildBootstrapHooks(options.bootstrapHooks));
    layers.push(this.buildInboundContext(options.conversationHistory));

    const prompt = layers.filter(Boolean).join('\n\n');
    return this.truncateIfNeeded(prompt);
  }

  private buildCoreInstructions(custom?: string): string {
    const instructions = custom || DEFAULT_CORE_INSTRUCTIONS;
    return `# Layer 1: Core Instructions\n${instructions}`;
  }

  private buildToolDefinitions(tools?: ToolDefinition[]): string {
    if (!tools || tools.length === 0) {
      return '# Layer 2: Tool Definitions\nNo tools available.';
    }

    const toolDefs = tools
      .map((tool) => {
        const schema = this.schemaToJson(tool.inputSchema);
        return `## ${tool.name}
Description: ${tool.description}
Parameters: ${JSON.stringify(schema, null, 2)}`;
      })
      .join('\n\n');

    return `# Layer 2: Tool Definitions\n${toolDefs}`;
  }

  private schemaToJson(schema: unknown): Record<string, unknown> {
    if (typeof schema !== 'object' || schema === null) {
      return {};
    }
    return schema as Record<string, unknown>;
  }

  private buildSkillsRegistry(skills?: SkillInfo[]): string {
    if (!skills || skills.length === 0) {
      return '# Layer 3: Skills Registry\nNo skills available.';
    }

    const skillList = skills
      .map((skill) => `- ${skill.name}: ${skill.description}`)
      .join('\n');

    return `# Layer 3: Skills Registry\nAvailable skills:\n${skillList}`;
  }

  private buildModelAliases(_alias?: string): string {
    const aliases = {
      gpt4: 'openai/gpt-4o',
      'gpt-4o': 'openai/gpt-4o',
      'gpt-4o-mini': 'openai/gpt-4o-mini',
      claude: 'anthropic/claude-opus-4-5-20241022',
      'claude-sonnet': 'anthropic/claude-sonnet-4-20241022',
      'claude-haiku': 'anthropic/claude-haiku-3-20240307',
      flash: 'google/gemini-2.0-flash-exp',
    };

    const aliasList = Object.entries(aliases)
      .map(([key, value]) => `${key} → ${value}`)
      .join('\n');

    return `# Layer 4: Model Aliases\n${aliasList}`;
  }

  private buildProtocolSpecs(): string {
    return `# Layer 5: Protocol Specifications\n${DEFAULT_PROTOCOL_SPECS}`;
  }

  private buildRuntimeInfo(info?: RuntimeInfo): string {
    const defaultInfo: RuntimeInfo = {
      currentTime: new Date().toISOString(),
      os: process.platform === 'darwin' ? 'macOS' : process.platform,
      workingDirectory: process.cwd(),
      environment: 'production',
    };

    const runtime = info || defaultInfo;

    return `# Layer 6: Runtime Information
Current Time: ${runtime.currentTime}
OS: ${runtime.os}
Working Directory: ${runtime.workingDirectory}
Environment: ${runtime.environment}`;
  }

  private buildWorkspaceFiles(files?: WorkspaceFiles): string {
    const layers: string[] = ['# Layer 7: Workspace Files'];

    if (files?.identity) {
      layers.push(`## IDENTITY.md\n${files.identity}`);
    }
    if (files?.agents) {
      layers.push(`## AGENTS.md\n${files.agents}`);
    }
    if (files?.memory) {
      layers.push(`## MEMORY.md\n${files.memory}`);
    }
    if (files?.custom) {
      for (const [name, content] of Object.entries(files.custom)) {
        layers.push(`## ${name}\n${content}`);
      }
    }

    return layers.join('\n\n');
  }

  private buildBootstrapHooks(hooks?: BootstrapHook[]): string {
    if (!hooks || hooks.length === 0) {
      return '# Layer 8: Bootstrap Hooks\nNo bootstrap hooks configured.';
    }

    const hookContent = hooks.map((hook) => `## ${hook.name}\n${hook.content}`).join('\n\n');
    return `# Layer 8: Bootstrap Hooks\n${hookContent}`;
  }

  private buildInboundContext(history?: Message[]): string {
    if (!history || history.length === 0) {
      return '# Layer 9: Inbound Context\nNo conversation history.';
    }

    const messages = history
      .map((msg) => `<${msg.role}>${msg.content}</${msg.role}>`)
      .join('\n');

    return `# Layer 9: Inbound Context\n${messages}`;
  }

  private truncateIfNeeded(prompt: string): string {
    const estimatedTokens = prompt.length / 4;
    if (estimatedTokens > this.maxContextTokens * 0.8) {
      const maxChars = this.maxContextTokens * 4 * 0.8;
      return prompt.slice(0, Math.floor(maxChars)) + '\n\n... (context truncated)';
    }
    return prompt;
  }
}

export function createPromptBuilder(maxContextTokens?: number): PromptBuilder {
  return new PromptBuilder(maxContextTokens);
}
