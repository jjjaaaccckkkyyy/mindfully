import { db } from '../index';

export interface OAuthAccount {
  id: string;
  user_id: string;
  provider: string;
  provider_user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  created_at: Date;
}

export interface CreateOAuthAccountData {
  userId: string;
  provider: string;
  providerUserId: string;
  accessToken?: string;
  refreshToken?: string;
}

export const oauthAccountRepository = {
  async create(data: CreateOAuthAccountData): Promise<OAuthAccount> {
    const result = await db.query<OAuthAccount>(
      `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, access_token, refresh_token)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.userId, data.provider, data.providerUserId, data.accessToken || null, data.refreshToken || null]
    );

    return result.rows[0];
  },

  async findByProviderAndId(provider: string, providerUserId: string): Promise<OAuthAccount | null> {
    const result = await db.query<OAuthAccount>(
      'SELECT * FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2',
      [provider, providerUserId]
    );

    return result.rows[0] || null;
  },

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    const result = await db.query<OAuthAccount>(
      'SELECT * FROM oauth_accounts WHERE user_id = $1',
      [userId]
    );

    return result.rows;
  },

  async updateTokens(id: string, accessToken?: string, refreshToken?: string): Promise<OAuthAccount | null> {
    const result = await db.query<OAuthAccount>(
      `UPDATE oauth_accounts 
       SET access_token = $1, refresh_token = $2
       WHERE id = $3
       RETURNING *`,
      [accessToken || null, refreshToken || null, id]
    );

    return result.rows[0] || null;
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.query('DELETE FROM oauth_accounts WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },

  async deleteByUserId(userId: string): Promise<boolean> {
    const result = await db.query('DELETE FROM oauth_accounts WHERE user_id = $1', [userId]);
    return (result.rowCount ?? 0) > 0;
  },
};
