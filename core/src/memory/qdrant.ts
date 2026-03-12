import { QdrantClient as QdrantRestClient } from '@qdrant/js-client-rest';

export interface QdrantConfig {
  url: string;
  apiKey?: string;
}

export interface SearchOptions {
  limit?: number;
  scoreThreshold?: number;
  filter?: Record<string, unknown>;
}

export interface PointPayload {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export class QdrantClient {
  private client: QdrantRestClient;
  private initialized = false;

  constructor(private config: QdrantConfig) {
    this.client = new QdrantRestClient({
      url: config.url,
      apiKey: config.apiKey,
    });
  }

  async ensureCollection(name: string, vectorSize: number): Promise<void> {
    try {
      const exists = await this.client.collectionExists(name);
      if (!exists) {
        await this.client.createCollection(name, {
          vectors: {
            size: vectorSize,
            distance: 'Cosine',
          },
        });
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to ensure Qdrant collection:', error);
      throw error;
    }
  }

  async upsert(collectionName: string, points: PointPayload[]): Promise<void> {
    await this.client.upsert(collectionName, {
      wait: true,
      points,
    });
  }

  async search(
    collectionName: string,
    queryVector: number[],
    options: SearchOptions = {}
  ): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> {
    const { limit = 10, scoreThreshold, filter } = options;

    const results = await this.client.search(collectionName, {
      vector: queryVector,
      limit,
      score_threshold: scoreThreshold,
      filter: filter ? this.buildFilter(filter) : undefined,
    });

    return results.map((r) => ({
      id: typeof r.id === 'string' ? r.id : String(r.id),
      score: r.score,
      payload: r.payload as Record<string, unknown>,
    }));
  }

  async delete(collectionName: string, ids: string[]): Promise<void> {
    await this.client.delete(collectionName, {
      wait: true,
      points: ids,
    });
  }

  async get(collectionName: string, ids: string[]): Promise<Array<{ id: string; payload: Record<string, unknown> }>> {
    const results = await this.client.retrieve(collectionName, {
      ids,
    });

    return results.map((r) => ({
      id: typeof r.id === 'string' ? r.id : String(r.id),
      payload: r.payload as Record<string, unknown>,
    }));
  }

  async count(collectionName: string): Promise<number> {
    const info = await this.client.getCollection(collectionName);
    return info.points_count || 0;
  }

  private buildFilter(filter: Record<string, unknown>): Record<string, unknown> {
    const conditions: Record<string, unknown>[] = [];

    for (const [key, value] of Object.entries(filter)) {
      conditions.push({
        key,
        match: value,
      });
    }

    return {
      must: conditions,
    };
  }
}
