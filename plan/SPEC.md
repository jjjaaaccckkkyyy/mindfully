# Technical Specifications

## Implementation Status

| Version | Status | Description |
|---------|--------|-------------|
| v0.1.0 | ✅ Built | Basic monorepo scaffold |
| v0.1.1 | ✅ Built | Client stack (Tailwind, dashboard) |
| v0.1.2 | ✅ Built | Auth (OAuth 2.0 + JWT) |
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
| Styling | Tailwind CSS + shadcn/ui theming |
| Icons | Lucide React |
| Animation | Motion |
| Charts | Recharts |
| Visualization | React D3 Tree |
| Layout | Dashboard (sidebar + header + content) |
| Theme | Cyberpunk (Orbitron + Space Mono) |

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
| Database | PostgreSQL (pg driver, no ORM) |
| Queue | AWS SQS |
| Auth | Passport.js + OAuth 2.0 + JWT |
| Session | express-session + connect-pg-simple |

### OAuth 2.0 Implementation (v0.1.2)

**Flow**: Client-side OAuth with backend verification

| Provider | Tokens | Storage |
|----------|--------|---------|
| GitHub | access_token | Backend (oauth_accounts table) |
| Google | access_token + refresh_token | Backend (oauth_accounts table) |
| Both | id_token (JWT) | Frontend (localStorage) |

**Token Types**:
- **id_token**: Custom JWT with user info (1 hour expiry)
- **access_token**: Provider API access (stored in database)
- **refresh_token**: Token refresh (Google only, stored in database)
- **session cookie**: Backend authentication

**Endpoints**:
- `POST /auth/github/verify` - Verify GitHub OAuth code
- `POST /auth/google/verify` - Verify Google OAuth code
- `POST /auth/register` - Email registration
- `POST /auth/login` - Email login
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user
- `GET /auth/verify-email` - Email verification
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Password reset

### OAuth Providers (v0.1.2)
- GitHub
- Google

### User Management (v0.1.2)
- Persistent users stored in PostgreSQL
- Session-based authentication (PostgreSQL-backed)
- OAuth account linking
- Email verification tokens
- Password reset tokens

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

Current: **v0.1.2** (see [CHANGELOG.md](./CHANGELOG.md) for details)

## Theme: Cyberpunk

See [THEME.md](./THEME.md) for detailed design system documentation.

### Theme Features
- **Typography**: Orbitron (display) + Space Mono (body)
- **Colors**: Deep space dark (#0a0a12) + Neon cyan (#00e5ff)
- **Effects**: Glassmorphism cards, neon glow borders, scanline overlay
- **Animations**: Staggered fade-in, glow pulse on status indicators

## Development Lifecycle

See [LIFECYCLE.md](./LIFECYCLE.md) for development workflow, testing requirements, and coverage guidelines.
