export interface MemoryEntry {
  id: string;
  agentId: string;
  content: string;
  embedding: number[];
  metadata: MemoryMetadata;
  createdAt: Date;
}

export interface MemoryMetadata {
  type: MemoryType;
  source?: 'user' | 'agent' | 'tool' | 'system';
  tags?: string[];
  score?: number;
}

export type MemoryType = 'conversation' | 'fact' | 'tool_result' | 'reflection';

export interface MemoryQuery {
  agentId: string;
  query: string;
  limit?: number;
  threshold?: number;
  type?: MemoryType;
  tags?: string[];
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
  highlights?: string[];
}

export interface MemoryStats {
  agentId: string;
  totalEntries: number;
  byType: Record<MemoryType, number>;
  lastUpdated: Date;
}

export interface EmbeddingConfig {
  provider: 'openai' | 'custom';
  model: string;
  dimensions: number;
}

export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
};

export interface TextChunk {
  content: string;
  index: number;
  startIndex: number;
  endIndex: number;
}

export interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  chunkSize: 1000,
  chunkOverlap: 200,
};

export interface MemoryFilter {
  agentId: string;
  types?: MemoryType[];
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
}

export interface MemoryUpsertInput {
  agentId: string;
  content: string;
  metadata?: Partial<MemoryMetadata>;
}

export interface MemoryDeleteInput {
  id?: string;
  agentId: string;
  olderThan?: Date;
  types?: MemoryType[];
  tags?: string[];
}
