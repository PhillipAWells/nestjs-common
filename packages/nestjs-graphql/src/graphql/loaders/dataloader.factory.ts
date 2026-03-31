import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';

/**
 * Interface for DataLoader batch loading functions
 */
export interface IBatchLoadFn<K, V> {
	(keys: readonly K[]): Promise<(V | Error)[]>;
}

/**
 * Interface for DataLoader options
 */
export interface IDataLoaderOptions<K, V> {
	batchLoadFn: IBatchLoadFn<K, V>;
	cache?: boolean;
	cacheKeyFn?: (key: K) => K;
	maxBatchSize?: number;
	batchScheduleFn?: (callback: () => void) => void;
}

/**
 * Factory for creating DataLoader instances with proper configuration
 */
@Injectable()
export class DataLoaderFactory implements ILazyModuleRefService {
	public readonly Module: ModuleRef;

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get Logger(): IContextualLogger {
		return this.AppLogger.createContextualLogger(DataLoaderFactory.name);
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
    * Creates a new DataLoader instance with the provided options
    * @param options DataLoader configuration options
    * @returns Configured DataLoader instance
    */
	@ProfileMethod({ tags: { operation: 'dataloader', action: 'create' } })
	public Create<K, V>(options: IDataLoaderOptions<K, V>): DataLoader<K, V> {
		const {
			batchLoadFn,
			cache = true,
			cacheKeyFn,
			maxBatchSize,
			batchScheduleFn,
		} = options;

		const Instance = new DataLoader<K, V>(
			async (keys: readonly K[]): Promise<(V | Error)[]> => {
				try {
					this.Logger.debug(`Batch loading ${keys.length} keys`);
					const Results = await batchLoadFn(keys);

					// Ensure we return exactly the same number of results as keys
					if (Results.length !== keys.length) {
						this.Logger.warn(
							`Batch load function returned ${Results.length} results for ${keys.length} keys`,
						);
						// Pad with errors if necessary
						while (Results.length < keys.length) {
							Results.push(new Error('Batch load function returned insufficient results'));
						}
						// DataLoader requires results[i] to correspond to keys[i] with exactly keys.length results
						if (Results.length > keys.length) {
							Results.length = keys.length;
						}
					}

					return Results;
				} catch (error) {
					this.Logger.error(`Batch loading failed: ${getErrorMessage(error)}`);
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

		return Instance;
	}

	/**
   * Creates a DataLoader with default caching enabled
   * @param batchLoadFn Batch loading function
   * @param options Additional options
   * @returns Configured DataLoader instance
   */
	public CreateWithCache<K, V>(
		batchLoadFn: IBatchLoadFn<K, V>,
		options: Omit<IDataLoaderOptions<K, V>, 'batchLoadFn' | 'cache'> = {},
	): DataLoader<K, V> {
		return this.Create({
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
	public CreateWithoutCache<K, V>(
		batchLoadFn: IBatchLoadFn<K, V>,
		options: Omit<IDataLoaderOptions<K, V>, 'batchLoadFn' | 'cache'> = {},
	): DataLoader<K, V> {
		return this.Create({
			batchLoadFn,
			cache: false,
			...options,
		});
	}
}
