declare global {
	namespace NodeJS {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		interface Timeout {}
	}
}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage, getErrorStack } from '@pawells/nestjs-shared/common';
import type { ISubscriptionConfig } from './subscription-config.interface.js';
import { REDIS_PUBSUB_CLEANUP_INTERVAL } from '../constants/subscriptions.constants.js';

/**
 * Service for handling resilience patterns (keepalive, reconnection, error recovery)
 */
@Injectable()
export class ResilienceService implements OnModuleDestroy, ILazyModuleRefService {
	public readonly Module: ModuleRef;
	private readonly Logger: AppLogger;

	// eslint-disable-next-line no-undef
	private readonly KeepaliveTimers = new Map<string, NodeJS.Timeout>();

	// eslint-disable-next-line no-undef
	private readonly ReconnectionTimers = new Map<string, NodeJS.Timeout>();

	// eslint-disable-next-line no-undef
	private ShutdownTimeout?: NodeJS.Timeout;

	public get ISubscriptionConfig(): ISubscriptionConfig {
		return this.Module.get<ISubscriptionConfig>('SUBSCRIPTION_CONFIG', { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
		this.Logger = new AppLogger(undefined, ResilienceService.name);
	}

	/**
   * Starts keepalive for a connection
   * @param connectionId Connection identifier
   * @param callback Keepalive callback function
   */
	public StartKeepalive(connectionId: string, callback: () => void): void {
		if (!this.ISubscriptionConfig.resilience.keepalive.enabled) {
			return;
		}

		const Timer = setInterval(() => {
			try {
				callback();
			} catch (error: unknown) {
				this.Logger.error(`Keepalive error for connection ${connectionId}: ${getErrorMessage(error)}`);
			}
		}, this.ISubscriptionConfig.resilience.keepalive.interval);

		this.KeepaliveTimers.set(connectionId, Timer);
		this.Logger.debug(`Started keepalive for connection: ${connectionId}`);
	}

	/**
   * Stops keepalive for a connection
   * @param connectionId Connection identifier
   */
	public StopKeepalive(connectionId: string): void {
		const Timer = this.KeepaliveTimers.get(connectionId);
		if (Timer) {
			clearInterval(Timer);
			this.KeepaliveTimers.delete(connectionId);
			this.Logger.debug(`Stopped keepalive for connection: ${connectionId}`);
		}
	}

	/**
   * Schedules reconnection attempt
   * @param connectionId Connection identifier
   * @param callback Reconnection callback function
   * @param attempt Current attempt number
   */
	public ScheduleReconnection(
		connectionId: string,
		callback: () => Promise<void>,
		attempt: number = 1,
	): void {
		if (!this.ISubscriptionConfig.resilience.reconnection.enabled) {
			return;
		}

		if (attempt > this.ISubscriptionConfig.resilience.reconnection.attempts) {
			this.Logger.warn(`Max reconnection attempts reached for connection: ${connectionId}`);
			return;
		}

		const Delay = this.CalculateReconnectionDelay(attempt);

		const Timer = setTimeout(async () => {
			try {
				await callback();
				this.Logger.info(`Reconnection successful for connection: ${connectionId}`);
			} catch (error: unknown) {
				this.Logger.warn(`Reconnection attempt ${attempt} failed for ${connectionId}: ${getErrorMessage(error)}`);
				// Schedule next attempt
				this.ScheduleReconnection(connectionId, callback, attempt + 1);
			}
		}, Delay);

		this.ReconnectionTimers.set(connectionId, Timer);
		this.Logger.debug(`Scheduled reconnection attempt ${attempt} for connection: ${connectionId} in ${Delay}ms`);
	}

	/**
   * Cancels reconnection for a connection
   * @param connectionId Connection identifier
   */
	public CancelReconnection(connectionId: string): void {
		const Timer = this.ReconnectionTimers.get(connectionId);
		if (Timer) {
			clearTimeout(Timer);
			this.ReconnectionTimers.delete(connectionId);
			this.Logger.debug(`Cancelled reconnection for connection: ${connectionId}`);
		}
	}

	/**
   * Handles connection errors with recovery strategies
   * @param connectionId Connection identifier
   * @param error Error that occurred
   * @param recoveryCallback Recovery callback function
   */
	public async HandleConnectionError(
		connectionId: string,
		error: Error,
		recoveryCallback: () => Promise<void>,
	): Promise<void> {
		this.Logger.error(`Connection error for ${connectionId}: ${getErrorMessage(error)}`, getErrorStack(error));

		if (!this.ISubscriptionConfig.resilience.errorRecovery.enabled) {
			return;
		}

		// Stop keepalive
		this.StopKeepalive(connectionId);

		// Attempt recovery
		let Attempt = 1;
		const { maxRetries } = this.ISubscriptionConfig.resilience.errorRecovery;

		while (Attempt <= maxRetries) {
			try {
				await new Promise(resolve => setTimeout(resolve, this.ISubscriptionConfig.resilience.errorRecovery.retryDelay));
				await recoveryCallback();
				this.Logger.info(`Error recovery successful for connection: ${connectionId}`);
				return;
			} catch (recoveryError: unknown) {
				this.Logger.warn(`Error recovery attempt ${Attempt} failed for ${connectionId}: ${getErrorMessage(recoveryError)}`);
				Attempt++;
			}
		}

		this.Logger.error(`Error recovery failed for connection: ${connectionId} after ${maxRetries} attempts`);
	}

	/**
   * Initiates graceful shutdown
   * @param shutdownCallback Shutdown callback function
   */
	public async GracefulShutdown(shutdownCallback: () => Promise<void>): Promise<void> {
		this.Logger.info('Initiating graceful shutdown');

		// Set shutdown timeout
		this.ShutdownTimeout = setTimeout(() => {
			this.Logger.error('Graceful shutdown timeout exceeded, forcing shutdown');
			process.exit(1);
		}, this.ISubscriptionConfig.resilience.shutdown.timeout);

		try {
			await shutdownCallback();
			this.Logger.info('Graceful shutdown completed');
		} catch (error: unknown) {
			this.Logger.error(`Shutdown error: ${getErrorMessage(error)}`, getErrorStack(error));
		} finally {
			if (this.ShutdownTimeout) {
				clearTimeout(this.ShutdownTimeout);
			}
		}
	}

	/**
   * Calculates reconnection delay based on backoff strategy
   * @param attempt Attempt number
   * @returns Delay in milliseconds
   */
	private CalculateReconnectionDelay(attempt: number): number {
		const BaseDelay = this.ISubscriptionConfig.resilience.reconnection.delay;

		if (this.ISubscriptionConfig.resilience.reconnection.backoff === 'exponential') {
			return Math.min(BaseDelay * Math.pow(2, attempt - 1), REDIS_PUBSUB_CLEANUP_INTERVAL); // Max 30 seconds
		} else {
			return BaseDelay;
		}
	}

	/**
   * Gets resilience statistics
   * @returns Statistics object
   */
	public GetStats(): {
		activeKeepalives: number;
		pendingReconnections: number;
		shutdownInProgress: boolean;
	} {
		return {
			activeKeepalives: this.KeepaliveTimers.size,
			pendingReconnections: this.ReconnectionTimers.size,
			shutdownInProgress: this.ShutdownTimeout !== undefined,
		};
	}

	/**
   * Cleanup method called when module is destroyed
   */
	public onModuleDestroy(): void {
		this.Logger.info('Destroying resilience service');

		// Clear all timers
		for (const Timer of this.KeepaliveTimers.values()) {
			clearInterval(Timer);
		}
		this.KeepaliveTimers.clear();

		for (const Timer of this.ReconnectionTimers.values()) {
			clearTimeout(Timer);
		}
		this.ReconnectionTimers.clear();

		if (this.ShutdownTimeout) {
			clearTimeout(this.ShutdownTimeout);
		}

		this.Logger.info('Resilience service destroyed');
	}
}
