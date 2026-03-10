declare global {
	namespace NodeJS {
		interface Timeout {}
	}
}

import { Injectable, Logger, OnModuleDestroy, Inject } from '@nestjs/common';
import type { SubscriptionConfig } from './subscription-config.interface.js';
import { REDIS_PUBSUB_CLEANUP_INTERVAL } from '../constants/subscriptions.constants.js';

/**
 * Service for handling resilience patterns (keepalive, reconnection, error recovery)
 */
@Injectable()
export class ResilienceService implements OnModuleDestroy {
	private readonly logger = new Logger(ResilienceService.name);

	// eslint-disable-next-line no-undef
	private readonly keepaliveTimers = new Map<string, NodeJS.Timeout>();

	// eslint-disable-next-line no-undef
	private readonly reconnectionTimers = new Map<string, NodeJS.Timeout>();

	// eslint-disable-next-line no-undef
	private shutdownTimeout?: NodeJS.Timeout;

	constructor(@Inject('SUBSCRIPTION_CONFIG') private readonly config: SubscriptionConfig) {}

	/**
   * Starts keepalive for a connection
   * @param connectionId Connection identifier
   * @param callback Keepalive callback function
   */
	public startKeepalive(connectionId: string, callback: () => void): void {
		if (!this.config.resilience.keepalive.enabled) {
			return;
		}

		const timer = setInterval(() => {
			try {
				callback();
			} catch (error: any) {
				this.logger.error(`Keepalive error for connection ${connectionId}: ${error.message}`);
			}
		}, this.config.resilience.keepalive.interval);

		this.keepaliveTimers.set(connectionId, timer);
		this.logger.debug(`Started keepalive for connection: ${connectionId}`);
	}

	/**
   * Stops keepalive for a connection
   * @param connectionId Connection identifier
   */
	public stopKeepalive(connectionId: string): void {
		const timer = this.keepaliveTimers.get(connectionId);
		if (timer) {
			clearInterval(timer);
			this.keepaliveTimers.delete(connectionId);
			this.logger.debug(`Stopped keepalive for connection: ${connectionId}`);
		}
	}

	/**
   * Schedules reconnection attempt
   * @param connectionId Connection identifier
   * @param callback Reconnection callback function
   * @param attempt Current attempt number
   */
	public scheduleReconnection(
		connectionId: string,
		callback: () => Promise<void>,
		attempt: number = 1,
	): void {
		if (!this.config.resilience.reconnection.enabled) {
			return;
		}

		if (attempt > this.config.resilience.reconnection.attempts) {
			this.logger.warn(`Max reconnection attempts reached for connection: ${connectionId}`);
			return;
		}

		const delay = this.calculateReconnectionDelay(attempt);

		const timer = setTimeout(async () => {
			try {
				await callback();
				this.logger.log(`Reconnection successful for connection: ${connectionId}`);
			} catch (error: any) {
				this.logger.warn(`Reconnection attempt ${attempt} failed for ${connectionId}: ${error.message}`);
				// Schedule next attempt
				this.scheduleReconnection(connectionId, callback, attempt + 1);
			}
		}, delay);

		this.reconnectionTimers.set(connectionId, timer);
		this.logger.debug(`Scheduled reconnection attempt ${attempt} for connection: ${connectionId} in ${delay}ms`);
	}

	/**
   * Cancels reconnection for a connection
   * @param connectionId Connection identifier
   */
	public cancelReconnection(connectionId: string): void {
		const timer = this.reconnectionTimers.get(connectionId);
		if (timer) {
			clearTimeout(timer);
			this.reconnectionTimers.delete(connectionId);
			this.logger.debug(`Cancelled reconnection for connection: ${connectionId}`);
		}
	}

	/**
   * Handles connection errors with recovery strategies
   * @param connectionId Connection identifier
   * @param error Error that occurred
   * @param recoveryCallback Recovery callback function
   */
	public async handleConnectionError(
		connectionId: string,
		error: Error,
		recoveryCallback: () => Promise<void>,
	): Promise<void> {
		this.logger.error(`Connection error for ${connectionId}: ${error.message}`, error.stack);

		if (!this.config.resilience.errorRecovery.enabled) {
			return;
		}

		// Stop keepalive
		this.stopKeepalive(connectionId);

		// Attempt recovery
		let attempt = 1;
		const { maxRetries } = this.config.resilience.errorRecovery;

		while (attempt <= maxRetries) {
			try {
				await new Promise(resolve => setTimeout(resolve, this.config.resilience.errorRecovery.retryDelay));
				await recoveryCallback();
				this.logger.log(`Error recovery successful for connection: ${connectionId}`);
				return;
			} catch (recoveryError: any) {
				this.logger.warn(`Error recovery attempt ${attempt} failed for ${connectionId}: ${recoveryError.message}`);
				attempt++;
			}
		}

		this.logger.error(`Error recovery failed for connection: ${connectionId} after ${maxRetries} attempts`);
	}

	/**
   * Initiates graceful shutdown
   * @param shutdownCallback Shutdown callback function
   */
	public async gracefulShutdown(shutdownCallback: () => Promise<void>): Promise<void> {
		this.logger.log('Initiating graceful shutdown');

		// Set shutdown timeout
		this.shutdownTimeout = setTimeout(() => {
			this.logger.error('Graceful shutdown timeout exceeded, forcing shutdown');
			process.exit(1);
		}, this.config.resilience.shutdown.timeout);

		try {
			await shutdownCallback();
			this.logger.log('Graceful shutdown completed');
		} catch (error: any) {
			this.logger.error(`Shutdown error: ${error.message}`, error.stack);
		} finally {
			if (this.shutdownTimeout) {
				clearTimeout(this.shutdownTimeout);
			}
		}
	}

	/**
   * Calculates reconnection delay based on backoff strategy
   * @param attempt Attempt number
   * @returns Delay in milliseconds
   */
	private calculateReconnectionDelay(attempt: number): number {
		const baseDelay = this.config.resilience.reconnection.delay;

		if (this.config.resilience.reconnection.backoff === 'exponential') {
			return Math.min(baseDelay * Math.pow(2, attempt - 1), REDIS_PUBSUB_CLEANUP_INTERVAL ?? 30000); // Max 30 seconds
		} else {
			return baseDelay;
		}
	}

	/**
   * Gets resilience statistics
   * @returns Statistics object
   */
	public getStats(): {
		activeKeepalives: number;
		pendingReconnections: number;
		shutdownInProgress: boolean;
	} {
		return {
			activeKeepalives: this.keepaliveTimers.size,
			pendingReconnections: this.reconnectionTimers.size,
			shutdownInProgress: this.shutdownTimeout !== undefined,
		};
	}

	/**
   * Cleanup method called when module is destroyed
   */
	public async onModuleDestroy(): Promise<void> {
		this.logger.log('Destroying resilience service');

		// Clear all timers
		for (const timer of this.keepaliveTimers.values()) {
			clearInterval(timer);
		}
		this.keepaliveTimers.clear();

		for (const timer of this.reconnectionTimers.values()) {
			clearTimeout(timer);
		}
		this.reconnectionTimers.clear();

		if (this.shutdownTimeout) {
			clearTimeout(this.shutdownTimeout);
		}

		this.logger.log('Resilience service destroyed');
	}
}
