import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const db = {
  query: pool.query.bind(pool),
  end: pool.end.bind(pool),
  
  async healthCheck(): Promise<boolean> {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  },
};

export type Database = typeof db;
