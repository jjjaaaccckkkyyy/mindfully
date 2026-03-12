import { createLogger } from '../logger.js';

const logger = createLogger('core:embeddings');

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  dimensions: number;
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

const DIMENSIONS = 1536;

function createZeroVector(): number[] {
  return new Array(DIMENSIONS).fill(0);
}

/**
 * Returns an EmbeddingProvider backed by OpenAI text-embedding-3-small.
 * Falls back to a zero-vector (with a warning) when OPENAI_API_KEY is absent.
 */
export function createEmbeddingProvider(apiKey?: string): EmbeddingProvider {
  const key = apiKey || process.env.OPENAI_API_KEY;
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

  if (!key) {
    logger.warn(
      'OPENAI_API_KEY not set — embedding provider will return zero-vectors. ' +
        'RAG retrieval will be non-functional.',
    );
    return {
      dimensions: DIMENSIONS,
      async embed(_text: string): Promise<number[]> {
        logger.warn('embed() called but OPENAI_API_KEY is not set; returning zero-vector');
        return createZeroVector();
      },
    };
  }

  return {
    dimensions: DIMENSIONS,
    async embed(text: string): Promise<number[]> {
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({ model, input: text }),
        });

        if (!response.ok) {
          const err = await response.text();
          throw new Error(`OpenAI embeddings API error ${response.status}: ${err}`);
        }

        const data = (await response.json()) as OpenAIEmbeddingResponse;
        const embedding = data.data[0]?.embedding;
        if (!embedding || embedding.length === 0) {
          throw new Error('OpenAI embeddings API returned empty embedding');
        }
        return embedding;
      } catch (error) {
        logger.warn('Failed to generate embedding; falling back to zero-vector', {
          error: error instanceof Error ? error.message : String(error),
        });
        return createZeroVector();
      }
    },
  };
}
