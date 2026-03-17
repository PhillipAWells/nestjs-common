declare global {
	namespace NodeJS {
		interface Timeout {}
	}
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
import type { SubscriptionConfig } from './subscription-config.interface.js';
import { REDIS_PUBSUB_CLEANUP_INTERVAL } from '../constants/subscriptions.constants.js';

/**
 * Service for handling resilience patterns (keepalive, reconnection, error recovery)
 */
@Injectable()
export class ResilienceService implements OnModuleDestroy, LazyModuleRefService {
	private readonly logger: AppLogger;

	// eslint-disable-next-line no-undef
	private readonly keepaliveTimers = new Map<string, NodeJS.Timeout>();

	// eslint-disable-next-line no-undef
	private readonly reconnectionTimers = new Map<string, NodeJS.Timeout>();

	// eslint-disable-next-line no-undef
	private shutdownTimeout?: NodeJS.Timeout;

	public get SubscriptionConfig(): SubscriptionConfig {
		return this.Module.get<SubscriptionConfig>('SUBSCRIPTION_CONFIG', { strict: false });
	}

	constructor(public readonly Module: ModuleRef) {
		this.logger = new AppLogger(undefined, ResilienceService.name);
	}

	/**
   * Starts keepalive for a connection
   * @param connectionId Connection identifier
   * @param callback Keepalive callback function
   */
	public startKeepalive(connectionId: string, callback: () => void): void {
		if (!this.SubscriptionConfig.resilience.keepalive.enabled) {
			return;
		}

		const timer = setInterval(() => {
			try {
				callback();
			} catch (error: unknown) {
				this.logger.error(`Keepalive error for connection ${connectionId}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}, this.SubscriptionConfig.resilience.keepalive.interval);

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
		if (!this.SubscriptionConfig.resilience.reconnection.enabled) {
			return;
		}

		if (attempt > this.SubscriptionConfig.resilience.reconnection.attempts) {
			this.logger.warn(`Max reconnection attempts reached for connection: ${connectionId}`);
			return;
		}

		const delay = this.calculateReconnectionDelay(attempt);

		const timer = setTimeout(async () => {
			try {
				await callback();
				this.logger.info(`Reconnection successful for connection: ${connectionId}`);
			} catch (error: unknown) {
				this.logger.warn(`Reconnection attempt ${attempt} failed for ${connectionId}: ${error instanceof Error ? error.message : String(error)}`);
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

		if (!this.SubscriptionConfig.resilience.errorRecovery.enabled) {
			return;
		}

		// Stop keepalive
		this.stopKeepalive(connectionId);

		// Attempt recovery
		let attempt = 1;
		const { maxRetries } = this.SubscriptionConfig.resilience.errorRecovery;

		while (attempt <= maxRetries) {
			try {
				await new Promise(resolve => setTimeout(resolve, this.SubscriptionConfig.resilience.errorRecovery.retryDelay));
				await recoveryCallback();
				this.logger.info(`Error recovery successful for connection: ${connectionId}`);
				return;
			} catch (recoveryError: unknown) {
				this.logger.warn(`Error recovery attempt ${attempt} failed for ${connectionId}: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`);
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
		this.logger.info('Initiating graceful shutdown');

		// Set shutdown timeout
		this.shutdownTimeout = setTimeout(() => {
			this.logger.error('Graceful shutdown timeout exceeded, forcing shutdown');
			process.exit(1);
		}, this.SubscriptionConfig.resilience.shutdown.timeout);

		try {
			await shutdownCallback();
			this.logger.info('Graceful shutdown completed');
		} catch (error: unknown) {
			this.logger.error(`Shutdown error: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
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
		const baseDelay = this.SubscriptionConfig.resilience.reconnection.delay;

		if (this.SubscriptionConfig.resilience.reconnection.backoff === 'exponential') {
			return Math.min(baseDelay * Math.pow(2, attempt - 1), REDIS_PUBSUB_CLEANUP_INTERVAL); // Max 30 seconds
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
	public onModuleDestroy(): void {
		this.logger.info('Destroying resilience service');

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

		this.logger.info('Resilience service destroyed');
	}
}
