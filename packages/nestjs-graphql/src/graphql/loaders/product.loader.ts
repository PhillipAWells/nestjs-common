import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import { DataLoaderRegistry } from './dataloader-registry.js';

/**
 * Interface for Product entity
 */
export interface Product {
	id: string;
	[key: string]: any;
}

/**
 * DataLoader for loading products by ID
 * Prevents N+1 query problems when resolving product fields in GraphQL
 */
@Injectable()
export class ProductLoader implements LazyModuleRefService {
	public readonly Module: ModuleRef;

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get logger(): AppLogger {
		return this.AppLogger.createContextualLogger(ProductLoader.name);
	}

	public get DataLoaderRegistry(): DataLoaderRegistry {
		return this.Module.get(DataLoaderRegistry, { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
   * Gets the product DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for products
   */
	public getLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(Product | Error)[]>,
	): DataLoader<string, Product> {
		return this.DataLoaderRegistry.createWithCache(
			'product-loader',
			batchLoadFn ?? this.defaultBatchLoadFn.bind(this),
		);
	}

	/**
   * Default batch loading function for products
   * This should be overridden with actual database/service logic
   * @param productIds Array of product IDs to load
   * @returns Promise resolving to array of products or errors
   */
	// eslint-disable-next-line require-await
	private async defaultBatchLoadFn(
		productIds: readonly string[],
	): Promise<(Product | Error)[]> {
		this.logger.warn(
			'Using default product batch loader. Override with actual implementation.',
		);

		// This is a placeholder - in real implementation, this would query the database
		return productIds.map(
			(id) =>
				new Error(
					`ProductLoader not implemented. Override batchLoadFn for product ID: ${id}`,
				),
		);
	}

	/**
   * Loads a single product by ID
   * @param productId Product ID to load
   * @returns Promise resolving to product or undefined
   */
	public async load(productId: string): Promise<Product | undefined> {
		const loader = this.getLoader();
		try {
			return await loader.load(productId);
		} catch (error) {
			this.logger.error(`Failed to load product ${productId}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return undefined;
		}
	}

	/**
   * Loads multiple products by IDs
   * @param productIds Array of product IDs to load
   * @returns Promise resolving to array of products
   */
	public async loadMany(productIds: string[]): Promise<(Product | Error)[]> {
		const loader = this.getLoader();
		try {
			return await loader.loadMany(productIds);
		} catch (error) {
			this.logger.error(`Failed to load products ${productIds}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return productIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific product
   * @param productId Product ID to clear from cache
   */
	public clear(productId: string): void {
		const loader = this.getLoader();
		loader.clear(productId);
		this.logger.debug(`Cleared cache for product ${productId}`);
	}

	/**
   * Clears all cached products
   */
	public clearAll(): void {
		this.DataLoaderRegistry.clearCache('product-loader');
	}
}
