import { db } from '../index.js';

export interface Execution {
  id: string;
  agent_id: string;
  input: string;
  output: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error: string | null;
  token_usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  started_at: Date;
  completed_at: Date | null;
}

export interface ExecutionCreateInput {
  agent_id: string;
  input: string;
}

export interface ExecutionUpdateInput {
  output?: Record<string, unknown>;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  token_usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  completed_at?: Date;
}

export class ExecutionsRepository {
  async create(input: ExecutionCreateInput): Promise<Execution> {
    const { rows } = await db.query(
      `INSERT INTO agent_executions (agent_id, input, status, token_usage)
       VALUES ($1, $2, 'pending', $3)
       RETURNING *`,
      [input.agent_id, input.input, JSON.stringify({ inputTokens: 0, outputTokens: 0, totalTokens: 0 })]
    );
    return this.mapRow(rows[0]);
  }

  async findById(id: string): Promise<Execution | null> {
    const { rows } = await db.query('SELECT * FROM agent_executions WHERE id = $1', [id]);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async findByAgentId(agentId: string, limit = 50, offset = 0): Promise<Execution[]> {
    const { rows } = await db.query(
      'SELECT * FROM agent_executions WHERE agent_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3',
      [agentId, limit, offset]
    );
    return rows.map((row) => this.mapRow(row));
  }

  async update(id: string, input: ExecutionUpdateInput): Promise<Execution | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.output !== undefined) {
      fields.push(`output = $${paramIndex++}`);
      values.push(JSON.stringify(input.output));
    }
    if (input.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.error !== undefined) {
      fields.push(`error = $${paramIndex++}`);
      values.push(input.error);
    }
    if (input.token_usage !== undefined) {
      fields.push(`token_usage = $${paramIndex++}`);
      values.push(JSON.stringify(input.token_usage));
    }
    if (input.completed_at !== undefined) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(input.completed_at);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const { rows } = await db.query(
      `UPDATE agent_executions SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM agent_executions WHERE id = $1', [id]);
    return rowCount !== null && rowCount > 0;
  }

  async deleteByAgentId(agentId: string): Promise<number> {
    const { rowCount } = await db.query('DELETE FROM agent_executions WHERE agent_id = $1', [agentId]);
    return rowCount || 0;
  }

  async linkSession(id: string, sessionId: string): Promise<void> {
    await db.query('UPDATE agent_executions SET session_id = $1 WHERE id = $2', [sessionId, id]);
  }

  private mapRow(row: Record<string, unknown>): Execution {
    return {
      id: row.id as string,
      agent_id: row.agent_id as string,
      input: row.input as string,
      output: typeof row.output === 'string' ? JSON.parse(row.output) : (row.output as Record<string, unknown>),
      status: row.status as Execution['status'],
      error: row.error as string | null,
      token_usage: typeof row.token_usage === 'string' 
        ? JSON.parse(row.token_usage) 
        : (row.token_usage as Execution['token_usage']),
      started_at: new Date(row.started_at as string),
      completed_at: row.completed_at ? new Date(row.completed_at as string) : null,
    };
  }
}

export const executionsRepository = new ExecutionsRepository();
