# Technical Specifications

## Implementation Status

| Version | Status | Description |
|---------|--------|-------------|
| v0.1.0 | ✅ Built | Basic monorepo scaffold |
| v0.1.1 | 🔜 Planned | Client stack (Tailwind, dashboard) |
| v0.1.2 | 🔜 Planned | Auth (OAuth) |
| v0.1.3 | 🔜 Planned | Agent framework, database |

---

## Current Stack (v0.1.0 - Built)

### Server
| Component | Technology |
|-----------|------------|
| API | Express + tRPC |
| Runtime | Node.js + pnpm |
| Language | TypeScript |

### Client
| Component | Technology |
|-----------|------------|
| Framework | React 19 + Vite |
| Language | TypeScript |

### Core
| Component | Technology |
|-----------|------------|
| Types | Agent, Tool, Memory interfaces |
| Storage | InMemoryStore (for development) |

---

## Planned Stack (v0.1.1+)

### Client Stack (v0.1.1)

| Component | Technology |
|-----------|------------|
| Framework | React 19 + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Icons | Lucide React |
| Animation | Motion |
| Charts | Recharts |
| Visualization | React D3 Tree |
| Layout | Classic dashboard (sidebar + header + content) |

### Dashboard Features (v0.1.1)

- Agent status cards with motion animations
- Activity chart (Recharts)
- Agent tree visualization (React D3 Tree)
- Recent activity feed

### Server Stack (v0.1.2+)

| Component | Technology |
|-----------|------------|
| API | Express + tRPC |
| Runtime | Node.js + pnpm |
| Language | TypeScript |
| Agent Framework | LangChain/LangGraph (Node.js) |
| Orchestration | LangGraph |
| Vector DB | Qdrant |
| Compute | EKS + EKS Anywhere |
| Inter-Agent Protocol | A2A Protocol + MCP |
| Database | PostgreSQL |
| Queue | AWS SQS |
| Auth | Auth.js (NextAuth) v5 + OAuth 2.0 (PKCE) |

### OAuth Providers (v0.1.2)
- GitHub
- Google

### User Management (v0.1.2)
- Persistent users stored in PostgreSQL
- Session-based authentication

---

## Server Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  API Gateway (Auth, Rate Limit, WAF, CDN)                          │
├─────────────────────────────────────────────────────────────────────┤
│  Load Balancer → Task Router → Message Queue (SQS)                │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│ Agent: Research │ Agent: Builder  │ Agent: Analyzer + more...       │
│ (BIO.md def)   │ (BIO.md def)    │ (BIO.md def)                   │
├─────────────────┴─────────────────┴─────────────────────────────────┤
│  MCP Server → Tools: RAG (Qdrant), Web, Code, File, API            │
├─────────────────────────────────────────────────────────────────────┤
│  PostgreSQL (tenant state) │ Qdrant (memory) │ S3                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Agent System

### Inter-Agent Communication
- **A2A Protocol** - Agent-to-agent discovery and communication
- **MCP** - Model Context Protocol for tool/function calling

### Agent Types
- Task-specific agents defined in `agents/BIO.md`
- Stateless, horizontally scalable
- Spawned on-demand via task queue

## Multi-Tenancy

- Tenant isolation via namespace
- OAuth 2.0 + PKCE authentication
- Per-tenant rate limiting
- Usage tracking (per-token billing)

## Deployment

### AWS (Cloud)
- EKS cluster with Karpenter auto-scaling
- Multi-AZ for 99% SLA
- RDS PostgreSQL
- S3 for blob storage
- SQS for task queue

### On-Premises
- EKS Anywhere
- Self-hosted Qdrant
- Connected via VPC peering or Direct Connect

## Version

Current: **v0.1.0** (see [CHANGELOG.md](./CHANGELOG.md) for details)

## Development Lifecycle

See [LIFECYCLE.md](./LIFECYCLE.md) for development workflow, testing requirements, and coverage guidelines.
