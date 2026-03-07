# Development Lifecycle

## Overview

This document outlines the development workflow for the Mindful platform. The lifecycle is iterative and will evolve over time.

---

## Frontend Development

### Workflow
1. **Write code** - Implement the feature/component
2. **Write tests** - Create tests for the implementation
3. **Visual review** - Use agent-browser to take snapshot and verify

### Requirements
- Every update must have tests
- Visual verification via agent-browser snapshots
- No PR merge without passing tests and visual review

---

## Backend / Library Development

### Workflow
1. **Write tests first** - TDD approach preferred
2. **Write code** - Implement to make tests pass
3. **Ensure coverage** - Maintain >80% code coverage
4. **Code review** - Each interaction confirmed with unit tests

### Requirements
- Unit tests are mandatory
- Minimum 80% code coverage (tracked via coverage reports)
- No PR merge without passing tests and coverage threshold
- All public APIs must have test coverage

---

## Testing Strategy

### Frontend
- Component tests (Vitest + React Testing Library)
- E2E snapshots (agent-browser)
- Visual regression verification

### Backend
- Unit tests (Vitest)
- Integration tests
- Coverage reports (c8/vitest coverage)

### Libraries
- Unit tests (Vitest)
- Type testing
- Mock external dependencies

---

## General Guidelines

- All tests must pass before merging
- Coverage reports must meet threshold
- Visual reviews for UI changes
- Documentation updates for API changes

---

## Lifecycle Versions

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-03-07 | Initial lifecycle definition |
