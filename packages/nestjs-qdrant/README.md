# NestJS Qdrant Module

[![GitHub Release](https://img.shields.io/github/v/release/PhillipAWells/nestjs-common)](https://github.com/PhillipAWells/nestjs-common/releases)
[![CI](https://github.com/PhillipAWells/nestjs-common/actions/workflows/ci.yml/badge.svg)](https://github.com/PhillipAWells/nestjs-common/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-qdrant.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-qdrant)
[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/PhillipAWells?style=social)](https://github.com/sponsors/PhillipAWells)

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

The `QdrantCollectionService` is not directly injectable. Instead, obtain instances via `QdrantService.collection(name)`:

```typescript
import { Injectable } from '@nestjs/common';
import { QdrantService } from '@pawells/nestjs-qdrant';

@Injectable()
export class VectorStoreService {
  constructor(private qdrantService: QdrantService) {}

  async getCollectionInfo(name: string) {
    const collection = this.qdrantService.collection(name);
    return collection.getInfo();
  }

  async upsertVectors(collectionName: string, points: any[]) {
    const collection = this.qdrantService.collection(collectionName);
    return collection.upsert({ points });
  }

  async deleteVectors(collectionName: string, pointIds: number[]) {
    const collection = this.qdrantService.collection(collectionName);
    return collection.delete({
      points_selector: {
        points: {
          ids: pointIds
        }
      }
    });
  }
}
```

## Configuration

### Overview

The `nestjs-qdrant` module uses **plain typed interfaces** (no Joi validation). All configuration comes from the `QdrantModuleOptions` type, which extends the Qdrant JS client's `QdrantClientParams`.

### API Key Security

**Important security note**: In `forRootAsync()`, the `apiKey` is automatically sanitized and **stripped from the publicly injectable options token**. This prevents accidental exposure of credentials through dependency injection. The apiKey is only available to the internal client factory.

### QdrantModule.forRoot()

Synchronous module registration with inline configuration:

```typescript
interface QdrantModuleOptions extends QdrantClientParams {
  url: string;              // Qdrant server URL (e.g., 'http://localhost:6333')
  apiKey?: string;          // API key for authentication (optional)
  timeout?: number;         // Request timeout in milliseconds (optional)
  retryAttempts?: number;   // Number of retry attempts (optional)
  retryDelay?: number;      // Delay between retries in milliseconds (optional)
  name?: string;            // Optional name for multi-client scenarios
}
```

**Note**: In `forRoot()`, the apiKey is also sanitized from the public options token, but stored separately for client initialization.

### forRootAsync() - Factory Function

Asynchronous registration using a factory function:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QdrantModule } from '@pawells/nestjs-qdrant';

@Module({
  imports: [
    ConfigModule.forRoot(),
    QdrantModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        url: configService.get('QDRANT_URL'),
        apiKey: configService.get('QDRANT_API_KEY'),
        timeout: configService.get('QDRANT_TIMEOUT') || 5000,
      }),
    }),
  ],
})
export class AppModule {}
```

### forRootAsync() - Class-Based Factory

Using a custom class that implements `QdrantOptionsFactory`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantOptionsFactory, QdrantModuleOptions } from '@pawells/nestjs-qdrant';

@Injectable()
export class QdrantConfigService implements QdrantOptionsFactory {
  constructor(private configService: ConfigService) {}

  async createQdrantOptions(): Promise<QdrantModuleOptions> {
    return {
      url: await this.configService.get('QDRANT_URL'),
      apiKey: this.configService.get('QDRANT_API_KEY'),
      timeout: this.configService.get('QDRANT_TIMEOUT') || 5000,
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot(),
    QdrantModule.forRootAsync({
      useClass: QdrantConfigService,
    }),
  ],
})
export class AppModule {}
```

### forRootAsync() - Reuse Existing Factory

Reuse an existing options factory from another module:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    QdrantModule.forRootAsync({
      useExisting: QdrantConfigService,
    }),
  ],
})
export class AppModule {}
```

### Multiple Named Clients

Register multiple Qdrant client instances with different names:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    QdrantModule.forRoot(
      {
        name: 'primary',
        url: 'http://primary-qdrant:6333',
        apiKey: process.env.PRIMARY_QDRANT_KEY,
      },
      false // Not global
    ),
    QdrantModule.forRoot(
      {
        name: 'backup',
        url: 'http://backup-qdrant:6333',
        apiKey: process.env.BACKUP_QDRANT_KEY,
      },
      false // Not global
    ),
  ],
})
export class AppModule {}
```

