import { db } from '../index.js';

export interface Memory {
  id: string;
  user_id: string;
  agent_id: string | null;
  content: string;
  embedding: number[] | null;
  memory_type: 'user' | 'system' | 'working';
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface MemoryCreateInput {
  user_id: string;
  agent_id?: string;
  content: string;
  embedding?: number[];
  memory_type?: 'user' | 'system' | 'working';
  metadata?: Record<string, unknown>;
}

export interface MemorySearchOptions {
  userId: string;
  agentId?: string;
  query?: string;
  limit?: number;
  memoryType?: 'user' | 'system' | 'working' | 'all';
}

export class MemoriesRepository {
  async create(input: MemoryCreateInput): Promise<Memory> {
    const { rows } = await db.query(
      `INSERT INTO memories (user_id, agent_id, content, embedding, memory_type, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.user_id,
        input.agent_id || null,
        input.content,
        input.embedding ? `[${input.embedding.join(',')}]` : null,
        input.memory_type || 'user',
        JSON.stringify(input.metadata || {}),
      ]
    );
    return this.mapRow(rows[0]);
  }

  async findById(id: string): Promise<Memory | null> {
    const { rows } = await db.query('SELECT * FROM memories WHERE id = $1', [id]);
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async findByUserId(userId: string, limit = 50, offset = 0): Promise<Memory[]> {
    const { rows } = await db.query(
      'SELECT * FROM memories WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );
    return rows.map((row) => this.mapRow(row));
  }

  async findByAgentId(agentId: string, limit = 50, offset = 0): Promise<Memory[]> {
    const { rows } = await db.query(
      'SELECT * FROM memories WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [agentId, limit, offset]
    );
    return rows.map((row) => this.mapRow(row));
  }

  async search(options: MemorySearchOptions): Promise<Memory[]> {
    const { userId, agentId, limit = 10 } = options;
    
    let query = 'SELECT * FROM memories WHERE user_id = $1';
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (agentId) {
      query += ` AND agent_id = $${paramIndex++}`;
      params.push(agentId);
    }

    if (options.memoryType && options.memoryType !== 'all') {
      query += ` AND memory_type = $${paramIndex++}`;
      params.push(options.memoryType);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const { rows } = await db.query(query, params);
    return rows.map((row) => this.mapRow(row));
  }

  async update(id: string, content: string): Promise<Memory | null> {
    const { rows } = await db.query(
      'UPDATE memories SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [content, id]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM memories WHERE id = $1', [id]);
    return rowCount !== null && rowCount > 0;
  }

  async deleteByAgentId(agentId: string): Promise<number> {
    const { rowCount } = await db.query('DELETE FROM memories WHERE agent_id = $1', [agentId]);
    return rowCount || 0;
  }

  async count(userId: string): Promise<number> {
    const { rows } = await db.query(
      'SELECT COUNT(*) as count FROM memories WHERE user_id = $1',
      [userId]
    );
    return parseInt(rows[0].count, 10);
  }

  private mapRow(row: Record<string, unknown>): Memory {
    let embedding: number[] | null = null;
    if (row.embedding) {
      const embStr = row.embedding as string;
      if (embStr.startsWith('[')) {
        embedding = embStr.slice(1, -1).split(',').map(Number);
      } else if (Array.isArray(row.embedding)) {
        embedding = row.embedding as number[];
      }
    }

    return {
      id: row.id as string,
      user_id: row.user_id as string,
      agent_id: row.agent_id as string | null,
      content: row.content as string,
      embedding,
      memory_type: row.memory_type as Memory['memory_type'],
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata as Record<string, unknown>),
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    };
  }
}

export const memoriesRepository = new MemoriesRepository();
