import DataLoader from 'dataloader';
import { Injectable, Logger } from '@nestjs/common';
import { DataLoaderRegistry } from './dataloader-registry.js';
import { Order } from './order.loader.js';

/**
 * DataLoader for loading orders by user ID
 * Prevents N+1 query problems when resolving user's orders in GraphQL
 */
@Injectable()
export class OrdersByUserLoader {
	private readonly logger = new Logger(OrdersByUserLoader.name);

	constructor(
		private readonly dataLoaderRegistry: DataLoaderRegistry,
	) {}

	/**
   * Gets the orders by user DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for orders by user
   */
	public getLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(Order[] | Error)[]>,
	): DataLoader<string, Order[]> {
		return this.dataLoaderRegistry.createWithCache(
			'orders-by-user-loader',
			batchLoadFn ?? this.defaultBatchLoadFn.bind(this),
		);
	}

	/**
   * Default batch loading function for orders by user
   * This should be overridden with actual database/service logic
   * @param userIds Array of user IDs to load orders for
   * @returns Promise resolving to arrays of orders or errors
   */
	// eslint-disable-next-line require-await
	private async defaultBatchLoadFn(
		userIds: readonly string[],
	): Promise<(Order[] | Error)[]> {
		this.logger.warn(
			'Using default orders by user batch loader. Override with actual implementation.',
		);

		return userIds.map(
			(userId) =>
				new Error(
					`OrdersByUserLoader not implemented. Override batchLoadFn for user ID: ${userId}`,
				),
		);
	}

	/**
   * Loads orders for a single user by user ID
   * @param userId User ID to load orders for
   * @returns Promise resolving to array of orders or undefined
   */
	public async load(userId: string): Promise<Order[] | undefined> {
		const loader = this.getLoader();
		try {
			return await loader.load(userId);
		} catch (error) {
			this.logger.error(`Failed to load orders for user ${userId}`, error);
			return undefined;
		}
	}

	/**
   * Loads orders for multiple users by user IDs
   * @param userIds Array of user IDs to load orders for
   * @returns Promise resolving to arrays of orders
   */
	public async loadMany(userIds: string[]): Promise<(Order[] | Error)[]> {
		const loader = this.getLoader();
		try {
			return await loader.loadMany(userIds);
		} catch (error) {
			this.logger.error(`Failed to load orders for users ${userIds}`, error);
			return userIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific user's orders
   * @param userId User ID to clear orders cache for
   */
	public clear(userId: string): void {
		const loader = this.getLoader();
		loader.clear(userId);
		this.logger.debug(`Cleared cache for orders of user ${userId}`);
	}

	/**
   * Clears all cached orders by user
   */
	public clearAll(): void {
		this.dataLoaderRegistry.clearCache('orders-by-user-loader');
	}
}
