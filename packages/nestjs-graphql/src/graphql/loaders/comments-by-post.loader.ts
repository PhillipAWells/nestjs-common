import DataLoader from 'dataloader';
import { Injectable, Logger } from '@nestjs/common';
import { DataLoaderRegistry } from './dataloader-registry.js';
import { Comment } from './comment.loader.js';

/**
 * DataLoader for loading comments by post ID
 * Prevents N+1 query problems when resolving post's comments in GraphQL
 */
@Injectable()
export class CommentsByPostLoader {
	private readonly logger = new Logger(CommentsByPostLoader.name);

	constructor(
		private readonly dataLoaderRegistry: DataLoaderRegistry,
	) {}

	/**
   * Gets the comments by post DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for comments by post
   */
	public getLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(Comment[] | Error)[]>,
	): DataLoader<string, Comment[]> {
		return this.dataLoaderRegistry.createWithCache(
			'comments-by-post-loader',
			batchLoadFn ?? this.defaultBatchLoadFn.bind(this),
		);
	}

	/**
   * Default batch loading function for comments by post
   * This should be overridden with actual database/service logic
   * @param postIds Array of post IDs to load comments for
   * @returns Promise resolving to arrays of comments or errors
   */
	private async defaultBatchLoadFn(
		postIds: readonly string[],
	): Promise<(Comment[] | Error)[]> {
		this.logger.warn(
			'Using default comments by post batch loader. Override with actual implementation.',
		);

		return postIds.map(
			(postId) =>
				new Error(
					`CommentsByPostLoader not implemented. Override batchLoadFn for post ID: ${postId}`,
				),
		);
	}

	/**
   * Loads comments for a single post by post ID
   * @param postId Post ID to load comments for
   * @returns Promise resolving to array of comments or undefined
   */
	public async load(postId: string): Promise<Comment[] | undefined> {
		const loader = this.getLoader();
		try {
			return await loader.load(postId);
		} catch (error) {
			this.logger.error(`Failed to load comments for post ${postId}`, error);
			return undefined;
		}
	}

	/**
   * Loads comments for multiple posts by post IDs
   * @param postIds Array of post IDs to load comments for
   * @returns Promise resolving to arrays of comments
   */
	public async loadMany(postIds: string[]): Promise<(Comment[] | Error)[]> {
		const loader = this.getLoader();
		try {
			return await loader.loadMany(postIds);
		} catch (error) {
			this.logger.error(`Failed to load comments for posts ${postIds}`, error);
			return postIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific post's comments
   * @param postId Post ID to clear comments cache for
   */
	public clear(postId: string): void {
		const loader = this.getLoader();
		loader.clear(postId);
		this.logger.debug(`Cleared cache for comments of post ${postId}`);
	}

	/**
   * Clears all cached comments by post
   */
	public clearAll(): void {
		this.dataLoaderRegistry.clearCache('comments-by-post-loader');
	}
}
