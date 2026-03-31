import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorStack } from '@pawells/nestjs-shared/common';
import { DataLoaderRegistry } from './dataloader-registry.js';

/**
 * Interface for IUser entity
 */
export interface IUser {
	id: string;
	[key: string]: any;
}

/**
 * DataLoader for loading users by ID
 * Prevents N+1 query problems when resolving user fields in GraphQL
 */
@Injectable()
export class UserLoader implements ILazyModuleRefService {
	public readonly Module: ModuleRef;

	public get DataLoaderRegistry(): DataLoaderRegistry {
		return this.Module.get(DataLoaderRegistry, { strict: false });
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get Logger(): IContextualLogger {
		return this.AppLogger.createContextualLogger(UserLoader.name);
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
   * Gets the user DataLoader instance
   * @param batchLoadFn Custom batch loading function (optional)
   * @returns DataLoader for users
   */
	public GetLoader(
		batchLoadFn?: (keys: readonly string[]) => Promise<(IUser | Error)[]>,
	): DataLoader<string, IUser> {
		return this.DataLoaderRegistry.CreateWithCache(
			'user-loader',
			batchLoadFn ?? this.DefaultBatchLoadFn.bind(this),
		);
	}

	/**
   * Default batch loading function for users
   * This should be overridden with actual database/service logic
   * @param userIds Array of user IDs to load
   * @returns Promise resolving to array of users or errors
   */
	// eslint-disable-next-line require-await
	private async DefaultBatchLoadFn(
		userIds: readonly string[],
	): Promise<(IUser | Error)[]> {
		this.Logger.warn(
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
   * @param userId IUser ID to load
   * @returns Promise resolving to user or undefined
   */
	public async Load(userId: string): Promise<IUser | undefined> {
		const Loader = this.GetLoader();
		try {
			return await Loader.load(userId);
		} catch (error) {
			this.Logger.error(`Failed to load user ${userId}`, getErrorStack(error));
			return undefined;
		}
	}

	/**
   * Loads multiple users by IDs
   * @param userIds Array of user IDs to load
   * @returns Promise resolving to array of users
   */
	public async LoadMany(userIds: string[]): Promise<(IUser | Error)[]> {
		const Loader = this.GetLoader();
		try {
			return await Loader.loadMany(userIds);
		} catch (error) {
			this.Logger.error(`Failed to load users ${userIds}`, getErrorStack(error));
			return userIds.map(() => error as Error);
		}
	}

	/**
   * Clears the cache for a specific user
   * @param userId IUser ID to clear from cache
   */
	public Clear(userId: string): void {
		const Loader = this.GetLoader();
		Loader.clear(userId);
		this.Logger.debug(`Cleared cache for user ${userId}`);
	}

	/**
   * Clears all cached users
   */
	public ClearAll(): void {
		this.DataLoaderRegistry.ClearCache('user-loader');
	}
}
