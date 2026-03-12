# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.1.3] - Agent Features

### Added
- **Core Agent System**
  - Agent types and interfaces (`Agent`, `AgentConfig`, `AgentExecution`)
  - Base agent runner with LangGraph integration
  - Tool system with MCP protocol support
  - Memory system with Qdrant vector storage

- **Server**
  - Agent CRUD API endpoints
  - Agent execution endpoints

- **Client**
  - Agent management pages
  - Agent execution interface
  - Password strength indicator

- **Tests**
  - Comprehensive backend test suite (236 tests, 98% coverage)
  - Visual verification with agent-browser

### Fixed
- Session management query (JSONB path operators)
- Date handling in SessionsPage (string to Date conversion)

## [0.1.2] - Authentication System

### Added
- Email/password authentication
- OAuth providers (GitHub, Google)
- Email verification flow
- Password reset flow
- Session management
- Verification banner UI

### Features
- Login/Register pages
- Email verification page
- Forgot password page
- Reset password page
- Sessions management page

## [0.1.1] - Initial Setup

### Added
- Monorepo structure (server, client, core)
- Basic Express + tRPC server
- React + Vite frontend
- Tailwind CSS with cyberpunk theme

---

# v0.1.3 Agent Features Specification

## Overview

v0.1.3 introduces the core agent system for multi-agent AI capabilities. This includes:
- Tool system (MCP + built-in)
- Memory system (RAG with Qdrant)
- Agent runner (LangGraph-based)

---

## Core Types

### Agent Types (`core/src/types/agents.ts`)

```typescript
interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  tools: string[];
  memoryEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentExecution {
  id: string;
  agentId: string;
  input: string;
  output: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}
```

### Tool Types (`core/src/types/tools.ts`)

```typescript
interface Tool {
  id: string;
  name: string;
  description: string;
  schema: JSONSchema;
  handler: ToolHandler;
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
```

### Memory Types (`core/src/types/memory.ts`)

```typescript
interface MemoryEntry {
  id: string;
  agentId: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}

interface MemoryQuery {
  agentId: string;
  query: string;
  limit: number;
  threshold?: number;
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client (React)                    │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  List   │  │  Detail  │  │  Run Interface  │  │
│  └────┬────┘  └────┬─────┘  └────────┬─────────┘  │
└───────┼─────────────┼─────────────────┼─────────────┘
        │             │                 │
        └─────────────┴─────────────────┘
                         │
                    Server (Express)
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   ┌────▼────┐    ┌─────▼─────┐   ┌─────▼──────┐
   │  REST   │    │  tRPC     │   │   Core     │
   │  API    │    │ Procedures│   │  (Agents)  │
   └────┬────┘    └─────┬─────┘   └─────┬──────┘
        │               │                │
        └───────────────┼────────────────┘
                        │
                 ┌──────▼──────┐
                 │    Core     │
                 ├─────────────┤
                 │  - Agents   │
                 │  - Tools    │
                 │  - Memory   │
                 └─────────────┘
```

---

## API Endpoints

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create new agent |
| GET | `/api/agents/:id` | Get agent details |
| PUT | `/api/agents/:id` | Update agent |
| DELETE | `/api/agents/:id` | Delete agent |
| POST | `/api/agents/:id/execute` | Execute agent |
| GET | `/api/agents/:id/history` | Get execution history |

---

## Database Schema

### agents

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Agent name |
| description | TEXT | Agent description |
| model | VARCHAR(100) | LLM model to use |
| tools | JSONB | Array of tool IDs |
| memory_enabled | BOOLEAN | Enable RAG memory |
| user_id | UUID | Owner |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update |

### agent_executions

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| agent_id | UUID | Foreign key to agents |
| input | TEXT | User input |
| output | TEXT | Agent output |
| status | VARCHAR(20) | Execution status |
| error | TEXT | Error message if failed |
| started_at | TIMESTAMP | Start time |
| completed_at | TIMESTAMP | End time |

---

## Implementation Priority

### Phase 1: Core Types (P0)
- [ ] Define agent types
- [ ] Define tool types  
- [ ] Define memory types

### Phase 2: Tool System (P0)
- [ ] MCP protocol client
- [ ] Filesystem tool
- [ ] Web search tool
- [ ] Built-in tools

### Phase 3: Memory System (P0)
- [ ] Qdrant integration
- [ ] Embeddings generation
- [ ] Semantic retrieval

### Phase 4: Agent Runner (P1)
- [ ] LangGraph workflow
- [ ] Execution engine
- [ ] Error handling

### Phase 5: Server API (P1)
- [ ] REST endpoints
- [ ] tRPC procedures

### Phase 6: Client UI (P2)
- [ ] Agent list page
- [ ] Agent detail page
- [ ] Agent execution UI

### Phase 7: Database (P2)
- [ ] Agent tables
- [ ] Execution history

---

## Dependencies

```json
{
  "langchain": "^0.3.0",
  "@langchain/langgraph": "^0.0.1",
  "langchain-openai": "^0.2.0",
  "qdrant-client": "^1.7.0",
  "@modelcontextprotocol/sdk": "^0.5.0"
}
```
