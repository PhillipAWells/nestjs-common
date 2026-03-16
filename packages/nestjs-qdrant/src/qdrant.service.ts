/**
 * Qdrant Service
 * Provides access to the Qdrant client for vector search operations
 */

import { BadRequestException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { QdrantClient } from '@qdrant/js-client-rest';
import { MAX_COLLECTION_NAME_LENGTH, QDRANT_CLIENT_TOKEN } from './qdrant.constants.js';
import { QdrantCollectionService } from './qdrant-collection.service.js';

/**
 * Injectable service that wraps the Qdrant client.
 * Provides unified access to Qdrant vector search functionality and collection management.
 *
 * This service acts as a facade over the Qdrant client, providing:
 * - Direct access to the underlying QdrantClient instance via getClient()
 * - Collection-scoped services via the collection() method
 * - Lifecycle management and module integration
 *
 * @Injectable()
 * @example
 * ```typescript
 * @Injectable()
 * export class SearchService {
 *   constructor(private qdrantService: QdrantService) {}
 *
 *   async searchCollection(name: string, embedding: number[]) {
 *     const collection = this.qdrantService.collection(name);
 *     return collection.search({ vector: embedding, limit: 10 });
 *   }
 * }
 * ```
 */
@Injectable()
export class QdrantService implements OnModuleDestroy {
	constructor(public readonly moduleRef: ModuleRef) {}

	private get client(): QdrantClient {
		const clientInstance = this.moduleRef.get<QdrantClient>(QDRANT_CLIENT_TOKEN, { strict: false });
		if (!clientInstance) {
			throw new Error('QdrantService: Qdrant client is not initialized. Ensure QdrantModule is properly configured.');
		}
		return clientInstance;
	}

	/**
	 * Get the Qdrant client instance.
	 * Returns the underlying QdrantClient for direct access to all Qdrant API operations.
	 *
	 * @returns The underlying QdrantClient instance
	 * @throws Error - If the Qdrant client is not initialized (module not configured)
	 *
	 * @example
	 * ```typescript
	 * const client = this.qdrantService.getClient();
	 * await client.recreateCollection('my-collection', {
	 *   vectors: { size: 384, distance: 'Cosine' }
	 * });
	 * ```
	 */
	public getClient(): QdrantClient {
		return this.client;
	}

	/**
	 * Get a collection-scoped service for the given collection name.
	 * Returns a QdrantCollectionService pre-bound to the specified collection.
	 *
	 * Collection names must:
	 * - Start and end with alphanumeric characters
	 * - Contain only alphanumeric characters, hyphens, and underscores
	 * - Be at most 255 characters long
	 *
	 * @param collectionName - Name of the collection to scope to
	 * @returns A QdrantCollectionService instance scoped to the specified collection
	 * @throws BadRequestException - If the collection name is invalid or too long
	 *
	 * @example
	 * ```typescript
	 * const collection = this.qdrantService.collection('documents');
	 * const results = await collection.search({
	 *   vector: embedding,
	 *   limit: 10
	 * });
	 * ```
	 */
	public collection(collectionName: string): QdrantCollectionService {
		if (!collectionName || collectionName.length > MAX_COLLECTION_NAME_LENGTH || !/^[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?$/.test(collectionName)) {
			throw new BadRequestException(`Invalid collection name: "${collectionName}"`);
		}
		return new QdrantCollectionService(this.client, collectionName);
	}

	/**
	 * Module lifecycle hook called on application shutdown.
	 * Currently a no-op as the Qdrant JS client does not expose close/destroy methods,
	 * but this hook is maintained for future compatibility and graceful shutdown patterns.
	 *
	 * @returns void
	 */
	public onModuleDestroy(): void {
		// The Qdrant JS client does not expose a close/destroy method
		// but this lifecycle hook is implemented for future compatibility
		// and to allow proper cleanup if the underlying client implements it
	}
}
