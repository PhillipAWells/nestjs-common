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
	private getConnectionKey(ws: any, userId: string): string {
		// If WebSocket has an id property, use it for stability across object instances
		if (ws && typeof ws === 'object' && 'id' in ws) {
			return `${userId}:${ws.id}`;
		}
		// Check if we've already assigned a key to this object
		if (ws && typeof ws === 'object' && this.ConnectionIdMap.has(ws)) {
			const existing = this.ConnectionIdMap.get(ws);
			if (existing !== undefined) {
				return existing;
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
	public addConnection(ws: any, userId: string, authenticatedUserId: string): void {
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
		const connectionId = this.getConnectionKey(ws, userId);

		// Track the connectionId in WeakMap for later retrieval (only if object)
		if (ws && typeof ws === 'object' && !('id' in ws)) {
			this.ConnectionIdMap.set(ws, connectionId);
		}

		// Set connection timeout
		const timer = setTimeout(() => {
			this.removeConnection(ws, userId);
		}, this.ISubscriptionConfig.connection.timeout);

		this.ConnectionTimers.set(connectionId, timer);

		this.Logger.debug(`Added connection for user: ${userId}`);
	}

	/**
   * Removes a WebSocket connection
   * @param ws WebSocket connection
   * @param userId IUser ID
   */
	public removeConnection(ws: any, userId: string): void {
		const userConnections = this.Connections.get(userId);
		if (userConnections) {
			// If ws has an id property, match by id
			if (ws && typeof ws === 'object' && 'id' in ws) {
				for (const connection of userConnections) {
					if (connection && typeof connection === 'object' && 'id' in connection && connection.id === ws.id) {
						userConnections.delete(connection);
						break;
					}
				}
			} else {
				// Otherwise match by object reference
				userConnections.delete(ws);
			}

			if (userConnections.size === 0) {
				this.Connections.delete(userId);
			}
		}

		// Clear timeout using the same key generation logic
		const connectionId = this.getConnectionKey(ws, userId);
		const timer = this.ConnectionTimers.get(connectionId);
		if (timer) {
			clearTimeout(timer);
		}
		this.ConnectionTimers.delete(connectionId);

		// Clean up WeakMap if applicable
		if (ws && typeof ws === 'object' && !('id' in ws)) {
			this.ConnectionIdMap.delete(ws);
		}

		// Remove all subscriptions for this connection
		this.removeAllSubscriptionsForUser(userId);

		this.Logger.debug(`Removed connection for user: ${userId}`);
	}

	/**
   * Checks if a user can accept a new connection
   * @param userId IUser ID
   * @returns True if connection can be accepted
   */
	public canAcceptConnection(userId: string): boolean {
		const userConnections = this.Connections.get(userId);
		const currentCount = userConnections ? userConnections.size : 0;
		return currentCount < (this.ISubscriptionConfig.websocket.maxConnections ?? MAX_WEBSOCKET_CONNECTIONS);
	}

	/**
   * Adds a subscription for a user
   * @param userId IUser ID
   * @param subscriptionId Subscription ID
   */
	public addSubscription(userId: string, subscriptionId: string): void {
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
	public removeSubscription(userId: string, subscriptionId: string): void {
		const userSubscriptions = this.Subscriptions.get(userId);
		if (userSubscriptions) {
			userSubscriptions.delete(subscriptionId);
			if (userSubscriptions.size === 0) {
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
	public canAcceptSubscription(userId: string): boolean {
		const userSubscriptions = this.Subscriptions.get(userId);
		const currentCount = userSubscriptions ? userSubscriptions.size : 0;
		return currentCount < this.ISubscriptionConfig.connection.maxSubscriptionsPerUser;
	}

	/**
   * Gets the total number of active connections
   * @returns Number of connections
   */
	public getConnectionCount(): number {
		let total = 0;
		for (const connections of this.Connections.values()) {
			total += connections.size;
		}
		return total;
	}

	/**
   * Gets the total number of active subscriptions
   * @returns Number of subscriptions
   */
	public getSubscriptionCount(): number {
		let total = 0;
		for (const subscriptions of this.Subscriptions.values()) {
			total += subscriptions.size;
		}
		return total;
	}

	/**
   * Gets connection statistics
   * @returns Statistics object
   */
	public getStats(): {
		totalConnections: number;
		totalSubscriptions: number;
		connectionsByUser: Record<string, number>;
		subscriptionsByUser: Record<string, number>;
	} {
		const connectionsByUser: Record<string, number> = {};
		const subscriptionsByUser: Record<string, number> = {};

		for (const [userId, connections] of this.Connections) {
			connectionsByUser[userId] = connections.size;
		}

		for (const [userId, subs] of this.Subscriptions) {
			subscriptionsByUser[userId] = subs.size;
		}

		return {
			totalConnections: this.getConnectionCount(),
			totalSubscriptions: this.getSubscriptionCount(),
			connectionsByUser,
			subscriptionsByUser,
		};
	}

	/**
   * Removes all subscriptions for a user
   * @param userId IUser ID
   */
	private removeAllSubscriptionsForUser(userId: string): void {
		this.Subscriptions.delete(userId);
	}

	/**
   * Cleanup method called when module is destroyed
   */
	public onModuleDestroy(): void {
		this.Logger.info('Destroying connection manager');

		// Clear all timers
		for (const timer of this.ConnectionTimers.values()) {
			clearTimeout(timer);
		}
		this.ConnectionTimers.clear();

		// Clear all connections and subscriptions
		this.Connections.clear();
		this.Subscriptions.clear();

		this.Logger.info('Connection manager destroyed');
	}
}
