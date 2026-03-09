import DataLoader from 'dataloader';
import { Injectable, Inject } from '@nestjs/common';
import { DataLoaderRegistry } from './dataloader-registry.js';
import { AppLogger } from '@pawells/nestjs-shared/common';

/**
 * Interface for User entity
 */
export interface User {
	id: string;
	[key: string]: any;
}

/**
 * DataLoader for loading users by ID
 * Prevents N+1 query problems when resolving user fields in GraphQL
 */
@Injectable()
export class UserLoader {
	private readonly logger: AppLogger;

	constructor(
		private readonly dataLoaderRegistry: DataLoaderRegistry,
		@Inject(AppLogger) private readonly appLogger: AppLogger,
	) {
		this.logger = this.appLogger.createContextualLogger(UserLoader.name);
	}

	/**
   * Gets the user DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for users
   */
	public getLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(User | Error)[]>,
	): DataLoader<string, User> {
		return this.dataLoaderRegistry.createWithCache(
			'user-loader',
			batchLoadFn ?? this.defaultBatchLoadFn.bind(this),
		);
	}

	/**
   * Default batch loading function for users
   * This should be overridden with actual database/service logic
   * @param userIds Array of user IDs to load
   * @returns Promise resolving to array of users or errors
   */
	private async defaultBatchLoadFn(
		userIds: readonly string[],
	): Promise<(User | Error)[]> {
		this.logger.warn(
			'Using default user batch loader. Override with actual implementation.',
		);

		// This is a placeholder - in real implementation, this would query the database
		// For now, return errors to indicate implementation is needed
		return userIds.map(
			(id) =>
				new Error(
					`UserLoader not implemented. Override batchLoadFn for user ID: ${id}`,
				),
		);
	}

	/**
   * Loads a single user by ID
   * @param userId User ID to load
   * @returns Promise resolving to user or undefined
   */
	public async load(userId: string): Promise<User | undefined> {
		const loader = this.getLoader();
		try {
			return await loader.load(userId);
		} catch (error) {
			this.logger.error(`Failed to load user ${userId}`, error instanceof Error ? error.stack : String(error));
			return undefined;
		}
	}

	/**
   * Loads multiple users by IDs
   * @param userIds Array of user IDs to load
   * @returns Promise resolving to array of users
   */
	public async loadMany(userIds: string[]): Promise<(User | Error)[]> {
		const loader = this.getLoader();
		try {
			return await loader.loadMany(userIds);
		} catch (error) {
			this.logger.error(`Failed to load users ${userIds}`, error instanceof Error ? error.stack : String(error));
			return userIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific user
   * @param userId User ID to clear from cache
   */
	public clear(userId: string): void {
		const loader = this.getLoader();
		loader.clear(userId);
		this.logger.debug(`Cleared cache for user ${userId}`);
	}

	/**
   * Clears all cached users
   */
	public clearAll(): void {
		this.dataLoaderRegistry.clearCache('user-loader');
	}
}
