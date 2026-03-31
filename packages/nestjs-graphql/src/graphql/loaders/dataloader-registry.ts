import DataLoader from 'dataloader';
import { Injectable, Scope } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { DataLoaderFactory, IBatchLoadFn, IDataLoaderOptions } from './dataloader.factory.js';

/**
 * Registry for managing DataLoader instances per request context
 * Ensures DataLoaders are created once per request and properly cleaned up
 */
@Injectable({ scope: Scope.REQUEST })
export class DataLoaderRegistry implements ILazyModuleRefService {
	public readonly Module: ModuleRef;

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get Logger(): IContextualLogger {
		return this.AppLogger.createContextualLogger(DataLoaderRegistry.name);
	}

	private readonly Loaders = new Map<string, DataLoader<any, any>>();

	public get DataLoaderFactory(): DataLoaderFactory {
		return this.Module.get(DataLoaderFactory, { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
   * Gets or creates a DataLoader for the given key
   * @param key Unique identifier for the DataLoader
   * @param options DataLoader configuration options
   * @returns DataLoader instance
   */
	public GetOrCreate<K, V>(
		key: string,
		options: IDataLoaderOptions<K, V>,
	): DataLoader<K, V> {
		if (this.Loaders.has(key)) {
			this.Logger.debug(`Reusing existing DataLoader for key: ${key}`);
			return this.Loaders.get(key) as DataLoader<K, V>;
		}

		this.Logger.debug(`Creating new DataLoader for key: ${key}`);
		const Loader = this.DataLoaderFactory.Create(options);
		this.Loaders.set(key, Loader);

		return Loader;
	}

	/**
   * Creates a DataLoader with caching enabled
   * @param key Unique identifier for the DataLoader
   * @param batchLoadFn Batch loading function
   * @param options Additional options
   * @returns DataLoader instance
   */
	public CreateWithCache<K, V>(
		key: string,
		batchLoadFn: IBatchLoadFn<K, V>,
		options: Omit<IDataLoaderOptions<K, V>, 'batchLoadFn' | 'cache'> = {},
	): DataLoader<K, V> {
		return this.GetOrCreate(key, {
			batchLoadFn,
			cache: true,
			...options,
		});
	}

	/**
   * Creates a DataLoader without caching
   * @param key Unique identifier for the DataLoader
   * @param batchLoadFn Batch loading function
   * @param options Additional options
   * @returns DataLoader instance
   */
	public CreateWithoutCache<K, V>(
		key: string,
		batchLoadFn: IBatchLoadFn<K, V>,
		options: Omit<IDataLoaderOptions<K, V>, 'batchLoadFn' | 'cache'> = {},
	): DataLoader<K, V> {
		return this.GetOrCreate(key, {
			batchLoadFn,
			cache: false,
			...options,
		});
	}

	/**
   * Clears the cache for a specific DataLoader
   * @param key DataLoader key
   */
	public ClearCache(key: string): void {
		const Loader = this.Loaders.get(key);
		if (Loader) {
			Loader.clearAll();
			this.Logger.debug(`Cleared cache for DataLoader: ${key}`);
		}
	}

	/**
   * Clears all DataLoader caches
   */
	public ClearAllCaches(): void {
		for (const [Key, Loader] of this.Loaders) {
			Loader.clearAll();
			this.Logger.debug(`Cleared cache for DataLoader: ${Key}`);
		}
	}

	/**
   * Gets the number of registered DataLoaders
   * @returns Number of DataLoaders
   */
	public GetLoaderCount(): number {
		return this.Loaders.size;
	}

	/**
   * Gets all registered DataLoader keys
   * @returns Array of keys
   */
	public GetLoaderKeys(): string[] {
		return Array.from(this.Loaders.keys());
	}

	/**
   * Removes a DataLoader from the registry
   * @param key DataLoader key to remove
   */
	public RemoveLoader(key: string): void {
		if (this.Loaders.has(key)) {
			this.Loaders.delete(key);
			this.Logger.debug(`Removed DataLoader: ${key}`);
		}
	}

	/**
   * Cleans up all DataLoaders (called at end of request)
   */
	public Cleanup(): void {
		this.ClearAllCaches();
		this.Loaders.clear();
		this.Logger.debug('DataLoader registry cleaned up');
	}
}
