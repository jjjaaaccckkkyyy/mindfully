# Technical Specifications

## Implementation Status

| Version | Status | Description |
|---------|--------|-------------|
| v0.1.0 | ✅ Built | Basic monorepo scaffold |
| v0.1.1 | ✅ Built | Client stack (Tailwind, dashboard) |
| v0.1.2 | ✅ Built | Auth (OAuth 2.0 + JWT) |
| v0.1.3 | 🔜 Planned | Agent framework, database |

See [v0.1.3-implementation.md](./v0.1.3-implementation.md) for detailed implementation plan.

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

### Email Verification Strategy (v0.1.2)

Since email is the primary identity for all authentication methods:

| Scenario | Behavior |
|----------|----------|
| **Email Registration** | `email_verified = false` (pending verification) |
| **OAuth Registration (new user)** | `email_verified = true` (provider verified) |
| **OAuth Login (existing user, unverified)** | Updates `email_verified = true` |
| **OAuth Login (existing user, verified)** | No change (already verified) |
| **Email Login (unverified user)** | Blocked - requires OAuth verification first |

**Typical Flow:**
1. User registers with email/password → `email_verified = false`
2. User cannot login with email yet
3. User signs in with GitHub/Google (same email) → `email_verified = true`, OAuth account linked
4. User can now login with email/password

**Implementation** (`server/src/auth/passport.ts`):
```typescript
// When linking OAuth account to existing user
if (!user.email_verified) {
  await usersRepository.update(user.id, {
    emailVerified: true,
  });
  user.email_verified = true;
}
```

This ensures OAuth providers (GitHub, Google) act as email verifiers since they have already verified the user's email.

### Frontend Code Quality (v0.1.2)

**CSS Architecture**:
- `@apply` utilities in `styles/layout.css`:
  - Icon sizes: `.icon-xs` through `.icon-xl`
  - Button variants: `.btn-cyber`, `.btn-cyber-sm`, `.btn-cyber-md`, `.btn-cyber-lg`
  - Border variants: `.border-cyber-xs` through `.border-cyber-hover`
  - Animation delays: `.fade-in-delay-0` through `.fade-in-delay-4`

**Custom Hooks** (`lib/hooks/`):
- `useAuth.ts` - Authentication state, token handling, getIdToken, decodeIdToken
- `useMediaQuery.ts` - Media queries with `useIsMobile()`, `useIsTablet()`, `useIsDesktop()`
- `useSidebar.ts` - Sidebar state with localStorage persistence

**Shared UI Components** (`components/ui/`):
- `Button.tsx` - Cyberpunk styled (variants: default, outline, ghost; sizes: sm, md, lg)
- `IconWrapper.tsx` - Icon container with consistent styling
- `Card.tsx` - Card with glow effects (variants: default, interactive)
- `StatusBadge.tsx` - Status indicator (running, idle, error, starting, stopped)

**Inline Style Reduction**:
- Before: 18 inline styles
- After: 8 inline styles
- Reduction: 56%

### Frontend Authentication (v0.1.2)

**LoginPage** (`pages/auth/LoginPage.tsx`):
- OAuth buttons (GitHub, Google)
- Email/password login form
- Registration form with toggle
- Loading states and error handling

**ProtectedRoute** (`components/layout/ProtectedRoute.tsx`):
- Redirects unauthenticated users to /login
- Preserves intended destination
- Loading spinner during auth check

**App.tsx Routing**:
- Protected dashboard route with ProtectedRoute wrapper
- LoginRedirect - redirects authenticated users away from login

**Header User Menu** (`components/layout/Header.tsx`):
- Dynamic user name/avatar display
- Dropdown menu with sign out
- User initials fallback

**Auth Hook** (`lib/hooks/useAuth.ts`):
- user, isLoading, isAuthenticated state
- setIdToken() - store JWT in localStorage
- logout() - call /auth/logout, clear tokens, redirect
- refreshUser() - refetch user data

---

## OpenClaw Research

See [claw-research.md](./claw-research.md) for detailed analysis of OpenClaw's architecture.

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
