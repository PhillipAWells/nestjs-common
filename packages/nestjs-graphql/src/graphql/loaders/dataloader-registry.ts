import DataLoader from 'dataloader';
import { Injectable, Scope } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { DataLoaderFactory, BatchLoadFn, DataLoaderOptions } from './dataloader.factory.js';

/**
 * Registry for managing DataLoader instances per request context
 * Ensures DataLoaders are created once per request and properly cleaned up
 */
@Injectable({ scope: Scope.REQUEST })
export class DataLoaderRegistry implements LazyModuleRefService {
	public readonly Module: ModuleRef;

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get logger(): AppLogger {
		return this.AppLogger.createContextualLogger(DataLoaderRegistry.name);
	}

	private readonly loaders = new Map<string, DataLoader<any, any>>();

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
	public getOrCreate<K, V>(
		key: string,
		options: DataLoaderOptions<K, V>,
	): DataLoader<K, V> {
		if (this.loaders.has(key)) {
			this.logger.debug(`Reusing existing DataLoader for key: ${key}`);
			return this.loaders.get(key) as DataLoader<K, V>;
		}

		this.logger.debug(`Creating new DataLoader for key: ${key}`);
		const dataLoader = this.DataLoaderFactory.create(options);
		this.loaders.set(key, dataLoader);

		return dataLoader;
	}

	/**
   * Creates a DataLoader with caching enabled
   * @param key Unique identifier for the DataLoader
   * @param batchLoadFn Batch loading function
   * @param options Additional options
   * @returns DataLoader instance
   */
	public createWithCache<K, V>(
		key: string,
		batchLoadFn: BatchLoadFn<K, V>,
		options: Omit<DataLoaderOptions<K, V>, 'batchLoadFn' | 'cache'> = {},
	): DataLoader<K, V> {
		return this.getOrCreate(key, {
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
	public createWithoutCache<K, V>(
		key: string,
		batchLoadFn: BatchLoadFn<K, V>,
		options: Omit<DataLoaderOptions<K, V>, 'batchLoadFn' | 'cache'> = {},
	): DataLoader<K, V> {
		return this.getOrCreate(key, {
			batchLoadFn,
			cache: false,
			...options,
		});
	}

	/**
   * Clears the cache for a specific DataLoader
   * @param key DataLoader key
   */
	public clearCache(key: string): void {
		const loader = this.loaders.get(key);
		if (loader) {
			loader.clearAll();
			this.logger.debug(`Cleared cache for DataLoader: ${key}`);
		}
	}

	/**
   * Clears all DataLoader caches
   */
	public clearAllCaches(): void {
		for (const [key, loader] of this.loaders) {
			loader.clearAll();
			this.logger.debug(`Cleared cache for DataLoader: ${key}`);
		}
	}

	/**
   * Gets the number of registered DataLoaders
   * @returns Number of DataLoaders
   */
	public getLoaderCount(): number {
		return this.loaders.size;
	}

	/**
   * Gets all registered DataLoader keys
   * @returns Array of keys
   */
	public getLoaderKeys(): string[] {
		return Array.from(this.loaders.keys());
	}

	/**
   * Removes a DataLoader from the registry
   * @param key DataLoader key to remove
   */
	public removeLoader(key: string): void {
		if (this.loaders.has(key)) {
			this.loaders.delete(key);
			this.logger.debug(`Removed DataLoader: ${key}`);
		}
	}

	/**
   * Cleans up all DataLoaders (called at end of request)
   */
	public cleanup(): void {
		this.clearAllCaches();
		this.loaders.clear();
		this.logger.debug('DataLoader registry cleaned up');
	}
}
