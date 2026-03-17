import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import { DataLoaderRegistry } from './dataloader-registry.js';
import { Comment } from './comment.loader.js';

/**
 * DataLoader for loading comments by post ID
 * Prevents N+1 query problems when resolving post's comments in GraphQL
 */
@Injectable()
export class CommentsByPostLoader implements LazyModuleRefService {
	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get logger(): AppLogger {
		return this.AppLogger.createContextualLogger(CommentsByPostLoader.name);
	}

	public get DataLoaderRegistry(): DataLoaderRegistry {
		return this.Module.get(DataLoaderRegistry, { strict: false });
	}

	constructor(public readonly Module: ModuleRef) {}

	/**
   * Gets the comments by post DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for comments by post
   */
	public getLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(Comment[] | Error)[]>,
	): DataLoader<string, Comment[]> {
		return this.DataLoaderRegistry.createWithCache(
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
	// eslint-disable-next-line require-await
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
			this.logger.error(`Failed to load comments for post ${postId}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
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
			this.logger.error(`Failed to load comments for posts ${postIds}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
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
		this.DataLoaderRegistry.clearCache('comments-by-post-loader');
	}
}
