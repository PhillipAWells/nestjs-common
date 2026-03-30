import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';
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

	private get Logger(): AppLogger {
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
	public getLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(IComment | Error)[]>,
	): DataLoader<string, IComment> {
		return this.DataLoaderRegistry.createWithCache(
			'comment-loader',
			batchLoadFn ?? this.defaultBatchLoadFn.bind(this),
		);
	}

	/**
   * Default batch loading function for comments
   * This should be overridden with actual database/service logic
   * @param commentIds Array of comment IDs to load
   * @returns Promise resolving to array of comments or errors
   */
	// eslint-disable-next-line require-await
	private async defaultBatchLoadFn(
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
	public async load(commentId: string): Promise<IComment | undefined> {
		const loader = this.getLoader();
		try {
			return await loader.load(commentId);
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
	public async loadMany(commentIds: string[]): Promise<(IComment | Error)[]> {
		const loader = this.getLoader();
		try {
			return await loader.loadMany(commentIds);
		} catch (error) {
			this.Logger.error(`Failed to load comments ${commentIds}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return commentIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific comment
   * @param commentId IComment ID to clear from cache
   */
	public clear(commentId: string): void {
		const loader = this.getLoader();
		loader.clear(commentId);
		this.Logger.debug(`Cleared cache for comment ${commentId}`);
	}

	/**
   * Clears all cached comments
   */
	public clearAll(): void {
		this.DataLoaderRegistry.clearCache('comment-loader');
	}
}
