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
		public readonly collectionName: string,
	) {}

	/**
	 * Search for points in the collection
	 * @param params Search parameters (excluding collection name)
	 * @returns Search results
	 * @throws Error with context if search fails
	 */
	public async search(params: Parameters<QdrantClient['search']>[1]): ReturnType<QdrantClient['search']> {
		try {
			return await this.client.search(this.collectionName, params);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`Qdrant search failed on collection "${this.collectionName}": ${errorMessage}`, { cause: error });
		}
	}

	/**
	 * Upsert points into the collection
	 * @param params Upsert parameters (excluding collection name)
	 * @returns Upsert result
	 * @throws Error with context if upsert fails
	 */
	public async upsert(params: Parameters<QdrantClient['upsert']>[1]): ReturnType<QdrantClient['upsert']> {
		try {
			return await this.client.upsert(this.collectionName, params);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`Qdrant upsert failed on collection "${this.collectionName}": ${errorMessage}`, { cause: error });
		}
	}

	/**
	 * Delete points from the collection
	 * @param params Delete parameters (excluding collection name)
	 * @returns Delete result
	 * @throws Error with context if delete fails
	 */
	public async delete(params: Parameters<QdrantClient['delete']>[1]): ReturnType<QdrantClient['delete']> {
		try {
			return await this.client.delete(this.collectionName, params);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`Qdrant delete failed on collection "${this.collectionName}": ${errorMessage}`, { cause: error });
		}
	}

	/**
	 * Get collection information
	 * @returns Collection info
	 * @throws Error with context if getInfo fails
	 */
	public async getInfo(): ReturnType<QdrantClient['getCollection']> {
		try {
			return await this.client.getCollection(this.collectionName);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(`Qdrant getCollection failed on collection "${this.collectionName}": ${errorMessage}`, { cause: error });
		}
	}
}
