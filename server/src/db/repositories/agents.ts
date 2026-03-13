import { db } from '../index.js';

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  description: string;
  model: string;
  tools: string[];
  memory_enabled: boolean;
  system_prompt: string | null;
  max_tokens: number;
  temperature: number;
  provider_override: string | null;
  provider_model: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AgentCreateInput {
  user_id: string;
  name: string;
  description?: string;
  model?: string;
  tools?: string[];
  memory_enabled?: boolean;
  system_prompt?: string;
  max_tokens?: number;
  temperature?: number;
  provider_override?: string;
  provider_model?: string;
}

export interface AgentUpdateInput {
  name?: string;
  description?: string;
  model?: string;
  tools?: string[];
  memory_enabled?: boolean;
  system_prompt?: string;
  max_tokens?: number;
  temperature?: number;
  provider_override?: string;
  provider_model?: string;
}

export class AgentsRepository {
  async create(input: AgentCreateInput): Promise<Agent> {
    const { rows } = await db.query(
      `INSERT INTO agents (user_id, name, description, model, tools, memory_enabled, system_prompt, max_tokens, temperature, provider_override, provider_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.user_id,
        input.name,
        input.description || '',
        input.model || 'gpt-4o-mini',
        JSON.stringify(input.tools || []),
        input.memory_enabled || false,
        input.system_prompt || null,
        input.max_tokens || 4096,
        input.temperature || 0.7,
        input.provider_override || null,
        input.provider_model || null,
      ]
    );
    return this.mapRow(rows[0]);
  }

  async findById(id: string): Promise<Agent | null> {
    const { rows } = await db.query('SELECT * FROM agents WHERE id = $1', [id]);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async findByUserId(userId: string, limit = 50, offset = 0): Promise<Agent[]> {
    const { rows } = await db.query(
      'SELECT * FROM agents WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return rows.map((row) => this.mapRow(row));
  }

  async update(id: string, input: AgentUpdateInput): Promise<Agent | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.model !== undefined) {
      fields.push(`model = $${paramIndex++}`);
      values.push(input.model);
    }
    if (input.tools !== undefined) {
      fields.push(`tools = $${paramIndex++}`);
      values.push(JSON.stringify(input.tools));
    }
    if (input.memory_enabled !== undefined) {
      fields.push(`memory_enabled = $${paramIndex++}`);
      values.push(input.memory_enabled);
    }
    if (input.system_prompt !== undefined) {
      fields.push(`system_prompt = $${paramIndex++}`);
      values.push(input.system_prompt);
    }
    if (input.max_tokens !== undefined) {
      fields.push(`max_tokens = $${paramIndex++}`);
      values.push(input.max_tokens);
    }
    if (input.temperature !== undefined) {
      fields.push(`temperature = $${paramIndex++}`);
      values.push(input.temperature);
    }
    if (input.provider_override !== undefined) {
      fields.push(`provider_override = $${paramIndex++}`);
      values.push(input.provider_override);
    }
    if (input.provider_model !== undefined) {
      fields.push(`provider_model = $${paramIndex++}`);
      values.push(input.provider_model);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await db.query(
      `UPDATE agents SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM agents WHERE id = $1', [id]);
    return rowCount !== null && rowCount > 0;
  }

  async count(userId: string): Promise<number> {
    const { rows } = await db.query(
      'SELECT COUNT(*) as count FROM agents WHERE user_id = $1',
      [userId]
    );
    return parseInt(rows[0].count, 10);
  }

  private mapRow(row: Record<string, unknown>): Agent {
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      name: row.name as string,
      description: row.description as string,
      model: row.model as string,
      tools: typeof row.tools === 'string' ? JSON.parse(row.tools) : (row.tools as string[]),
      memory_enabled: row.memory_enabled as boolean,
      system_prompt: row.system_prompt as string | null,
      max_tokens: row.max_tokens as number,
      temperature: Number(row.temperature),
      provider_override: row.provider_override as string | null,
      provider_model: row.provider_model as string | null,
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    };
  }
}

export const agentsRepository = new AgentsRepository();