Then inject specific clients:

```typescript
@Injectable()
export class VectorService {
  constructor(
    @InjectQdrantClient('primary') private primaryClient: QdrantClient,
    @InjectQdrantClient('backup') private backupClient: QdrantClient,
  ) {}
}
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

## Service Usage

### QdrantService.collection() Validation

The `collection()` method validates collection names according to Qdrant rules:

- Must start and end with alphanumeric characters (a-z, A-Z, 0-9)
- Can contain hyphens (-) and underscores (_) in the middle
- Maximum length: 255 characters
- Invalid names throw `BadRequestException`

```typescript
const service = this.qdrantService;

// Valid names
service.collection('documents');        // ✓
service.collection('doc-embeddings');   // ✓
service.collection('doc_embeddings');   // ✓
service.collection('doc123');           // ✓

// Invalid names
service.collection('-documents');       // ✗ Starts with hyphen
service.collection('documents-');       // ✗ Ends with hyphen
service.collection('');                 // ✗ Empty string
service.collection('a'.repeat(256));    // ✗ Too long (> 255 chars)
```

### Error Handling

All QdrantCollectionService methods wrap errors with collection context:

```typescript
@Injectable()
export class VectorService {
  constructor(private qdrantService: QdrantService) {}

  async searchWithErrorHandling(embedding: number[]) {
    try {
      const collection = this.qdrantService.collection('embeddings');
      return await collection.search({
        vector: embedding,
        limit: 10,
      });
    } catch (error) {
      // Errors include collection context
      // E.g., "Qdrant search failed on collection \"embeddings\": 404 Collection not found"
      if (error.message?.includes('Collection not found')) {
        throw new NotFoundException('Embeddings collection not found');
      }
      throw new InternalServerErrorException('Vector search failed');
    }
  }
}
```

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

## Token Utilities

The module exports several constants and utility functions for manual dependency injection and advanced scenarios:

### Constants

- **`QDRANT_CLIENT_TOKEN`** — Injection token for the default Qdrant client instance
- **`QDRANT_MODULE_OPTIONS`** — Injection token for the sanitized module options (apiKey stripped for security)
- **`DEFAULT_QDRANT_CLIENT_NAME`** — The default client name constant (`'default'`)
- **`MAX_COLLECTION_NAME_LENGTH`** — Maximum allowed collection name length (255 characters)

### Utility Functions

#### `getQdrantClientToken(name?: string): string`

Returns the injection token for a named or default Qdrant client.

**Parameters:**
- `name` (optional) — Client name. If omitted or `'default'`, returns the base token for the default client.

**Returns:** Injection token string (e.g., `'QDRANT_CLIENT'` or `'QDRANT_CLIENT:archive'`)

#### `getQdrantModuleOptionsToken(name?: string): string`

Returns the injection token for module options for a named or default client.

**Parameters:**
- `name` (optional) — Client name. If omitted or `'default'`, returns the base token for default options.

**Returns:** Injection token string (e.g., `'QDRANT_MODULE_OPTIONS'` or `'QDRANT_MODULE_OPTIONS:backup'`)

### Manual Token Injection Example

If you need to inject a named client without using the `@InjectQdrantClient()` decorator, use `getQdrantClientToken()`:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { getQdrantClientToken } from '@pawells/nestjs-qdrant';

@Injectable()
export class MultiArchiveService {
  constructor(
    // Manual injection using token getter
    @Inject(getQdrantClientToken('primary'))
    private primaryClient: QdrantClient,

    @Inject(getQdrantClientToken('backup'))
    private backupClient: QdrantClient,
  ) {}

  async getPrimaryStats() {
    return this.primaryClient.getCollections();
  }

  async getBackupStats() {
    return this.backupClient.getCollections();
  }
}
```

Similarly, you can inject module options:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { getQdrantModuleOptionsToken } from '@pawells/nestjs-qdrant';
import type { QdrantModuleOptions } from '@pawells/nestjs-qdrant';

@Injectable()
export class ConfigInspector {
  constructor(
    @Inject(getQdrantModuleOptionsToken('primary'))
    private primaryOptions: QdrantModuleOptions,
  ) {}

  getUrl(): string {
    return this.primaryOptions.url;
  }
}
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
