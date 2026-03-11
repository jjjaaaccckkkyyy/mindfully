import { db } from '../index';

interface SessionRow {
  sid: string;
  sess: {
    passport?: { user: string };
    cookie?: {
      originalMaxAge?: number;
      expires?: string;
    };
    userAgent?: string;
    ip?: string;
  } | string;
  expire: Date;
}

interface ActiveSession {
  id: string;
  userAgent?: string;
  ip?: string;
  lastActive: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

export const sessionsRepository = {
  async findByUserId(userId: string, currentSessionId?: string): Promise<ActiveSession[]> {
    const result = await db.query<SessionRow>(
      `SELECT sid, sess, expire FROM session WHERE sess::jsonb->'passport'->>'user' = $1 AND expire > NOW() ORDER BY expire DESC`,
      [userId]
    );

    return result.rows.map((row) => {
      const sess = typeof row.sess === 'string' ? JSON.parse(row.sess) : row.sess;
      return {
        id: row.sid,
        userAgent: sess?.userAgent,
        ip: sess?.ip,
        lastActive: sess?.cookie?.expires 
          ? new Date(new Date(sess.cookie.expires).getTime() - (sess.cookie.originalMaxAge || 604800000))
          : new Date(),
        expiresAt: row.expire,
        isCurrent: row.sid === currentSessionId,
      };
    });
  },

  async deleteBySessionId(sid: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM session WHERE sid = $1',
      [sid]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async deleteAllExcept(userId: string, exceptSessionId: string): Promise<number> {
    const result = await db.query(
      `DELETE FROM session WHERE sess::jsonb->'passport'->>'user' = $1 AND sid != $2 AND expire > NOW()`,
      [userId, exceptSessionId]
    );
    return result.rowCount ?? 0;
  },

  async countByUserId(userId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) FROM session WHERE sess::jsonb->'passport'->>'user' = $1 AND expire > NOW()`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  },
};
