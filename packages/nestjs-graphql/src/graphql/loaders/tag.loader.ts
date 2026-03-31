import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import { DataLoaderRegistry } from './dataloader-registry.js';

/**
 * Interface for ITag entity
 */
export interface ITag {
	id: string;
	[key: string]: any;
}

/**
 * DataLoader for loading tags by ID
 * Prevents N+1 query problems when resolving tag fields in GraphQL
 */
@Injectable()
export class TagLoader implements ILazyModuleRefService {
	public readonly Module: ModuleRef;

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get Logger(): IContextualLogger {
		return this.AppLogger.createContextualLogger(TagLoader.name);
	}

	public get DataLoaderRegistry(): DataLoaderRegistry {
		return this.Module.get(DataLoaderRegistry, { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
   * Gets the tag DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for tags
   */
	public GetLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(ITag | Error)[]>,
	): DataLoader<string, ITag> {
		return this.DataLoaderRegistry.CreateWithCache(
			'tag-loader',
			batchLoadFn ?? this.DefaultBatchLoadFn.bind(this),
		);
	}

	/**
   * Default batch loading function for tags
   * This should be overridden with actual database/service logic
   * @param tagIds Array of tag IDs to load
   * @returns Promise resolving to array of tags or errors
   */
	// eslint-disable-next-line require-await
	private async DefaultBatchLoadFn(
		tagIds: readonly string[],
	): Promise<(ITag | Error)[]> {
		this.Logger.warn(
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
   * @param tagId ITag ID to load
   * @returns Promise resolving to tag or undefined
   */
	public async Load(tagId: string): Promise<ITag | undefined> {
		const Loader = this.GetLoader();
		try {
			return await Loader.load(tagId);
		} catch (error) {
			this.Logger.error(`Failed to load tag ${tagId}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return undefined;
		}
	}

	/**
   * Loads multiple tags by IDs
   * @param tagIds Array of tag IDs to load
   * @returns Promise resolving to array of tags
   */
	public async LoadMany(tagIds: string[]): Promise<(ITag | Error)[]> {
		const Loader = this.GetLoader();
		try {
			return await Loader.loadMany(tagIds);
		} catch (error) {
			this.Logger.error(`Failed to load tags ${tagIds}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return tagIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific tag
   * @param tagId ITag ID to clear from cache
   */
	public Clear(tagId: string): void {
		const Loader = this.GetLoader();
		Loader.clear(tagId);
		this.Logger.debug(`Cleared cache for tag ${tagId}`);
	}

	/**
   * Clears all cached tags
   */
	public ClearAll(): void {
		this.DataLoaderRegistry.ClearCache('tag-loader');
	}
}
