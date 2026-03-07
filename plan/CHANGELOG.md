# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.1.0] - 2026-03-07

### Added
- Initial monorepo scaffold with pnpm workspaces
- Express + tRPC server with hello endpoint
- React 19 + Vite client (bare bones)
- Core agent type definitions (Agent, Tool, Memory interfaces)
- In-memory store implementation for memory service
- AGENTS.md coding guidelines

### Defined Components
- Express + tRPC API layer
- LangChain/LangGraph agent framework
- Qdrant vector database for RAG memory
- EKS + EKS Anywhere hybrid deployment
- Per-token pricing model
- 99% SLA target

## [v0.1.1] - Future

### Planned (Client Stack)
- React 19 + Vite (to be enhanced)
- Tailwind CSS + shadcn/ui
- Lucide React (icons)
- Motion (animation)
- Recharts (charts)
- React D3 Tree (visualization)
- Classic dashboard layout
- Agent status cards with motion animations
- Activity chart (Recharts)
- Agent tree visualization (React D3 Tree)
- Recent activity feed

## [v0.1.2] - Future

### Planned (Auth)
- Auth.js (NextAuth) v5 for authentication
- OAuth 2.0 with PKCE support
- GitHub and Google OAuth providers
- Persistent users in PostgreSQL

## [v0.1.3] - Future

### Planned (Server)
- LangChain/LangGraph agent framework integration
- A2A Protocol + MCP for inter-agent communication
- PostgreSQL with Prisma/Drizzle ORM
- AWS SQS task queue
