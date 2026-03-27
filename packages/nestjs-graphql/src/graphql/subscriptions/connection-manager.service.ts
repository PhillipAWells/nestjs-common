declare global {
	namespace NodeJS {
		interface Timeout {}
	}
}

import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
import type { SubscriptionConfig } from './subscription-config.interface.js';
import { MAX_WEBSOCKET_CONNECTIONS } from '../constants/subscriptions.constants.js';

/**
 * Service for managing WebSocket connections and subscriptions
 */
@Injectable()
export class ConnectionManagerService implements LazyModuleRefService {
	public readonly Module: ModuleRef;
	private readonly logger: AppLogger;

	private readonly connections = new Map<string, Set<any>>();

	private readonly subscriptions = new Map<string, Set<string>>();

	// eslint-disable-next-line no-undef
	private readonly connectionTimers = new Map<string, NodeJS.Timeout>();

	private readonly connectionIdMap = new WeakMap<any, string>();

	private connectionCounter = 0;

	public get SubscriptionConfig(): SubscriptionConfig {
		return this.Module.get<SubscriptionConfig>('SUBSCRIPTION_CONFIG', { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
		this.logger = new AppLogger(undefined, ConnectionManagerService.name);
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
		if (ws && typeof ws === 'object' && this.connectionIdMap.has(ws)) {
			const existing = this.connectionIdMap.get(ws);
			if (existing !== undefined) {
				return existing;
			}
		}
		// Generate a new key for this object
		return `${userId}:${this.connectionCounter++}`;
	}

	/**
   * Adds a new WebSocket connection
   * @param ws WebSocket connection
   * @param userId User ID
   * @param authenticatedUserId Authenticated user ID from token verification — must match userId
   */
	public addConnection(ws: any, userId: string, authenticatedUserId: string): void {
		// Verify the authenticated user matches the requested userId
		if (userId !== authenticatedUserId) {
			this.logger.warn(`Connection rejected: authenticated user ${authenticatedUserId} attempted to connect as ${userId}`);
			throw new Error(`Unauthorized: cannot create connection for user ${userId}`);
		}

		if (!this.connections.has(userId)) {
			this.connections.set(userId, new Set());
		}
		this.connections.get(userId)?.add(ws);

		// Generate unique connection ID using helper method
		const connectionId = this.getConnectionKey(ws, userId);

		// Track the connectionId in WeakMap for later retrieval (only if object)
		if (ws && typeof ws === 'object' && !('id' in ws)) {
			this.connectionIdMap.set(ws, connectionId);
		}

		// Set connection timeout
		const timer = setTimeout(() => {
			this.removeConnection(ws, userId);
		}, this.SubscriptionConfig.connection.timeout);

		this.connectionTimers.set(connectionId, timer);

		this.logger.debug(`Added connection for user: ${userId}`);
	}

	/**
   * Removes a WebSocket connection
   * @param ws WebSocket connection
   * @param userId User ID
   */
	public removeConnection(ws: any, userId: string): void {
		const userConnections = this.connections.get(userId);
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
				this.connections.delete(userId);
			}
		}

		// Clear timeout using the same key generation logic
		const connectionId = this.getConnectionKey(ws, userId);
		const timer = this.connectionTimers.get(connectionId);
		if (timer) {
			clearTimeout(timer);
		}
		this.connectionTimers.delete(connectionId);

		// Clean up WeakMap if applicable
		if (ws && typeof ws === 'object' && !('id' in ws)) {
			this.connectionIdMap.delete(ws);
		}

		// Remove all subscriptions for this connection
		this.removeAllSubscriptionsForUser(userId);

		this.logger.debug(`Removed connection for user: ${userId}`);
	}

	/**
   * Checks if a user can accept a new connection
   * @param userId User ID
   * @returns True if connection can be accepted
   */
	public canAcceptConnection(userId: string): boolean {
		const userConnections = this.connections.get(userId);
		const currentCount = userConnections ? userConnections.size : 0;
		return currentCount < (this.SubscriptionConfig.websocket.maxConnections ?? MAX_WEBSOCKET_CONNECTIONS);
	}

	/**
   * Adds a subscription for a user
   * @param userId User ID
   * @param subscriptionId Subscription ID
   */
	public addSubscription(userId: string, subscriptionId: string): void {
		if (!this.subscriptions.has(userId)) {
			this.subscriptions.set(userId, new Set());
		}
		this.subscriptions.get(userId)?.add(subscriptionId);

		this.logger.debug(`Added subscription ${subscriptionId} for user: ${userId}`);
	}

	/**
   * Removes a subscription for a user
   * @param userId User ID
   * @param subscriptionId Subscription ID
   */
	public removeSubscription(userId: string, subscriptionId: string): void {
		const userSubscriptions = this.subscriptions.get(userId);
		if (userSubscriptions) {
			userSubscriptions.delete(subscriptionId);
			if (userSubscriptions.size === 0) {
				this.subscriptions.delete(userId);
			}
		}

		this.logger.debug(`Removed subscription ${subscriptionId} for user: ${userId}`);
	}

	/**
   * Checks if a user can accept a new subscription
   * @param userId User ID
   * @returns True if subscription can be accepted
   */
	public canAcceptSubscription(userId: string): boolean {
		const userSubscriptions = this.subscriptions.get(userId);
		const currentCount = userSubscriptions ? userSubscriptions.size : 0;
		return currentCount < this.SubscriptionConfig.connection.maxSubscriptionsPerUser;
	}

	/**
   * Gets the total number of active connections
   * @returns Number of connections
   */
	public getConnectionCount(): number {
		let total = 0;
		for (const connections of this.connections.values()) {
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
		for (const subscriptions of this.subscriptions.values()) {
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

		for (const [userId, connections] of this.connections) {
			connectionsByUser[userId] = connections.size;
		}

		for (const [userId, subs] of this.subscriptions) {
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
   * @param userId User ID
   */
	private removeAllSubscriptionsForUser(userId: string): void {
		this.subscriptions.delete(userId);
	}

	/**
   * Cleanup method called when module is destroyed
   */
	public onModuleDestroy(): void {
		this.logger.info('Destroying connection manager');

		// Clear all timers
		for (const timer of this.connectionTimers.values()) {
			clearTimeout(timer);
		}
		this.connectionTimers.clear();

		// Clear all connections and subscriptions
		this.connections.clear();
		this.subscriptions.clear();

		this.logger.info('Connection manager destroyed');
	}
}
