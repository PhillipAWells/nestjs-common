import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import { DataLoaderRegistry } from './dataloader-registry.js';

/**
 * Interface for Tag entity
 */
export interface Tag {
	id: string;
	[key: string]: any;
}

/**
 * DataLoader for loading tags by ID
 * Prevents N+1 query problems when resolving tag fields in GraphQL
 */
@Injectable()
export class TagLoader implements LazyModuleRefService {
	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get logger(): AppLogger {
		return this.AppLogger.createContextualLogger(TagLoader.name);
	}

	public get DataLoaderRegistry(): DataLoaderRegistry {
		return this.Module.get(DataLoaderRegistry, { strict: false });
	}

	constructor(public readonly Module: ModuleRef) {}

	/**
   * Gets the tag DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for tags
   */
	public getLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(Tag | Error)[]>,
	): DataLoader<string, Tag> {
		return this.DataLoaderRegistry.createWithCache(
			'tag-loader',
			batchLoadFn ?? this.defaultBatchLoadFn.bind(this),
		);
	}

	/**
   * Default batch loading function for tags
   * This should be overridden with actual database/service logic
   * @param tagIds Array of tag IDs to load
   * @returns Promise resolving to array of tags or errors
   */
	// eslint-disable-next-line require-await
	private async defaultBatchLoadFn(
		tagIds: readonly string[],
	): Promise<(Tag | Error)[]> {
		this.logger.warn(
			'Using default tag batch loader. Override with actual implementation.',
		);

		return tagIds.map(
			(id) =>
				new Error(
					`TagLoader not implemented. Override batchLoadFn for tag ID: ${id}`,
				),
		);
	}

	/**
   * Loads a single tag by ID
   * @param tagId Tag ID to load
   * @returns Promise resolving to tag or undefined
   */
	public async load(tagId: string): Promise<Tag | undefined> {
		const loader = this.getLoader();
		try {
			return await loader.load(tagId);
		} catch (error) {
			this.logger.error(`Failed to load tag ${tagId}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return undefined;
		}
	}

	/**
   * Loads multiple tags by IDs
   * @param tagIds Array of tag IDs to load
   * @returns Promise resolving to array of tags
   */
	public async loadMany(tagIds: string[]): Promise<(Tag | Error)[]> {
		const loader = this.getLoader();
		try {
			return await loader.loadMany(tagIds);
		} catch (error) {
			this.logger.error(`Failed to load tags ${tagIds}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return tagIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific tag
   * @param tagId Tag ID to clear from cache
   */
	public clear(tagId: string): void {
		const loader = this.getLoader();
		loader.clear(tagId);
		this.logger.debug(`Cleared cache for tag ${tagId}`);
	}

	/**
   * Clears all cached tags
   */
	public clearAll(): void {
		this.DataLoaderRegistry.clearCache('tag-loader');
	}
}
