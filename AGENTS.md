# AGENTS.md

This file provides guidelines for AI coding agents working in this repository.

## Project Overview

Multi-agent platform with monorepo structure:
- **server**: Express + tRPC API
- **client**: React + Tailwind + shadcn/ui + Motion + Recharts + React D3 Tree
- **core**: Agent implementations (LangGraph, MCP, A2A, RAG)

Local development only.

## Commands

### Installation
```bash
pnpm install
```

### Development
```bash
pnpm dev          # Start all services (server + client)
```

### Build & Start
```bash
pnpm build        # Build all packages
pnpm start        # Start production server
```

### Testing
```bash
pnpm test         # Run all tests
pnpm test <file>  # Run single test file
```

### Linting & Formatting
```bash
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix ESLint issues
pnpm format       # Format code with Prettier
```

### Type Checking
```bash
pnpm typecheck    # Run TypeScript type checking
```

## Workspace Structure

```
mindful/
├── package.json              # Root workspace
├── pnpm-workspace.yaml
├── server/                   # Express + tRPC API
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── router/           # tRPC routers
│   │   └── trpc.ts           # tRPC setup
│   └── package.json
├── client/                   # Frontend (React)
│   ├── src/
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── core/                     # Agent implementations
    ├── src/
    │   ├── agents/           # Agent definitions
    │   ├── tools/            # MCP tools
    │   ├── memory/           # RAG/Memory
    │   └── index.ts
    └── package.json
```

## Imports

Use absolute imports with workspace names:
```typescript
// Server/Client import from core
import { AgentBuilder } from 'core/agents';

// Within core
import { MemoryService } from 'core/memory';

// Relative imports for local files
import { MyUtil } from './utils';
```

## Code Style Guidelines

### Naming Conventions

- **Files**: kebab-case (e.g., `user-service.ts`, `api-client.ts`)
- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.ts`)
- **Types/Interfaces**: PascalCase (e.g., `UserResponse`, `ApiError`)
- **Constants**: UPPER_SNAKE_CASE for runtime constants, camelCase for config keys
- **Enums**: PascalCase with PascalCase members

### TypeScript

- Always use explicit types for function parameters and return values
- Use `interface` for object shapes, `type` for unions/aliases
- Avoid `any` - use `unknown` when type is truly unknown
- Use strict null checks

```typescript
// Good
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

function getUserById(id: string): Promise<User | null> {
  // ...
}

// Avoid
function getUser(id: any): Promise<any> {
  // ...
}
```

### Error Handling

Use custom error classes for domain errors:
```typescript
class NotFoundError extends Error {
  constructor(public readonly resource: string, public readonly id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

class ValidationError extends Error {
  constructor(public readonly fields: Record<string, string[]>) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}
```

Always include error context in try-catch:
```typescript
try {
  await userService.update(id, data);
} catch (error) {
  if (error instanceof NotFoundError) {
    throw new ApiError(404, error.message);
  }
  logger.error('Failed to update user', { id, error });
  throw new ApiError(500, 'Internal server error');
}
```

### Async/Await

Use explicit async/await, never rely on implicit promises:
```typescript
// Good
const user = await db.user.findUnique({ where: { id } });
if (!user) throw new NotFoundError('User', id);

// Avoid
const user = db.user.findUnique({ where: { id } }); // Promise<void>
```

### React/Component Guidelines

- Use functional components with hooks
- Keep components small and focused
- Extract custom hooks for reusable logic
- Use composition over inheritance

```typescript
// Good - small focused component
export function UserCard({ user, onEdit }: UserCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <UserEmail email={user.email} />
      </CardContent>
      <CardFooter>
        <Button onClick={() => onEdit(user.id)}>Edit</Button>
      </CardFooter>
    </Card>
  );
}
```

### tRPC Procedures

Define procedures following RESTful conventions:
```typescript
// public procedures
export const userRouter = router({
  list: publicProcedure
    .query(async () => { /* ... */ }),
  
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => { /* ... */ }),

// protected procedures
  create: protectedProcedure
    .input(userSchema)
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), data: userSchema }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),
});
```

### Agent Definitions (BIO.md)

When creating agent definitions in `core/src/agents/`:
- Define clear role and specialization
- List all available tools
- Specify behavior patterns (plan-first, validate changes, etc.)
- Include success criteria

```markdown
# Agent: CodeArchitect
## Specialization
System design, architecture decisions, code review

## Tools
- read, grep, edit, bash
- mcp__filesystem
- mcp__web_search

## Behavior
- Always plan before executing
- Validate changes with tests
- Request confirmation for destructive operations

## Success Criteria
- Code compiles without errors
- Tests pass
- No security vulnerabilities
```

### Testing Guidelines

- Use Vitest for unit tests
- Follow AAA pattern: Arrange, Act, Assert
- Test behavior, not implementation
- Mock external dependencies
- Name tests descriptively

```typescript
describe('UserService', () => {
  describe('getById', () => {
    it('should return user when user exists', async () => {
      // Arrange
      const mockUser = { id: '1', name: 'John' };
      mockDb.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await userService.getById('1');

      // Assert
      expect(result).toEqual(mockUser);
    });

    it('should return null when user does not exist', async () => {
      // Arrange
      mockDb.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await userService.getById('999');

      // Assert
      expect(result).toBeNull();
    });
  });
});
```

### Core Package Structure

```
core/src/
├── agents/           # Agent implementations (LangGraph)
│   ├── base/         # Base agent class
│   └── types/        # Agent type definitions
├── tools/            # MCP tools
│   ├── filesystem/
│   ├── web-search/
│   └── ...
├── memory/           # RAG/Memory (Qdrant client)
├── a2a/              # A2A protocol implementation
└── index.ts          # Exports
```

### Database

- Use Prisma or Drizzle as ORM
- Define migrations in `prisma/migrations/`
- Never expose raw SQL to the client
- Use transactions for multi-table operations

### Security

- Validate all user input with Zod schemas
- Sanitize data before logging
- Never expose secrets in error messages
- Use parameterized queries (handled by ORM)
- Implement rate limiting on public endpoints
