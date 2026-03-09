/**
 * Qdrant Collection Service
 * Provides collection-scoped access to Qdrant operations
 */

import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Non-injectable service that wraps a QdrantClient and pre-binds a collection name
 * Obtained via QdrantService.collection(name)
 */
export class QdrantCollectionService {
	constructor(
		private readonly client: QdrantClient,
		public readonly collectionName: string
	) {}

	/**
	 * Search for points in the collection
	 * @param params Search parameters (excluding collection name)
	 * @returns Search results
	 */
	// eslint-disable-next-line require-await
	public async search(params: Parameters<QdrantClient['search']>[1]): ReturnType<QdrantClient['search']> {
		return this.client.search(this.collectionName, params);
	}

	/**
	 * Upsert points into the collection
	 * @param params Upsert parameters (excluding collection name)
	 * @returns Upsert result
	 */
	// eslint-disable-next-line require-await
	public async upsert(params: Parameters<QdrantClient['upsert']>[1]): ReturnType<QdrantClient['upsert']> {
		return this.client.upsert(this.collectionName, params);
	}

	/**
	 * Delete points from the collection
	 * @param params Delete parameters (excluding collection name)
	 * @returns Delete result
	 */
	// eslint-disable-next-line require-await
	public async delete(params: Parameters<QdrantClient['delete']>[1]): ReturnType<QdrantClient['delete']> {
		return this.client.delete(this.collectionName, params);
	}

	/**
	 * Get collection information
	 * @returns Collection info
	 */
	// eslint-disable-next-line require-await
	public async getInfo(): ReturnType<QdrantClient['getCollection']> {
		return this.client.getCollection(this.collectionName);
	}
}
