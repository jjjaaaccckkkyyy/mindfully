import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { agentRouter, executionRouter, memoryRouter, toolRouter } from './agent';
import { sessionRouter } from './session';

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
  session: sessionRouter,
});

export type AppRouter = typeof appRouter;
