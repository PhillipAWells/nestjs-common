import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';

/**
 * Interface for DataLoader batch loading functions
 */
export interface BatchLoadFn<K, V> {
	(keys: readonly K[]): Promise<(V | Error)[]>;
}

/**
 * Interface for DataLoader options
 */
export interface DataLoaderOptions<K, V> {
	batchLoadFn: BatchLoadFn<K, V>;
	cache?: boolean;
	cacheKeyFn?: (key: K) => K;
	maxBatchSize?: number;
	batchScheduleFn?: (callback: () => void) => void;
}

/**
 * Factory for creating DataLoader instances with proper configuration
 */
@Injectable()
export class DataLoaderFactory implements LazyModuleRefService {
	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get logger(): AppLogger {
		return this.AppLogger.createContextualLogger(DataLoaderFactory.name);
	}

	constructor(public readonly Module: ModuleRef) {}

	/**
    * Creates a new DataLoader instance with the provided options
    * @param options DataLoader configuration options
    * @returns Configured DataLoader instance
    */
	@ProfileMethod({ tags: { operation: 'dataloader', action: 'create' } })
	public create<K, V>(options: DataLoaderOptions<K, V>): DataLoader<K, V> {
		const {
			batchLoadFn,
			cache = true,
			cacheKeyFn,
			maxBatchSize,
			batchScheduleFn,
		} = options;

		const dataLoader = new DataLoader<K, V>(
			async (keys: readonly K[]): Promise<(V | Error)[]> => {
				try {
					this.logger.debug(`Batch loading ${keys.length} keys`);
					const results = await batchLoadFn(keys);

					// Ensure we return exactly the same number of results as keys
					if (results.length !== keys.length) {
						this.logger.warn(
							`Batch load function returned ${results.length} results for ${keys.length} keys`,
						);
						// Pad with errors if necessary
						while (results.length < keys.length) {
							results.push(new Error('Batch load function returned insufficient results'));
						}
						// DataLoader requires results[i] to correspond to keys[i] with exactly keys.length results
						if (results.length > keys.length) {
							results.length = keys.length;
						}
					}

					return results;
				} catch (error) {
					this.logger.error(`Batch loading failed${error instanceof Error ? `: ${error.message}` : ''}`);
					// Return errors for all keys
					return keys.map(() => error as Error);
				}
			},
			{
				cache,
				...(cacheKeyFn !== undefined ? { cacheKeyFn } : {}),
				...(maxBatchSize !== undefined ? { maxBatchSize } : {}),
				...(batchScheduleFn !== undefined ? { batchScheduleFn } : {}),
			},
		);

		return dataLoader;
	}

	/**
   * Creates a DataLoader with default caching enabled
   * @param batchLoadFn Batch loading function
   * @param options Additional options
   * @returns Configured DataLoader instance
   */
	public createWithCache<K, V>(
		batchLoadFn: BatchLoadFn<K, V>,
		options: Omit<DataLoaderOptions<K, V>, 'batchLoadFn' | 'cache'> = {},
	): DataLoader<K, V> {
		return this.create({
			batchLoadFn,
			cache: true,
			...options,
		});
	}

	/**
   * Creates a DataLoader without caching
   * @param batchLoadFn Batch loading function
   * @param options Additional options
   * @returns Configured DataLoader instance
   */
	public createWithoutCache<K, V>(
		batchLoadFn: BatchLoadFn<K, V>,
		options: Omit<DataLoaderOptions<K, V>, 'batchLoadFn' | 'cache'> = {},
	): DataLoader<K, V> {
		return this.create({
			batchLoadFn,
			cache: false,
			...options,
		});
	}
}
