import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import expressWinston from 'express-winston';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import session from 'express-session';
import { appRouter } from './router';
import authRouter from './router/auth';
import { passport, getSessionConfig } from './auth';
import { db } from './db';
import { initEmailService } from './email';
import { logger } from './logger';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize email service
initEmailService();

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.BASE_URL 
    : 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
app.use(expressWinston.logger({
  winstonInstance: logger,
  meta: false,
  msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms',
  expressFormat: false,
  colorize: false,
}));

app.use(session(getSessionConfig()));

app.use(passport.initialize());
app.use(passport.session());

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req, res }) => ({
      req,
      res,
    }),
  })
);

app.use('/auth', authRouter);

app.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});
