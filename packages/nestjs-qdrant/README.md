# @pawells/nestjs-qdrant

[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-qdrant.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-qdrant)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

NestJS module for Qdrant vector database integration with type-safe client injection and collection management.

## Installation

```bash
yarn add @pawells/nestjs-qdrant @qdrant/js-client-rest
```

## Requirements

- **Node.js**: >= 24.0.0
- **NestJS**: >= 10.0.0
- **@qdrant/js-client-rest**: >= 1.0.0

## Peer Dependencies

```json
{
  "@nestjs/common": ">=10.0.0",
  "@qdrant/js-client-rest": ">=1.0.0"
}
```

## Quick Start

### Module Setup

```typescript
import { Module } from '@nestjs/common';
import { QdrantModule } from '@pawells/nestjs-qdrant';

@Module({
  imports: [
    QdrantModule.forRoot({
      url: 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    }),
  ],
})
export class AppModule {}
```

### Using QdrantService

```typescript
import { Injectable } from '@nestjs/common';
import { QdrantService, InjectQdrantClient } from '@pawells/nestjs-qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';

@Injectable()
export class EmbeddingService {
  constructor(
    @InjectQdrantClient() private qdrantClient: QdrantClient,
    private qdrantService: QdrantService,
  ) {}

  async searchSimilar(embedding: number[]) {
    // Search for similar vectors
    const results = await this.qdrantClient.search('embeddings', {
      vector: embedding,
      limit: 10,
      score_threshold: 0.7,
    });

    return results;
  }

  async createCollection(name: string) {
    // Create a new collection
    await this.qdrantClient.recreateCollection(name, {
      vectors: {
        size: 384, // Dimension of embeddings
        distance: 'Cosine',
      },
    });
  }
}
```

### Using QdrantCollectionService

```typescript
import { Injectable } from '@nestjs/common';
import { QdrantCollectionService } from '@pawells/nestjs-qdrant';

@Injectable()
export class VectorStoreService {
  constructor(private collectionService: QdrantCollectionService) {}

  async getCollectionInfo(name: string) {
    return this.collectionService.getInfo(name);
  }

  async upsertVectors(collection: string, points: any[]) {
    return this.collectionService.upsert(collection, points);
  }

  async deleteVectors(collection: string, ids: number[]) {
    return this.collectionService.delete(collection, ids);
  }
}
```

## Configuration

### QdrantModule.forRoot()

```typescript
interface QdrantModuleOptions {
  url: string; // Qdrant server URL (e.g., 'http://localhost:6333')
  apiKey?: string; // API key for authentication
  timeout?: number; // Request timeout in milliseconds
  retryAttempts?: number; // Number of retry attempts
  retryDelay?: number; // Delay between retries in milliseconds
}
```

### forRootAsync()

```typescript
QdrantModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    url: configService.get('QDRANT_URL'),
    apiKey: configService.get('QDRANT_API_KEY'),
    timeout: configService.get('QDRANT_TIMEOUT') || 5000,
  }),
  inject: [ConfigService],
})
```

### Using Custom Options Factory

```typescript
class QdrantConfigService {
  createQdrantOptions(): QdrantModuleOptions {
    return {
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    };
  }
}

@Module({
  imports: [
    QdrantModule.forRootAsync({
      useClass: QdrantConfigService,
    }),
  ],
})
export class AppModule {}
```

## Key Features

### Client Injection
- **@InjectQdrantClient()**: Type-safe client injection
- **QdrantClient**: Full Qdrant API access
- **Multi-tenant Support**: Multiple Qdrant instances via named clients

### Collection Management
- **QdrantCollectionService**: Collection CRUD operations
- **Vector Upsert**: Insert/update vectors
- **Vector Search**: Semantic search with similarity scoring
- **Batch Operations**: Efficient bulk operations

### Type Safety
- **TypeScript Support**: Full type definitions
- **Custom Point Types**: Type-safe vector points
- **Configuration Validation**: Type checking at module initialization

## Common Operations

### Create Collection

```typescript
const client = this.qdrantClient;

await client.recreateCollection('documents', {
  vectors: {
    size: 384,
    distance: 'Cosine',
  },
  optimizers_config: {
    default_segment_number: 2,
    snapshot_on_idle: 60,
  },
  replication_factor: 1,
});
```

### Search Vectors

```typescript
const results = await client.search('documents', {
  vector: embedding, // 384-dimensional vector
  limit: 10,
  score_threshold: 0.7,
  with_payload: true,
  with_vectors: false,
});
```

### Upsert Points

```typescript
await client.upsert('documents', {
  points: [
    {
      id: 1,
      vector: embedding,
      payload: {
        text: 'Document content',
        source: 'pdf',
      },
    },
    // More points...
  ],
});
```

### Scroll Points

```typescript
const scrollResult = await client.scroll('documents', {
  limit: 100,
  with_payload: true,
  with_vectors: false,
});

const points = scrollResult.points;
const nextOffset = scrollResult.next_page_offset;
```

### Delete Points

```typescript
await client.delete('documents', {
  points_selector: {
    points: {
      ids: [1, 2, 3],
    },
  },
});
```

## Advanced Usage

### Custom Point Type

```typescript
interface DocumentPoint {
  id: number;
  vector: number[];
  payload: {
    title: string;
    content: string;
    metadata: Record<string, unknown>;
  };
}

@Injectable()
export class DocumentSearchService {
  constructor(@InjectQdrantClient() private client: QdrantClient) {}

  async searchDocuments(query: number[]): Promise<DocumentPoint[]> {
    const results = await this.client.search('documents', {
      vector: query,
      limit: 10,
      with_payload: true,
    });

    return results as DocumentPoint[];
  }
}
```

### Error Handling

```typescript
@Injectable()
export class VectorStoreService {
  constructor(@InjectQdrantClient() private client: QdrantClient) {}

  async searchWithFallback(embedding: number[]) {
    try {
      return await this.client.search('vectors', {
        vector: embedding,
        limit: 10,
      });
    } catch (error) {
      if (error.status === 404) {
        throw new NotFoundException('Collection not found');
      }
      throw new InternalServerErrorException('Qdrant search failed');
    }
  }
}
```

## Connecting to Qdrant

### Local Development

```bash
# Run Qdrant with Docker
docker run -p 6333:6333 qdrant/qdrant:latest
```

```typescript
QdrantModule.forRoot({
  url: 'http://localhost:6333',
})
```

### Production (with API Key)

```typescript
QdrantModule.forRoot({
  url: 'https://qdrant.example.com:6333',
  apiKey: process.env.QDRANT_API_KEY,
  timeout: 10000,
})
```

### Qdrant Cloud

```typescript
QdrantModule.forRoot({
  url: 'https://your-cluster-url.qdrant.io:6333',
  apiKey: process.env.QDRANT_API_KEY,
})
```

## Related Packages

- **[@pawells/nestjs-shared](https://www.npmjs.com/package/@pawells/nestjs-shared)** - Foundation library

## License

MIT
