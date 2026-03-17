import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import { DataLoaderRegistry } from './dataloader-registry.js';
import { Comment } from './comment.loader.js';

/**
 * DataLoader for loading comments by user ID
 * Prevents N+1 query problems when resolving user's comments in GraphQL
 */
@Injectable()
export class CommentsByUserLoader implements LazyModuleRefService {
	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get logger(): AppLogger {
		return this.AppLogger.createContextualLogger(CommentsByUserLoader.name);
	}

	public get DataLoaderRegistry(): DataLoaderRegistry {
		return this.Module.get(DataLoaderRegistry, { strict: false });
	}

	constructor(public readonly Module: ModuleRef) {}

	/**
   * Gets the comments by user DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for comments by user
   */
	public getLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(Comment[] | Error)[]>,
	): DataLoader<string, Comment[]> {
		return this.DataLoaderRegistry.createWithCache(
			'comments-by-user-loader',
			batchLoadFn ?? this.defaultBatchLoadFn.bind(this),
		);
	}

	/**
   * Default batch loading function for comments by user
   * This should be overridden with actual database/service logic
   * @param userIds Array of user IDs to load comments for
   * @returns Promise resolving to arrays of comments or errors
   */
	// eslint-disable-next-line require-await
	private async defaultBatchLoadFn(
		userIds: readonly string[],
	): Promise<(Comment[] | Error)[]> {
		this.logger.warn(
			'Using default comments by user batch loader. Override with actual implementation.',
		);

		return userIds.map(
			(userId) =>
				new Error(
					`CommentsByUserLoader not implemented. Override batchLoadFn for user ID: ${userId}`,
				),
		);
	}

	/**
   * Loads comments for a single user by user ID
   * @param userId User ID to load comments for
   * @returns Promise resolving to array of comments or undefined
   */
	public async load(userId: string): Promise<Comment[] | undefined> {
		const loader = this.getLoader();
		try {
			return await loader.load(userId);
		} catch (error) {
			this.logger.error(`Failed to load comments for user ${userId}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return undefined;
		}
	}

	/**
   * Loads comments for multiple users by user IDs
   * @param userIds Array of user IDs to load comments for
   * @returns Promise resolving to arrays of comments
   */
	public async loadMany(userIds: string[]): Promise<(Comment[] | Error)[]> {
		const loader = this.getLoader();
		try {
			return await loader.loadMany(userIds);
		} catch (error) {
			this.logger.error(`Failed to load comments for users ${userIds}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return userIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific user's comments
   * @param userId User ID to clear comments cache for
   */
	public clear(userId: string): void {
		const loader = this.getLoader();
		loader.clear(userId);
		this.logger.debug(`Cleared cache for comments of user ${userId}`);
	}

	/**
   * Clears all cached comments by user
   */
	public clearAll(): void {
		this.DataLoaderRegistry.clearCache('comments-by-user-loader');
	}
}
