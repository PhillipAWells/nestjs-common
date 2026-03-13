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
 * Injectable service that wraps the Qdrant client
 * Provides unified access to Qdrant vector search functionality
 */
@Injectable()
export class QdrantService implements OnModuleDestroy {
	constructor(public readonly Module: ModuleRef) {}

	private get Client(): QdrantClient {
		const client = this.Module.get<QdrantClient>(QDRANT_CLIENT_TOKEN, { strict: false });
		if (!client) {
			throw new Error('QdrantService: Qdrant client is not initialized. Ensure QdrantModule is properly configured.');
		}
		return client;
	}

	/**
	 * Get the Qdrant client instance
	 * @returns The underlying QdrantClient instance
	 */
	public getClient(): QdrantClient {
		return this.Client;
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
		return new QdrantCollectionService(this.Client, collectionName);
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
