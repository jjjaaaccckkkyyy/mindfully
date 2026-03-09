import { db } from '../index';

export interface VerificationToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export interface CreateTokenData {
  userId: string;
  token: string;
  expiresAt: Date;
}

export const verificationTokenRepository = {
  async create(data: CreateTokenData): Promise<VerificationToken> {
    const result = await db.query<VerificationToken>(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.userId, data.token, data.expiresAt]
    );

    return result.rows[0];
  },

  async findByToken(token: string): Promise<VerificationToken | null> {
    const result = await db.query<VerificationToken>(
      'SELECT * FROM email_verification_tokens WHERE token = $1',
      [token]
    );

    return result.rows[0] || null;
  },

  async delete(token: string): Promise<boolean> {
    const result = await db.query('DELETE FROM email_verification_tokens WHERE token = $1', [token]);
    return (result.rowCount ?? 0) > 0;
  },

  async deleteExpired(): Promise<number> {
    const result = await db.query('DELETE FROM email_verification_tokens WHERE expires_at < NOW()');
    return result.rowCount ?? 0;
  },

  async deleteByUserId(userId: string): Promise<boolean> {
    const result = await db.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
    return (result.rowCount ?? 0) > 0;
  },
};

export const passwordResetTokenRepository = {
  async create(data: CreateTokenData): Promise<VerificationToken> {
    const result = await db.query<VerificationToken>(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.userId, data.token, data.expiresAt]
    );

    return result.rows[0];
  },

  async findByToken(token: string): Promise<VerificationToken | null> {
    const result = await db.query<VerificationToken>(
      'SELECT * FROM password_reset_tokens WHERE token = $1',
      [token]
    );

    return result.rows[0] || null;
  },

  async delete(token: string): Promise<boolean> {
    const result = await db.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
    return (result.rowCount ?? 0) > 0;
  },

  async deleteExpired(): Promise<number> {
    const result = await db.query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');
    return result.rowCount ?? 0;
  },

  async deleteByUserId(userId: string): Promise<boolean> {
    const result = await db.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    return (result.rowCount ?? 0) > 0;
  },
};
