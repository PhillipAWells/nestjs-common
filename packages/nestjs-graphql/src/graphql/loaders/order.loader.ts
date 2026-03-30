import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import { DataLoaderRegistry } from './dataloader-registry.js';

/**
 * Interface for IOrder entity
 */
export interface IOrder {
	id: string;
	[key: string]: any;
}

/**
 * DataLoader for loading orders by ID
 * Prevents N+1 query problems when resolving order fields in GraphQL
 */
@Injectable()
export class OrderLoader implements ILazyModuleRefService {
	public readonly Module: ModuleRef;

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get Logger(): AppLogger {
		return this.AppLogger.createContextualLogger(OrderLoader.name);
	}

	public get DataLoaderRegistry(): DataLoaderRegistry {
		return this.Module.get(DataLoaderRegistry, { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
   * Gets the order DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for orders
   */
	public getLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(IOrder | Error)[]>,
	): DataLoader<string, IOrder> {
		return this.DataLoaderRegistry.createWithCache(
			'order-loader',
			batchLoadFn ?? this.defaultBatchLoadFn.bind(this),
		);
	}

	/**
   * Default batch loading function for orders
   * This should be overridden with actual database/service logic
   * @param orderIds Array of order IDs to load
   * @returns Promise resolving to array of orders or errors
   */
	// eslint-disable-next-line require-await
	private async defaultBatchLoadFn(
		orderIds: readonly string[],
	): Promise<(IOrder | Error)[]> {
		this.Logger.warn(
			'Using default order batch loader. Override with actual implementation.',
		);

		return orderIds.map(
			(id) =>
				new Error(
					`OrderLoader not implemented. Override batchLoadFn for order ID: ${id}`,
				),
		);
	}

	/**
   * Loads a single order by ID
   * @param orderId IOrder ID to load
   * @returns Promise resolving to order or undefined
   */
	public async load(orderId: string): Promise<IOrder | undefined> {
		const loader = this.getLoader();
		try {
			return await loader.load(orderId);
		} catch (error) {
			this.Logger.error(`Failed to load order ${orderId}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return undefined;
		}
	}

	/**
   * Loads multiple orders by IDs
   * @param orderIds Array of order IDs to load
   * @returns Promise resolving to array of orders
   */
	public async loadMany(orderIds: string[]): Promise<(IOrder | Error)[]> {
		const loader = this.getLoader();
		try {
			return await loader.loadMany(orderIds);
		} catch (error) {
			this.Logger.error(`Failed to load orders ${orderIds}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return orderIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific order
   * @param orderId IOrder ID to clear from cache
   */
	public clear(orderId: string): void {
		const loader = this.getLoader();
		loader.clear(orderId);
		this.Logger.debug(`Cleared cache for order ${orderId}`);
	}

	/**
   * Clears all cached orders
   */
	public clearAll(): void {
		this.DataLoaderRegistry.clearCache('order-loader');
	}
}
