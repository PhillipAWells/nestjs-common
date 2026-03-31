import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import { DataLoaderRegistry } from './dataloader-registry.js';

/**
 * Interface for IComment entity
 */
export interface IComment {
	id: string;
	[key: string]: any;
}

/**
 * DataLoader for loading comments by ID
 * Prevents N+1 query problems when resolving comment fields in GraphQL
 */
@Injectable()
export class CommentLoader implements ILazyModuleRefService {
	public readonly Module: ModuleRef;

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get Logger(): IContextualLogger {
		return this.AppLogger.createContextualLogger(CommentLoader.name);
	}

	public get DataLoaderRegistry(): DataLoaderRegistry {
		return this.Module.get(DataLoaderRegistry, { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
   * Gets the comment DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for comments
   */
	public GetLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(IComment | Error)[]>,
	): DataLoader<string, IComment> {
		return this.DataLoaderRegistry.CreateWithCache(
			'comment-loader',
			batchLoadFn ?? this.DefaultBatchLoadFn.bind(this),
		);
	}

	/**
   * Default batch loading function for comments
   * This should be overridden with actual database/service logic
   * @param commentIds Array of comment IDs to load
   * @returns Promise resolving to array of comments or errors
   */
	// eslint-disable-next-line require-await
	private async DefaultBatchLoadFn(
		commentIds: readonly string[],
	): Promise<(IComment | Error)[]> {
		this.Logger.warn(
			'Using default comment batch loader. Override with actual implementation.',
		);

		return commentIds.map(
			(id) =>
				new Error(
					`CommentLoader not implemented. Override batchLoadFn for comment ID: ${id}`,
				),
		);
	}

	/**
   * Loads a single comment by ID
   * @param commentId IComment ID to load
   * @returns Promise resolving to comment or undefined
   */
	public async Load(commentId: string): Promise<IComment | undefined> {
		const Loader = this.GetLoader();
		try {
			return await Loader.load(commentId);
		} catch (error) {
			this.Logger.error(`Failed to load comment ${commentId}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return undefined;
		}
	}

	/**
   * Loads multiple comments by IDs
   * @param commentIds Array of comment IDs to load
   * @returns Promise resolving to array of comments
   */
	public async LoadMany(commentIds: string[]): Promise<(IComment | Error)[]> {
		const Loader = this.GetLoader();
		try {
			return await Loader.loadMany(commentIds);
		} catch (error) {
			this.Logger.error(`Failed to load comments ${commentIds}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return commentIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific comment
   * @param commentId IComment ID to clear from cache
   */
	public Clear(commentId: string): void {
		const Loader = this.GetLoader();
		Loader.clear(commentId);
		this.Logger.debug(`Cleared cache for comment ${commentId}`);
	}

	/**
   * Clears all cached comments
   */
	public ClearAll(): void {
		this.DataLoaderRegistry.ClearCache('comment-loader');
	}
}
