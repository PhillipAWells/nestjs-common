import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { DataLoaderRegistry } from './dataloader-registry.js';

/**
 * Interface for Comment entity
 */
export interface Comment {
	id: string;
	[key: string]: any;
}

/**
 * DataLoader for loading comments by ID
 * Prevents N+1 query problems when resolving comment fields in GraphQL
 */
@Injectable()
export class CommentLoader implements LazyModuleRefService {
	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get logger(): AppLogger {
		return this.AppLogger.createContextualLogger(CommentLoader.name);
	}

	public get DataLoaderRegistry(): DataLoaderRegistry {
		return this.Module.get(DataLoaderRegistry, { strict: false });
	}

	constructor(public readonly Module: ModuleRef) {}

	/**
   * Gets the comment DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for comments
   */
	public getLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(Comment | Error)[]>,
	): DataLoader<string, Comment> {
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
	): Promise<(Comment | Error)[]> {
		this.logger.warn(
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
   * @param commentId Comment ID to load
   * @returns Promise resolving to comment or undefined
   */
	public async load(commentId: string): Promise<Comment | undefined> {
		const loader = this.getLoader();
		try {
			return await loader.load(commentId);
		} catch (error) {
			this.logger.error(`Failed to load comment ${commentId}${error instanceof Error ? `: ${error.message}` : ''}`);
			return undefined;
		}
	}

	/**
   * Loads multiple comments by IDs
   * @param commentIds Array of comment IDs to load
   * @returns Promise resolving to array of comments
   */
	public async loadMany(commentIds: string[]): Promise<(Comment | Error)[]> {
		const loader = this.getLoader();
		try {
			return await loader.loadMany(commentIds);
		} catch (error) {
			this.logger.error(`Failed to load comments ${commentIds}${error instanceof Error ? `: ${error.message}` : ''}`);
			return commentIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific comment
   * @param commentId Comment ID to clear from cache
   */
	public clear(commentId: string): void {
		const loader = this.getLoader();
		loader.clear(commentId);
		this.logger.debug(`Cleared cache for comment ${commentId}`);
	}

	/**
   * Clears all cached comments
   */
	public clearAll(): void {
		this.DataLoaderRegistry.clearCache('comment-loader');
	}
}
