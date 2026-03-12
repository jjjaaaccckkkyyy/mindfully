import { initTRPC, TRPCError } from '@trpc/server';
import { Request, Response } from 'express';
import { verifyIdToken } from './auth/utils/id-token.js';

export interface Context {
  req: Request;
  res: Response;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  const req = ctx.req;
  
  // Try to get token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  if (!token) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No token provided' });
  }
  
  // Verify the JWT token
  const payload = verifyIdToken(token);
  if (!payload || !payload.sub) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' });
  }
  
  return next({
    ctx: {
      userId: payload.sub,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);
