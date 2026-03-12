import { v4 as uuidv4 } from 'uuid';
import { MarkdownStore } from './markdown.js';
import { QdrantClient, type QdrantConfig } from './qdrant.js';
import { createEmbeddingProvider, type EmbeddingProvider } from './embeddings.js';

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

export interface MemoryServiceConfig {
  qdrant?: QdrantConfig;
  vectorSize?: number;
  collectionName?: string;
}

export class MemoryService {
  private markdownStore: MarkdownStore;
  private qdrantClient?: QdrantClient;
  private collectionName: string;
  private vectorSize: number;
  private embeddingProvider: EmbeddingProvider;

  constructor(config: MemoryServiceConfig = {}) {
    this.markdownStore = new MarkdownStore();
    this.collectionName = config.collectionName || 'mindful_memories';
    this.vectorSize = config.vectorSize || 1536;
    this.embeddingProvider = createEmbeddingProvider();

    if (config.qdrant) {
      this.qdrantClient = new QdrantClient(config.qdrant);
    }
  }

  async initialize(): Promise<void> {
    if (this.qdrantClient) {
      await this.qdrantClient.ensureCollection(this.collectionName, this.vectorSize);
    }
  }

  async add(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry> {
    const now = new Date();
    const newEntry: MemoryEntry = {
      ...entry,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };

    if (this.qdrantClient && newEntry.embedding) {
      await this.qdrantClient.upsert(this.collectionName, [
        {
          id: newEntry.id,
          vector: newEntry.embedding,
          payload: {
            userId: newEntry.userId,
            agentId: newEntry.agentId || '',
            content: newEntry.content,
            memoryType: newEntry.memoryType,
            metadata: newEntry.metadata,
            createdAt: newEntry.createdAt.toISOString(),
          },
        },
      ]);
    }

    if (newEntry.memoryType === 'user' || newEntry.memoryType === 'working') {
      await this.markdownStore.append(
        newEntry.userId,
        newEntry.content,
        newEntry.agentId,
        `${newEntry.memoryType}.md`
      );
    }

    return newEntry;
  }

  async search(query: string, userId: string, options: MemorySearchOptions = {}): Promise<MemorySearchResult[]> {
    const { limit = 10, scoreThreshold, agentId, memoryType = 'all' } = options;

    const results: MemorySearchResult[] = [];

    if (this.qdrantClient) {
      const filter: Record<string, unknown> = { userId };
      if (agentId) filter.agentId = agentId;
      if (memoryType !== 'all') filter.memoryType = memoryType;

      const queryVector = await this.embeddingProvider.embed(query);

      const vectorResults = await this.qdrantClient.search(
        this.collectionName,
        queryVector,
        { limit, scoreThreshold, filter }
      );

      for (const r of vectorResults) {
        results.push({
          entry: {
            id: r.id,
            userId: String(r.payload.userId || ''),
            agentId: String(r.payload.agentId || ''),
            content: String(r.payload.content || ''),
            memoryType: String(r.payload.memoryType || 'user') as MemoryEntry['memoryType'],
            metadata: r.payload.metadata as Record<string, unknown> | undefined,
            createdAt: new Date(String(r.payload.createdAt || Date.now())),
            updatedAt: new Date(String(r.payload.createdAt || Date.now())),
          },
          score: r.score,
        });
      }
    }

    const markdownResults = await this.searchMarkdown(query, userId, agentId, limit);
    for (const r of markdownResults) {
      if (!results.find((existing) => existing.entry.id === r.entry.id)) {
        results.push(r);
      }
    }

    return results.slice(0, limit);
  }

  private async searchMarkdown(
    query: string,
    userId: string,
    agentId?: string,
    limit = 10
  ): Promise<MemorySearchResult[]> {
    const files = await this.markdownStore.list(userId, agentId);
    const results: MemorySearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const file of files) {
      const content = await this.markdownStore.load(userId, agentId, file);
      if (content.toLowerCase().includes(queryLower)) {
        results.push({
          entry: {
            id: `${userId}-${agentId || 'global'}-${file}`,
            userId,
            agentId,
            content,
            memoryType: file.replace('.md', '') as MemoryEntry['memoryType'],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          score: 0.5,
        });
      }
    }

    return results.slice(0, limit);
  }

  async getRecent(userId: string, agentId?: string, limit = 10): Promise<MemoryEntry[]> {
    const entries: MemoryEntry[] = [];

    if (agentId) {
      const files = await this.markdownStore.list(userId, agentId);
      for (const file of files.slice(0, limit)) {
        const content = await this.markdownStore.load(userId, agentId, file);
        entries.push({
          id: `${userId}-${agentId}-${file}`,
          userId,
          agentId,
          content,
          memoryType: file.replace('.md', '') as MemoryEntry['memoryType'],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return entries;
  }

  async delete(id: string): Promise<void> {
    if (this.qdrantClient) {
      await this.qdrantClient.delete(this.collectionName, [id]);
    }
  }

  async getMemoryFile(userId: string, agentId?: string): Promise<string> {
    return this.markdownStore.load(userId, agentId, 'memory.md');
  }

  async updateMemoryFile(userId: string, content: string, agentId?: string): Promise<void> {
    await this.markdownStore.save(userId, content, agentId, 'memory.md');
  }
}
