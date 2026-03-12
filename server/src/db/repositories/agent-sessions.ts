import { db } from '../index.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentSession {
  id: string;
  agent_id: string;
  user_id: string;
  title: string | null;
  status: 'active' | 'archived';
  summary: string | null;
  summary_up_to: number;
  created_at: Date;
  updated_at: Date;
}

export interface AgentSessionCreateInput {
  agent_id: string;
  user_id: string;
  title?: string;
}

export interface AgentSessionUpdateInput {
  title?: string;
  status?: 'active' | 'archived';
  summary?: string;
  summary_up_to?: number;
}

export interface SessionMessage {
  id: string;
  session_id: string;
  sequence_number: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls: Array<{ name: string; args: Record<string, unknown>; id?: string }> | null;
  tool_call_id: string | null;
  tool_name: string | null;
  token_count: number;
  created_at: Date;
}

export interface SessionMessageCreateInput {
  session_id: string;
  sequence_number: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{ name: string; args: Record<string, unknown>; id?: string }>;
  tool_call_id?: string;
  tool_name?: string;
  token_count?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

// ─── AgentSessionsRepository ──────────────────────────────────────────────────

export class AgentSessionsRepository {
  async create(input: AgentSessionCreateInput): Promise<AgentSession> {
    const { rows } = await db.query(
      `INSERT INTO agent_sessions (agent_id, user_id, title)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.agent_id, input.user_id, input.title ?? null],
    );
    return this.mapSessionRow(rows[0]);
  }

  async findById(id: string): Promise<AgentSession | null> {
    const { rows } = await db.query('SELECT * FROM agent_sessions WHERE id = $1', [id]);
    return rows[0] ? this.mapSessionRow(rows[0]) : null;
  }

  async findByAgentId(
    agentId: string,
    limit = 20,
    cursor?: string,
  ): Promise<PaginatedResult<AgentSession>> {
    let query: string;
    let params: unknown[];

    if (cursor) {
      query = `SELECT * FROM agent_sessions
               WHERE agent_id = $1 AND created_at < (SELECT created_at FROM agent_sessions WHERE id = $2)
               ORDER BY created_at DESC LIMIT $3`;
      params = [agentId, cursor, limit + 1];
    } else {
      query = `SELECT * FROM agent_sessions WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2`;
      params = [agentId, limit + 1];
    }

    const { rows } = await db.query(query, params);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((r) => this.mapSessionRow(r));
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { items, nextCursor };
  }

  async update(id: string, input: AgentSessionUpdateInput): Promise<AgentSession | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.title !== undefined) { fields.push(`title = $${idx++}`); values.push(input.title); }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }
    if (input.summary !== undefined) { fields.push(`summary = $${idx++}`); values.push(input.summary); }
    if (input.summary_up_to !== undefined) { fields.push(`summary_up_to = $${idx++}`); values.push(input.summary_up_to); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await db.query(
      `UPDATE agent_sessions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return rows[0] ? this.mapSessionRow(rows[0]) : null;
  }

  async archive(id: string): Promise<AgentSession | null> {
    return this.update(id, { status: 'archived' });
  }

  private mapSessionRow(row: Record<string, unknown>): AgentSession {
    return {
      id: row.id as string,
      agent_id: row.agent_id as string,
      user_id: row.user_id as string,
      title: row.title as string | null,
      status: row.status as 'active' | 'archived',
      summary: row.summary as string | null,
      summary_up_to: Number(row.summary_up_to ?? 0),
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    };
  }
}

// ─── SessionMessagesRepository ────────────────────────────────────────────────

export class SessionMessagesRepository {
  async create(input: SessionMessageCreateInput): Promise<SessionMessage> {
    const { rows } = await db.query(
      `INSERT INTO session_messages
         (session_id, sequence_number, role, content, tool_calls, tool_call_id, tool_name, token_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.session_id,
        input.sequence_number,
        input.role,
        input.content,
        input.tool_calls ? JSON.stringify(input.tool_calls) : null,
        input.tool_call_id ?? null,
        input.tool_name ?? null,
        input.token_count ?? 0,
      ],
    );
    return this.mapMessageRow(rows[0]);
  }

  async createBatch(inputs: SessionMessageCreateInput[]): Promise<SessionMessage[]> {
    if (inputs.length === 0) return [];
    return Promise.all(inputs.map((i) => this.create(i)));
  }

  async findBySessionId(
    sessionId: string,
    limit = 50,
    cursor?: string,
  ): Promise<PaginatedResult<SessionMessage>> {
    let query: string;
    let params: unknown[];

    if (cursor) {
      query = `SELECT * FROM session_messages
               WHERE session_id = $1 AND sequence_number > (
                 SELECT sequence_number FROM session_messages WHERE id = $2
               )
               ORDER BY sequence_number ASC LIMIT $3`;
      params = [sessionId, cursor, limit + 1];
    } else {
      query = `SELECT * FROM session_messages WHERE session_id = $1 ORDER BY sequence_number ASC LIMIT $2`;
      params = [sessionId, limit + 1];
    }

    const { rows } = await db.query(query, params);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((r) => this.mapMessageRow(r));
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { items, nextCursor };
  }

  async getLastN(sessionId: string, n: number): Promise<SessionMessage[]> {
    const { rows } = await db.query(
      `SELECT * FROM (
         SELECT * FROM session_messages WHERE session_id = $1 ORDER BY sequence_number DESC LIMIT $2
       ) sub ORDER BY sequence_number ASC`,
      [sessionId, n],
    );
    return rows.map((r) => this.mapMessageRow(r));
  }

  async count(sessionId: string): Promise<number> {
    const { rows } = await db.query(
      'SELECT COUNT(*)::integer AS count FROM session_messages WHERE session_id = $1',
      [sessionId],
    );
    return rows[0].count as number;
  }

  async nextSequenceNumber(sessionId: string): Promise<number> {
    const { rows } = await db.query(
      'SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next FROM session_messages WHERE session_id = $1',
      [sessionId],
    );
    return rows[0].next as number;
  }

  private mapMessageRow(row: Record<string, unknown>): SessionMessage {
    const rawToolCalls = row.tool_calls;
    let tool_calls: SessionMessage['tool_calls'] = null;
    if (rawToolCalls) {
      tool_calls = typeof rawToolCalls === 'string'
        ? JSON.parse(rawToolCalls)
        : rawToolCalls as SessionMessage['tool_calls'];
    }

    return {
      id: row.id as string,
      session_id: row.session_id as string,
      sequence_number: Number(row.sequence_number),
      role: row.role as SessionMessage['role'],
      content: row.content as string,
      tool_calls,
      tool_call_id: row.tool_call_id as string | null,
      tool_name: row.tool_name as string | null,
      token_count: Number(row.token_count ?? 0),
      created_at: new Date(row.created_at as string),
    };
  }
}

export const agentSessionsRepository = new AgentSessionsRepository();
export const sessionMessagesRepository = new SessionMessagesRepository();
