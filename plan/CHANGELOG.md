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

## [v0.1.1] - 2026-03-08

### Completed
- React 19 + Vite (enhanced)
- Tailwind CSS + shadcn/ui theming
- Lucide React (icons)
- Motion (animation)
- Recharts (charts)
- React D3 Tree (visualization)
- Classic dashboard layout
- Agent status cards with motion animations
- Activity chart (Recharts)
- Agent tree visualization (React D3 Tree)
- Recent activity feed

### Design System Added
- **Cyberpunk theme** (futuristic aesthetic)
- Typography: Orbitron (display) + Space Mono (body)
- Color palette: Deep space backgrounds (#0a0a12), Neon cyan accents (#00e5ff)
- Glassmorphism cards with neon glow borders
- Staggered fade-in animations on page load
- Theme documentation in plan/THEME.md

### Mobile Responsiveness
- Collapsible sidebar (desktop) / drawer (mobile)
- Mobile menu button with overlay
- Touch-friendly interactions
- Responsive grid layouts
- Adaptive padding and sizing

### UX Improvements
- Sidebar expands on hover when collapsed (pushes main content)
- Improved search bar with consistent styling
- Header buttons with proper spacing
- Fixed layout issues at widths > 1440px

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
