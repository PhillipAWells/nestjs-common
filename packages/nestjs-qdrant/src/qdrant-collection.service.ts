/**
 * Qdrant Collection Service
 * Provides collection-scoped access to Qdrant operations
 */

import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Non-injectable service that wraps a QdrantClient and pre-binds a collection name.
 *
 * This service is not directly injectable; instead, obtain instances via
 * QdrantService.collection(name). It provides a convenient API for performing
 * operations on a specific collection without repeatedly passing the collection name.
 *
 * All methods wrap errors with collection context for easier debugging.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class VectorStoreService {
 *   constructor(private qdrantService: QdrantService) {}
 *
 *   async searchDocuments(embedding: number[]) {
 *     const collection = this.qdrantService.collection('documents');
 *     return collection.search({
 *       vector: embedding,
 *       limit: 10,
 *       with_payload: true
 *     });
 *   }
 * }
 * ```
 */
export class QdrantCollectionService {
	private readonly client: QdrantClient;

	public readonly collectionName: string;

	constructor(client: QdrantClient, collectionName: string) {
		this.client = client;
		this.collectionName = collectionName;
	}

	/**
	 * Search for points in the collection using vector similarity.
	 * Performs semantic search to find the most similar vectors and their associated payloads.
	 *
	 * @param params - Search parameters (collection name is automatically prepended)
	 * @param params.vector - Query vector (required)
	 * @param params.limit - Maximum number of results to return (required)
	 * @param params.score_threshold - Optional minimum similarity score threshold
	 * @param params.with_payload - Whether to return point payloads (default: true)
	 * @param params.with_vectors - Whether to return point vectors (default: false)
	 * @returns Search results containing matching points with scores and metadata
	 * @throws Error - If search fails, wraps the original error with collection context
	 *
	 * @example
	 * ```typescript
	 * const collection = qdrantService.collection('embeddings');
	 * const results = await collection.search({
	 *   vector: queryEmbedding,
	 *   limit: 10,
	 *   score_threshold: 0.7,
	 *   with_payload: true
	 * });
	 * ```
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
	 * Upsert (insert or update) points into the collection.
	 * Creates new points or updates existing ones matched by ID.
	 *
	 * @param params - Upsert parameters (collection name is automatically prepended)
	 * @param params.points - Array of points to upsert, each with id, vector, and optional payload
	 * @param params.wait - Whether to wait for indexing before returning (default: false)
	 * @returns Upsert operation result with update status
	 * @throws Error - If upsert fails, wraps the original error with collection context
	 *
	 * @example
	 * ```typescript
	 * const collection = qdrantService.collection('documents');
	 * await collection.upsert({
	 *   points: [
	 *     {
	 *       id: 1,
	 *       vector: embedding,
	 *       payload: { text: 'content', source: 'pdf' }
	 *     }
	 *   ],
	 *   wait: true
	 * });
	 * ```
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
	 * Delete points from the collection.
	 * Removes points matching the specified selector criteria.
	 *
	 * @param params - Delete parameters (collection name is automatically prepended)
	 * @param params.points_selector - Selector specifying which points to delete (by IDs or filter)
	 * @param params.wait - Whether to wait for deletion before returning (default: false)
	 * @returns Delete operation result with status
	 * @throws Error - If delete fails, wraps the original error with collection context
	 *
	 * @example
	 * ```typescript
	 * const collection = qdrantService.collection('documents');
	 * await collection.delete({
	 *   points_selector: {
	 *     points: {
	 *       ids: [1, 2, 3]
	 *     }
	 *   },
	 *   wait: true
	 * });
	 * ```
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
	 * Get collection information and statistics.
	 * Returns metadata about the collection including point count, vector size, and configuration.
	 *
	 * @returns Collection info object with statistics and configuration details
	 * @throws Error - If retrieval fails, wraps the original error with collection context
	 *
	 * @example
	 * ```typescript
	 * const collection = qdrantService.collection('embeddings');
	 * const info = await collection.getInfo();
	 * console.log(`Collection has ${info.points_count} points`);
	 * ```
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
