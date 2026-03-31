declare global {
	namespace NodeJS {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		interface Timeout {}
	}
}

import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
import type { ISubscriptionConfig } from './subscription-config.interface.js';
import { MAX_WEBSOCKET_CONNECTIONS } from '../constants/subscriptions.constants.js';

/**
 * Service for managing WebSocket connections and subscriptions
 */
@Injectable()
export class ConnectionManagerService implements ILazyModuleRefService {
	public readonly Module: ModuleRef;
	private readonly Logger: AppLogger;

	private readonly Connections = new Map<string, Set<any>>();

	private readonly Subscriptions = new Map<string, Set<string>>();

	// eslint-disable-next-line no-undef
	private readonly ConnectionTimers = new Map<string, NodeJS.Timeout>();

	private readonly ConnectionIdMap = new WeakMap<any, string>();

	private ConnectionCounter = 0;

	public get ISubscriptionConfig(): ISubscriptionConfig {
		return this.Module.get<ISubscriptionConfig>('SUBSCRIPTION_CONFIG', { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
		this.Logger = new AppLogger(undefined, ConnectionManagerService.name);
	}

	/**
	 * Generate a unique key for a connection based on userId and the ws object
	 * If ws has an id property, use it; otherwise use the object counter
	 */
	private GetConnectionKey(ws: any, userId: string): string {
		// If WebSocket has an id property, use it for stability across object instances
		if (ws && typeof ws === 'object' && 'id' in ws) {
			return `${userId}:${ws.id}`;
		}
		// Check if we've already assigned a key to this object
		if (ws && typeof ws === 'object' && this.ConnectionIdMap.has(ws)) {
			const Existing = this.ConnectionIdMap.get(ws);
			if (Existing !== undefined) {
				return Existing;
			}
		}
		// Generate a new key for this object
		return `${userId}:${this.ConnectionCounter++}`;
	}

	/**
   * Adds a new WebSocket connection
   * @param ws WebSocket connection
   * @param userId IUser ID
   * @param authenticatedUserId Authenticated user ID from token verification — must match userId
   */
	public AddConnection(ws: any, userId: string, authenticatedUserId: string): void {
		// Verify the authenticated user matches the requested userId
		if (userId !== authenticatedUserId) {
			this.Logger.warn(`Connection rejected: authenticated user ${authenticatedUserId} attempted to connect as ${userId}`);
			throw new Error(`Unauthorized: cannot create connection for user ${userId}`);
		}

		if (!this.Connections.has(userId)) {
			this.Connections.set(userId, new Set());
		}
		this.Connections.get(userId)?.add(ws);

		// Generate unique connection ID using helper method
		const ConnectionId = this.GetConnectionKey(ws, userId);

		// Track the ConnectionId in WeakMap for later retrieval (only if object)
		if (ws && typeof ws === 'object' && !('id' in ws)) {
			this.ConnectionIdMap.set(ws, ConnectionId);
		}

		// Set connection timeout
		const Timer = setTimeout(() => {
			this.RemoveConnection(ws, userId);
		}, this.ISubscriptionConfig.connection.timeout);

		this.ConnectionTimers.set(ConnectionId, Timer);

		this.Logger.debug(`Added connection for user: ${userId}`);
	}

	/**
   * Removes a WebSocket connection
   * @param ws WebSocket connection
   * @param userId IUser ID
   */
	public RemoveConnection(ws: any, userId: string): void {
		const UserConnections = this.Connections.get(userId);
		if (UserConnections) {
			// If ws has an id property, match by id
			if (ws && typeof ws === 'object' && 'id' in ws) {
				for (const Connection of UserConnections) {
					if (Connection && typeof Connection === 'object' && 'id' in Connection && Connection.id === ws.id) {
						UserConnections.delete(Connection);
						break;
					}
				}
			} else {
				// Otherwise match by object reference
				UserConnections.delete(ws);
			}

			if (UserConnections.size === 0) {
				this.Connections.delete(userId);
			}
		}

		// Clear timeout using the same key generation logic
		const ConnectionId = this.GetConnectionKey(ws, userId);
		const Timer = this.ConnectionTimers.get(ConnectionId);
		if (Timer) {
			clearTimeout(Timer);
		}
		this.ConnectionTimers.delete(ConnectionId);

		// Clean up WeakMap if applicable
		if (ws && typeof ws === 'object' && !('id' in ws)) {
			this.ConnectionIdMap.delete(ws);
		}

		// Remove all subscriptions for this connection
		this.RemoveAllSubscriptionsForUser(userId);

		this.Logger.debug(`Removed connection for user: ${userId}`);
	}

	/**
   * Checks if a user can accept a new connection
   * @param userId IUser ID
   * @returns True if connection can be accepted
   */
	public CanAcceptConnection(userId: string): boolean {
		const UserConnections = this.Connections.get(userId);
		const CurrentCount = UserConnections ? UserConnections.size : 0;
		return CurrentCount < (this.ISubscriptionConfig.websocket.maxConnections ?? MAX_WEBSOCKET_CONNECTIONS);
	}

	/**
   * Adds a subscription for a user
   * @param userId IUser ID
   * @param subscriptionId Subscription ID
   */
	public AddSubscription(userId: string, subscriptionId: string): void {
		if (!this.Subscriptions.has(userId)) {
			this.Subscriptions.set(userId, new Set());
		}
		this.Subscriptions.get(userId)?.add(subscriptionId);

		this.Logger.debug(`Added subscription ${subscriptionId} for user: ${userId}`);
	}

	/**
   * Removes a subscription for a user
   * @param userId IUser ID
   * @param subscriptionId Subscription ID
   */
	public RemoveSubscription(userId: string, subscriptionId: string): void {
		const UserSubscriptions = this.Subscriptions.get(userId);
		if (UserSubscriptions) {
			UserSubscriptions.delete(subscriptionId);
			if (UserSubscriptions.size === 0) {
				this.Subscriptions.delete(userId);
			}
		}

		this.Logger.debug(`Removed subscription ${subscriptionId} for user: ${userId}`);
	}

	/**
   * Checks if a user can accept a new subscription
   * @param userId IUser ID
   * @returns True if subscription can be accepted
   */
	public CanAcceptSubscription(userId: string): boolean {
		const UserSubscriptions = this.Subscriptions.get(userId);
		const CurrentCount = UserSubscriptions ? UserSubscriptions.size : 0;
		return CurrentCount < this.ISubscriptionConfig.connection.maxSubscriptionsPerUser;
	}

	/**
   * Gets the total number of active connections
   * @returns Number of connections
   */
	public GetConnectionCount(): number {
		let Total = 0;
		for (const Connections of this.Connections.values()) {
			Total += Connections.size;
		}
		return Total;
	}

	/**
   * Gets the total number of active subscriptions
   * @returns Number of subscriptions
   */
	public GetSubscriptionCount(): number {
		let Total = 0;
		for (const Subscriptions of this.Subscriptions.values()) {
			Total += Subscriptions.size;
		}
		return Total;
	}

	/**
   * Gets connection statistics
   * @returns Statistics object
   */
	public GetStats(): {
		totalConnections: number;
		totalSubscriptions: number;
		connectionsByUser: Record<string, number>;
		subscriptionsByUser: Record<string, number>;
	} {
		const ConnectionsByUser: Record<string, number> = {};
		const SubscriptionsByUser: Record<string, number> = {};

		for (const [UserId, Connections] of this.Connections) {
			ConnectionsByUser[UserId] = Connections.size;
		}

		for (const [UserId, Subs] of this.Subscriptions) {
			SubscriptionsByUser[UserId] = Subs.size;
		}

		return {
			totalConnections: this.GetConnectionCount(),
			totalSubscriptions: this.GetSubscriptionCount(),
			connectionsByUser: ConnectionsByUser,
			subscriptionsByUser: SubscriptionsByUser,
		};
	}

	/**
   * Removes all subscriptions for a user
   * @param userId IUser ID
   */
	private RemoveAllSubscriptionsForUser(userId: string): void {
		this.Subscriptions.delete(userId);
	}

	/**
   * Cleanup method called when module is destroyed
   */
	public onModuleDestroy(): void {
		this.Logger.info('Destroying connection manager');

		// Clear all timers
		for (const Timer of this.ConnectionTimers.values()) {
			clearTimeout(Timer);
		}
		this.ConnectionTimers.clear();

		// Clear all connections and subscriptions
		this.Connections.clear();
		this.Subscriptions.clear();

		this.Logger.info('Connection manager destroyed');
	}
}
