import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        // Test files
        'src/**/*.test.ts',
        // CLI entry point — not unit-testable
        'src/cli/run-agent.ts',
        // Re-export barrels have no logic
        'src/index.ts',
        'src/agents/index.ts',
        'src/agents/prompt/index.ts',
      ],
    },
  },
});
