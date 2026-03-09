import { Injectable, Logger, Inject } from '@nestjs/common';
import type { SubscriptionConfig } from './subscription-config.interface.js';
import { MAX_WEBSOCKET_CONNECTIONS } from '../constants/subscriptions.constants.js';

/**
 * Service for managing WebSocket connections and subscriptions
 */
@Injectable()
export class ConnectionManagerService {
	private readonly logger = new Logger(ConnectionManagerService.name);

	private readonly connections = new Map<string, Set<any>>();

	private readonly subscriptions = new Map<string, Set<string>>();

	private readonly connectionTimers = new Map<string, NodeJS.Timeout>();

	constructor(@Inject('SUBSCRIPTION_CONFIG') private readonly config: SubscriptionConfig) {}

	/**
   * Adds a new WebSocket connection
   * @param ws WebSocket connection
   * @param userId User ID
   */
	public addConnection(ws: any, userId: string): void {
		if (!this.connections.has(userId)) {
			this.connections.set(userId, new Set());
		}
		this.connections.get(userId)!.add(ws);

		// Set connection timeout
		const timer = setTimeout(() => {
			this.removeConnection(ws, userId);
		}, this.config.connection.timeout);

		this.connectionTimers.set(`${userId}:${ws}`, timer);

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
			userConnections.delete(ws);
			if (userConnections.size === 0) {
				this.connections.delete(userId);
			}
		}

		// Clear timeout
		const timerKey = `${userId}:${ws}`;
		const timer = this.connectionTimers.get(timerKey);
		if (timer) {
			clearTimeout(timer);
			this.connectionTimers.delete(timerKey);
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
		return currentCount < (this.config.websocket.maxConnections ?? MAX_WEBSOCKET_CONNECTIONS);
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
		this.subscriptions.get(userId)!.add(subscriptionId);

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
   * @param subscriptionId Subscription ID
   * @returns True if subscription can be accepted
   */
	public canAcceptSubscription(userId: string): boolean {
		const userSubscriptions = this.subscriptions.get(userId);
		const currentCount = userSubscriptions ? userSubscriptions.size : 0;
		return currentCount < this.config.connection.maxSubscriptionsPerUser;
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
	public async onModuleDestroy(): Promise<void> {
		this.logger.log('Destroying connection manager');

		// Clear all timers
		for (const timer of this.connectionTimers.values()) {
			clearTimeout(timer);
		}
		this.connectionTimers.clear();

		// Clear all connections and subscriptions
		this.connections.clear();
		this.subscriptions.clear();

		this.logger.log('Connection manager destroyed');
	}
}
