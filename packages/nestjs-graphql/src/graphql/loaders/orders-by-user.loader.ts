import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import { DataLoaderRegistry } from './dataloader-registry.js';
import { IOrder } from './order.loader.js';

/**
 * DataLoader for loading orders by user ID
 * Prevents N+1 query problems when resolving user's orders in GraphQL
 */
@Injectable()
export class OrdersByUserLoader implements ILazyModuleRefService {
	public readonly Module: ModuleRef;

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get Logger(): IContextualLogger {
		return this.AppLogger.createContextualLogger(OrdersByUserLoader.name);
	}

	public get DataLoaderRegistry(): DataLoaderRegistry {
		return this.Module.get(DataLoaderRegistry, { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
   * Gets the orders by user DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for orders by user
   */
	public GetLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(IOrder[] | Error)[]>,
	): DataLoader<string, IOrder[]> {
		return this.DataLoaderRegistry.CreateWithCache(
			'orders-by-user-loader',
			batchLoadFn ?? this.DefaultBatchLoadFn.bind(this),
		);
	}

	/**
   * Default batch loading function for orders by user
   * This should be overridden with actual database/service logic
   * @param userIds Array of user IDs to load orders for
   * @returns Promise resolving to arrays of orders or errors
   */
	// eslint-disable-next-line require-await
	private async DefaultBatchLoadFn(
		userIds: readonly string[],
	): Promise<(IOrder[] | Error)[]> {
		this.Logger.warn(
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
   * @param userId IUser ID to load orders for
   * @returns Promise resolving to array of orders or undefined
   */
	public async Load(userId: string): Promise<IOrder[] | undefined> {
		const Loader = this.GetLoader();
		try {
			return await Loader.load(userId);
		} catch (error) {
			this.Logger.error(`Failed to load orders for user ${userId}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return undefined;
		}
	}

	/**
   * Loads orders for multiple users by user IDs
   * @param userIds Array of user IDs to load orders for
   * @returns Promise resolving to arrays of orders
   */
	public async LoadMany(userIds: string[]): Promise<(IOrder[] | Error)[]> {
		const Loader = this.GetLoader();
		try {
			return await Loader.loadMany(userIds);
		} catch (error) {
			this.Logger.error(`Failed to load orders for users ${userIds}${error instanceof Error ? `: ${getErrorMessage(error)}` : ''}`);
			return userIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific user's orders
   * @param userId IUser ID to clear orders cache for
   */
	public Clear(userId: string): void {
		const Loader = this.GetLoader();
		Loader.clear(userId);
		this.Logger.debug(`Cleared cache for orders of user ${userId}`);
	}

	/**
   * Clears all cached orders by user
   */
	public ClearAll(): void {
		this.DataLoaderRegistry.ClearCache('orders-by-user-loader');
	}
}
