import { db } from '../index';

export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  name: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  passwordHash?: string;
  name?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
}

export interface UpdateUserData {
  name?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
  passwordHash?: string;
}

export const usersRepository = {
  async findById(id: string): Promise<User | null> {
    const result = await db.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const result = await db.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    return result.rows[0] || null;
  },

  async create(data: CreateUserData): Promise<User> {
    const result = await db.query<User>(
      `INSERT INTO users (email, password_hash, name, avatar_url, email_verified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.email.toLowerCase(),
        data.passwordHash || null,
        data.name || null,
        data.avatarUrl || null,
        data.emailVerified || false,
      ]
    );
    return result.rows[0];
  },

  async update(id: string, data: UpdateUserData): Promise<User | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramCount++}`);
      values.push(data.avatarUrl);
    }
    if (data.emailVerified !== undefined) {
      updates.push(`email_verified = $${paramCount++}`);
      values.push(data.emailVerified);
    }
    if (data.passwordHash !== undefined) {
      updates.push(`password_hash = $${paramCount++}`);
      values.push(data.passwordHash);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query<User>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.query('DELETE FROM users WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },
};
