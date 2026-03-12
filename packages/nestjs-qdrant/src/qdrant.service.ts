/**
 * Qdrant Service
 * Provides access to the Qdrant client for vector search operations
 */

import { BadRequestException, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { MAX_COLLECTION_NAME_LENGTH, QDRANT_CLIENT_TOKEN } from './qdrant.constants.js';
import { QdrantCollectionService } from './qdrant-collection.service.js';

/**
 * Injectable service that wraps the Qdrant client
 * Provides unified access to Qdrant vector search functionality
 */
@Injectable()
export class QdrantService implements OnModuleDestroy {
	constructor(@Inject(QDRANT_CLIENT_TOKEN) private readonly client: QdrantClient) {}

	/**
	 * Get the Qdrant client instance
	 * @returns The underlying QdrantClient instance
	 */
	public getClient(): QdrantClient {
		return this.client;
	}

	/**
	 * Get a collection-scoped service for the given collection name
	 * @param collectionName Name of the collection
	 * @returns A QdrantCollectionService scoped to the collection
	 * @throws BadRequestException if collection name is invalid
	 */
	public collection(collectionName: string): QdrantCollectionService {
		if (!collectionName || collectionName.length > MAX_COLLECTION_NAME_LENGTH || !/^[a-zA-Z0-9]([a-zA-Z0-9_-]*[a-zA-Z0-9])?$/.test(collectionName)) {
			throw new BadRequestException(`Invalid collection name: "${collectionName}"`);
		}
		return new QdrantCollectionService(this.client, collectionName);
	}

	/**
	 * Cleanup on module destruction
	 * Closes the Qdrant client if supported
	 */
	public onModuleDestroy(): void {
		// The Qdrant JS client does not expose a close/destroy method
		// but this lifecycle hook is implemented for future compatibility
		// and to allow proper cleanup if the underlying client implements it
	}
}
