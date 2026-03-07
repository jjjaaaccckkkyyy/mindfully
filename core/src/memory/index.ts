export interface MemoryEntry {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
}

export interface MemoryService {
  add(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<MemoryEntry>;
  search(query: string, limit?: number): Promise<MemorySearchResult[]>;
  delete(id: string): Promise<void>;
}

export class InMemoryStore implements MemoryService {
  private store: MemoryEntry[] = [];

  async add(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<MemoryEntry> {
    const newEntry: MemoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    this.store.push(newEntry);
    return newEntry;
  }

  async search(query: string, limit = 10): Promise<MemorySearchResult[]> {
    const results = this.store
      .filter((entry) => entry.content.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit)
      .map((entry) => ({ entry, score: 1.0 }));
    return results;
  }

  async delete(id: string): Promise<void> {
    this.store = this.store.filter((entry) => entry.id !== id);
  }
}
