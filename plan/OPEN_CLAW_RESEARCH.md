# OpenClaw Research

Research findings from studying OpenClaw's architecture (Feb 2026).

## Overview

OpenClaw is an open-source personal AI assistant (~235K GitHub stars). It was previously called Clawdbot and Moltbot. Created by Peter Steinberger.

## Core Architecture

### Stack (4 Layers)

| Layer | Package | Purpose |
|-------|---------|---------|
| L1 | `pi-ai` | LLM abstraction (Anthropic, OpenAI, Google, Ollama, etc.) |
| L2 | `pi-agent-core` | Agent loop: LLM → tool calls → execute → repeat |
| L3 | `pi-coding-agent` | Full runtime with session, skills, extensions |
| L4 | OpenClaw Gateway | Channel adapters, memory, cron, sandbox, voice |

### Agent Loop (Pi Agent Core)

```typescript
while (true) {
  const response = await streamCompletion(model, context, tools);
  if (!response.toolCalls) break;
  for (const call of response.toolCalls) {
    const result = await executeTool(call);
    context.messages.push(result);
  }
}
```

Key points:
- Only **4 primitive tools**: Read, Write, Edit, Bash
- Model decides when to stop (no max-steps knob)
- Sub-1,000 token system prompt

## 9-Layer System Prompt

| Layer | Name | User Controllable | Description |
|-------|------|-------------------|-------------|
| 1 | Core Instructions | ❌ | Agent DNA, behavioral rules |
| 2 | Tool Definitions | ❌ | JSON Schema for tools |
| 3 | Skills Registry | ⚠️ | Auto-discovered from skills/ directory |
| 4 | Model Aliases | ❌ | Short aliases (gpt4 → openai/gpt-4o) |
| 5 | Protocol Specs | ❌ | Silent replies, heartbeats, reply tags |
| 6 | Runtime Info | ❌ | Time, OS, working directory |
| 7 | Workspace Files | ✅ | IDENTITY.md, AGENTS.md, MEMORY.md |
| 8 | Bootstrap Hooks | ✅ | Programmatic runtime injection |
| 9 | Inbound Context | ❌ | Current conversation history |

## Memory System

- **Plain Markdown** as source of truth
- **Hybrid search**: vectors + keywords
- **Pre-compaction flush** - saves before context overflow
- Three layers: working memory → short-term → long-term
- Stores in `MEMORY.md` and daily logs

## Concurrency Model

- **Lane Queue**: Main (serial), Cron (parallel), Subagent (parallel)
- Prevents race conditions on session history

## Key Design Decisions

1. **Single-process monolith** (Node.js port 18789) - not microservices
2. **Embedded, not subprocess** - deep integration with Pi SDK
3. **Fewer tools = more capability** - primitives compose into anything
4. **Personality via Markdown** - editable files, not hardcoded

## Gateway Architecture

```
User (Telegram / WhatsApp / Discord / Web)
    │
    ▼
OpenClaw Gateway (single Node.js process)
    ├── Channel adapters (20+ messaging platforms)
    ├── Agent execution engine (agentic loop with tools)
    ├── Memory system (files + vector search)
    ├── Cron scheduler (proactive background tasks)
    ├── Docker sandbox (safe code execution)
    ├── Browser automation (headless Chrome)
    └── Sub-agent system (parallel work)
    │
    ▼
LLM (Claude, GPT, Gemini, etc.)
```

## Security Model

- Docker sandbox for tool execution
- Bootstrap hook content limits (`bootstrapMaxChars`)
- Session isolation between users

## Sources

- [OpenClaw GitHub](https://github.com/openclonk/openclonk)
- [Pi Mono](https://github.com/badlogic/pi-mono)
- [OpenClaw Docs](https://docs.openclaw.ai)
- [9-Layer System Prompt Architecture](https://clawlist.io/blog/openclaw-9-layer-system-prompt-architecture)
- [Pi Agent Core Tutorial](https://nader.substack.com/p/how-to-build-a-custom-agent-framework)
