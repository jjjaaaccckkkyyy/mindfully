import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { agentRouter, executionRouter, memoryRouter, toolRouter } from './agent';

export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return `Hello, ${input.name}!`;
    }),
  agent: agentRouter,
  execution: executionRouter,
  memory: memoryRouter,
  tool: toolRouter,
});

export type AppRouter = typeof appRouter;
