import { v4 as uuidv4 } from 'uuid';

export interface MemoryEntry {
  id: string;
  userId: string;
  agentId?: string;
  content: string;
  memoryType: 'user' | 'system' | 'working';
  metadata?: Record<string, unknown>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
}

export interface MemorySearchOptions {
  limit?: number;
  scoreThreshold?: number;
  agentId?: string;
  memoryType?: 'user' | 'system' | 'working' | 'all';
}

export { MarkdownStore } from './markdown.js';
export { QdrantClient, type QdrantConfig } from './qdrant.js';
export { MemoryService, type MemoryServiceConfig } from './service.js';

export class InMemoryStore {
  private store: MemoryEntry[] = [];

  async add(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry> {
    const now = new Date();
    const newEntry: MemoryEntry = {
      ...entry,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };
    this.store.push(newEntry);
    return newEntry;
  }

  async search(query: string, _userId: string, options: MemorySearchOptions = {}): Promise<MemorySearchResult[]> {
    const { limit = 10 } = options;
    const results = this.store
      .filter((entry) => entry.content.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit)
      .map((entry) => ({ entry, score: 1.0 }));
    return results;
  }

  async delete(id: string): Promise<void> {
    this.store = this.store.filter((entry) => entry.id !== id);
  }

  async getRecent(userId: string, agentId?: string, limit = 10): Promise<MemoryEntry[]> {
    return this.store
      .filter((entry) => entry.userId === userId && (!agentId || entry.agentId === agentId))
      .slice(0, limit);
  }
}
