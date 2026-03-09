import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import session from 'express-session';
import { appRouter } from './router';
import authRouter from './router/auth';
import { passport, getSessionConfig } from './auth';
import { db } from './db';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.BASE_URL 
    : 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session(getSessionConfig()));

app.use(passport.initialize());
app.use(passport.session());

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
  })
);

app.use('/auth', authRouter);

app.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
