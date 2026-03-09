/**
 * Qdrant Service
 * Provides access to the Qdrant client for vector search operations
 */

import { Inject, Injectable } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { QDRANT_CLIENT_TOKEN } from './qdrant.constants.js';
import { QdrantCollectionService } from './qdrant-collection.service.js';

/**
 * Injectable service that wraps the Qdrant client
 * Provides unified access to Qdrant vector search functionality
 */
@Injectable()
export class QdrantService {
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
	 */
	public collection(collectionName: string): QdrantCollectionService {
		return new QdrantCollectionService(this.client, collectionName);
	}
}
