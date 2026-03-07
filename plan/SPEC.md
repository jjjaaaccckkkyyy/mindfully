# Technical Specifications

## Tech Stack

| Component | Technology |
|-----------|------------|
| API | Express + tRPC |
| Runtime | Node.js + pnpm |
| Language | TypeScript |
| Agent Framework | LangChain/LangGraph (Node.js) |
| Note | Node.js LangChain has limited features compared to Python |
| Orchestration | LangGraph |
| Vector DB | Qdrant |
| Compute | EKS + EKS Anywhere |
| Inter-Agent Protocol | A2A Protocol + MCP |
| Database | PostgreSQL |
| Queue | AWS SQS |
| Auth | JWT (jose) |

## Architecture

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
- JWT-based authentication
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

Current: **v0.1.1**

See [CHANGELOG.md](./CHANGELOG.md) for version history.
