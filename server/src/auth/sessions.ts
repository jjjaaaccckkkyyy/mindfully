import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';

const PgSession = connectPgSimple(session);

let pool: Pool | null = null;

export function createSessionStore() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  });
}

export function getSessionConfig() {
  return {
    store: createSessionStore(),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  };
}

export async function closeSessionPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
