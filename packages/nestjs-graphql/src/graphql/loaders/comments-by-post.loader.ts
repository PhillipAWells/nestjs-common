import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import { DataLoaderRegistry } from './dataloader-registry.js';
import { IComment } from './comment.loader.js';

/**
 * DataLoader for loading comments by post ID
 * Prevents N+1 query problems when resolving post's comments in GraphQL
 */
@Injectable()
export class CommentsByPostLoader implements ILazyModuleRefService {
	public readonly Module: ModuleRef;

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get Logger(): IContextualLogger {
		return this.AppLogger.createContextualLogger(CommentsByPostLoader.name);
	}

	public get DataLoaderRegistry(): DataLoaderRegistry {
		return this.Module.get(DataLoaderRegistry, { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
   * Gets the comments by post DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for comments by post
   */
	public GetLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(IComment[] | Error)[]>,
	): DataLoader<string, IComment[]> {
		return this.DataLoaderRegistry.CreateWithCache(
			'comments-by-post-loader',
			batchLoadFn ?? this.DefaultBatchLoadFn.bind(this),
		);
	}

	/**
   * Default batch loading function for comments by post
   * This should be overridden with actual database/service logic
   * @param postIds Array of post IDs to load comments for
   * @returns Promise resolving to arrays of comments or errors
   */
	// eslint-disable-next-line require-await
	private async DefaultBatchLoadFn(
		postIds: readonly string[],
	): Promise<(IComment[] | Error)[]> {
		this.Logger.warn(
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
	public async Load(postId: string): Promise<IComment[] | undefined> {
		const Loader = this.GetLoader();
		try {
			return await Loader.load(postId);
		} catch (error) {
			this.Logger.error(`Failed to load comments for post ${postId}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return undefined;
		}
	}

	/**
   * Loads comments for multiple posts by post IDs
   * @param postIds Array of post IDs to load comments for
   * @returns Promise resolving to arrays of comments
   */
	public async LoadMany(postIds: string[]): Promise<(IComment[] | Error)[]> {
		const Loader = this.GetLoader();
		try {
			return await Loader.loadMany(postIds);
		} catch (error) {
			this.Logger.error(`Failed to load comments for posts ${postIds}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return postIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific post's comments
   * @param postId Post ID to clear comments cache for
   */
	public Clear(postId: string): void {
		const Loader = this.GetLoader();
		Loader.clear(postId);
		this.Logger.debug(`Cleared cache for comments of post ${postId}`);
	}

	/**
   * Clears all cached comments by post
   */
	public ClearAll(): void {
		this.DataLoaderRegistry.ClearCache('comments-by-post-loader');
	}
}
