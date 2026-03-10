# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.1.2] - 2026-03-09

### Completed

**Authentication System**
- Passport.js authentication with session management
- OAuth 2.0 providers: GitHub, Google
- Client-side OAuth flow with backend verification
- Email registration (OAuth verification required)
- Password reset functionality
- PostgreSQL session storage (connect-pg-simple)
- JWT id_token generation (jsonwebtoken)

**Backend Auth**
- User repositories (PostgreSQL with pg driver)
- OAuth account repositories
- Token repositories (email verification, password reset)
- Password hashing (bcrypt, 12 rounds)
- Custom JWT id_token for all providers
- Access token and refresh token storage
- Token update on login (replaces old tokens)

**Auth Endpoints**
- `POST /auth/github/verify` - GitHub OAuth verification
- `POST /auth/google/verify` - Google OAuth verification
- `POST /auth/register` - Email registration (auto-verified)
- `POST /auth/login` - Email login
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user
- `GET /auth/verify-email` - Email verification (reserved)
- `POST /auth/resend-verification` - Resend verification email (reserved)
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password` - Password reset

**Frontend Auth**
- Login page with cyberpunk theme
- Email/password registration form
- OAuth callback handler
- React Router for client-side routing
- id_token storage in localStorage
- Protected routes with authentication guard
- User menu in header with logout functionality

**Infrastructure**
- Docker Compose for PostgreSQL
- CORS configuration for frontend-backend
- Environment configuration (.env files)
- Database initialization script

### Changed
- Passport.js instead of Auth.js (NextAuth)
- PostgreSQL with pg driver instead of Prisma/Drizzle
- Client-side OAuth flow instead of server-side redirects
- Email verification via OAuth (email registration → OAuth login → verified)
- OAuth linking updates email_verified to true

### Fixed
- CSS build errors (circular @apply references in layout.css)
- Text input width issues in login form (flexbox layout)
- Login/logout flow now working end-to-end
- Protected routes redirect properly

### Token Strategy
| Token | Storage | Purpose | Lifetime |
|-------|---------|---------|----------|
| id_token | Frontend localStorage | User identity (JWT) | 1 hour |
| access_token | Backend database | API calls to provider | 1 hour |
| refresh_token | Backend database | Refresh access tokens | Long-lived |
| session cookie | Browser | Auth with backend | Session-based |

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
- **Mindmap visualization**: Custom SVG mindmap replacing tree view
  - Radial gradient nodes with pulse animations
  - Connection lines with hover effects
  - Grid overlay for cyberpunk effect

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

## [v0.1.3] - Future

### Planned (Server)
- LangChain/LangGraph agent framework integration
- A2A Protocol + MCP for inter-agent communication
- AWS SQS task queue
