import DataLoader from 'dataloader';
import { Injectable, Logger } from '@nestjs/common';
import { DataLoaderRegistry } from './dataloader-registry.js';

/**
 * Interface for Order entity
 */
export interface Order {
	id: string;
	[key: string]: any;
}

/**
 * DataLoader for loading orders by ID
 * Prevents N+1 query problems when resolving order fields in GraphQL
 */
@Injectable()
export class OrderLoader {
	private readonly logger = new Logger(OrderLoader.name);

	constructor(
		private readonly dataLoaderRegistry: DataLoaderRegistry,
	) {}

	/**
   * Gets the order DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for orders
   */
	public getLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(Order | Error)[]>,
	): DataLoader<string, Order> {
		return this.dataLoaderRegistry.createWithCache(
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
	): Promise<(Order | Error)[]> {
		this.logger.warn(
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
   * @param orderId Order ID to load
   * @returns Promise resolving to order or undefined
   */
	public async load(orderId: string): Promise<Order | undefined> {
		const loader = this.getLoader();
		try {
			return await loader.load(orderId);
		} catch (error) {
			this.logger.error(`Failed to load order ${orderId}`, error);
			return undefined;
		}
	}

	/**
   * Loads multiple orders by IDs
   * @param orderIds Array of order IDs to load
   * @returns Promise resolving to array of orders
   */
	public async loadMany(orderIds: string[]): Promise<(Order | Error)[]> {
		const loader = this.getLoader();
		try {
			return await loader.loadMany(orderIds);
		} catch (error) {
			this.logger.error(`Failed to load orders ${orderIds}`, error);
			return orderIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific order
   * @param orderId Order ID to clear from cache
   */
	public clear(orderId: string): void {
		const loader = this.getLoader();
		loader.clear(orderId);
		this.logger.debug(`Cleared cache for order ${orderId}`);
	}

	/**
   * Clears all cached orders
   */
	public clearAll(): void {
		this.dataLoaderRegistry.clearCache('order-loader');
	}
}
