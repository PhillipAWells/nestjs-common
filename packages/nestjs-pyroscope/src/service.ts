import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { PyroscopeConfig } from '@pyroscope/nodejs';
import type { IPyroscopeConfig, IProfileMetrics, IProfileContext } from './interfaces/profiling.interface.js';
import { PYROSCOPE_CONFIG_TOKEN } from './constants.js';
import { MetricsService } from './services/metrics.service.js';
import type { MetricsResponse } from './services/metrics.service.js';
import {
	PROFILING_DEGRADED_ACTIVE_PROFILES_THRESHOLD,
	PROFILING_RETRY_BASE_DELAY_MS,
	PROFILING_RETRY_MAX_DELAY_MS,
	PROFILING_RETRY_JITTER_MS,
	PROFILING_TAG_MAX_LENGTH,
	PROFILING_MAX_METRICS_HISTORY,
	PROFILING_MAX_ACTIVE_PROFILES,
	PROFILING_RESPONSE_TIME_PRECISION,
	PROFILING_STALE_PROFILE_TIMEOUT_MS,
	PROFILING_ID_UUID_LENGTH,
} from './constants/profiling.constants.js';

interface IPyroscopeClient {
	init: (config: PyroscopeConfig) => void;
	start: () => void;
	stop: () => Promise<void>;
}

/**
 * Core service for managing Pyroscope profiling integration.
 *
 * Provides methods for:
 * - Starting/stopping profiling sessions with unique IDs
 * - Tracking function execution with automatic timing
 * - Managing tags (note: dynamic tag manipulation not supported by @pyroscope/nodejs)
 * - Collecting and aggregating profiling metrics
 * - Health status reporting
 *
 * Features:
 * - Automatic stale profile eviction (30-minute timeout)
 * - Bounded memory with max 10,000 active profiles and 1,000 metrics history
 * - Fire-and-forget async initialization to avoid blocking module startup
 * - Graceful degradation if Pyroscope client fails to initialize
 *
 * @example
 * ```typescript
 * export class MyService {
 *   constructor(private pyroscope: PyroscopeService) {}
 *
 *   async processData(data: any[]) {
 *     const context: IProfileContext = {
 *       functionName: 'processData',
 *       tags: { dataSize: data.length.toString() },
 *       startTime: Date.now(),
 *     };
 *
 *     this.pyroscope.startProfiling(context);
 *     try {
 *       return await this.heavyOperation(data);
 *     } finally {
 *       this.pyroscope.stopProfiling(context);
 *     }
 *   }
 * }
 * ```
 */
@Injectable()
export class PyroscopeService implements OnModuleInit, OnModuleDestroy {
	private pyroscopeClient: IPyroscopeClient | undefined;

	private isInitialized = false;

	private readonly activeProfiles = new Map<string, IProfileContext>();

	private readonly metrics: IProfileMetrics[] = [];

	/**
	 * Maximum number of metrics to keep in memory to prevent unbounded growth
	 */
	private readonly MAX_METRICS_HISTORY = PROFILING_MAX_METRICS_HISTORY;

	/**
	 * Maximum number of active profiles before evicting stale entries
	 */
	private readonly MAX_ACTIVE_PROFILES = PROFILING_MAX_ACTIVE_PROFILES;

	/**
	 * Maximum age (ms) for an active profile before it is considered stale and evicted
	 */
	private readonly STALE_PROFILE_TIMEOUT_MS = PROFILING_STALE_PROFILE_TIMEOUT_MS;

	constructor(private readonly moduleRef: ModuleRef) {}

	private get config(): IPyroscopeConfig {
		const cfg = this.moduleRef.get<IPyroscopeConfig>(PYROSCOPE_CONFIG_TOKEN, { strict: false });
		if (!cfg) {
			throw new Error('PyroscopeService: PYROSCOPE_CONFIG_TOKEN is not available in the module context');
		}
		return cfg;
	}

	private get logger(): Logger {
		return this.moduleRef.get(Logger, { strict: false }) ?? new Logger(PyroscopeService.name);
	}

	private get metricsService(): MetricsService | undefined {
		try {
			return this.moduleRef.get(MetricsService, { strict: false });
		} catch {
			return undefined;
		}
	}

	/**
	 * Initialize Pyroscope client on module initialization
	 * Returns immediately without blocking, initialization happens in background
	 */
	public onModuleInit(): void {
		if (!this.config.enabled) {
			this.logger.log('Pyroscope profiling is disabled');
			return;
		}

		// Fire-and-forget: defer initialization to next event loop iteration
		setImmediate(() => void this.initializePyroscope());
	}

	/**
	 * Initialize Pyroscope client asynchronously
	 * @private
	 */
	private async initializePyroscope(): Promise<void> {
		try {
			// Dynamic import to avoid issues if package is not installed
			const Pyroscope = await import('@pyroscope/nodejs');

			// Configure Pyroscope client using the typed PyroscopeConfig interface
			const pyroscopeConfig: PyroscopeConfig = {
				serverAddress: this.config.serverAddress,
				appName: this.config.applicationName,
				tags: this.config.tags ?? {},
			};

			// Add optional configuration
			if (this.config.basicAuthUser && this.config.basicAuthPassword) {
				pyroscopeConfig.basicAuthUser = this.config.basicAuthUser;
				pyroscopeConfig.basicAuthPassword = this.config.basicAuthPassword;
			}

			// Initialize and start profiling
			Pyroscope.init(pyroscopeConfig);
			Pyroscope.start();

			this.pyroscopeClient = Pyroscope;
			this.isInitialized = true;

			this.logger.log(`Pyroscope profiling initialized for ${this.config.applicationName}`);
			this.logger.debug('Profiling configuration:', {
				degradedActiveProfilesThreshold: this.config.degradedActiveProfilesThreshold ?? PROFILING_DEGRADED_ACTIVE_PROFILES_THRESHOLD,
				retryBaseDelayMs: this.config.retryBaseDelayMs ?? PROFILING_RETRY_BASE_DELAY_MS,
				retryMaxDelayMs: this.config.retryMaxDelayMs ?? PROFILING_RETRY_MAX_DELAY_MS,
				retryJitterMs: this.config.retryJitterMs ?? PROFILING_RETRY_JITTER_MS,
				tagMaxLength: this.config.tagMaxLength ?? PROFILING_TAG_MAX_LENGTH,
			});
		} catch (error) {
			this.logger.error('Failed to initialize Pyroscope profiling', error);
			// Graceful degradation - continue without profiling
		}
	}

	/**
	 * Cleanup on module destruction
	 */
	public async onModuleDestroy(): Promise<void> {
		// Clear active profiles to release memory
		this.activeProfiles.clear();

		if (this.pyroscopeClient && this.isInitialized) {
			try {
				await this.pyroscopeClient.stop();
				this.logger.log('Pyroscope profiling stopped');
			} catch (error) {
				this.logger.error('Error stopping Pyroscope profiling', error);
			}
		}
	}

	/**
	 * Start profiling for a given context.
	 *
	 * Generates a unique profile ID, stores the context, and triggers stale profile eviction
	 * if the active profile count exceeds the maximum threshold.
	 *
	 * @param context Profiling context with function name, tags, and timing
	 * @remarks
	 * - Returns immediately if profiling is disabled
	 * - Profile ID is automatically generated and stored in context
	 * - Old profiles (30+ minutes) are evicted if max profiles exceeded
	 *
	 * @example
	 * ```typescript
	 * const context: IProfileContext = {
	 *   functionName: 'getUserById',
	 *   className: 'UserService',
	 *   methodName: 'getUserById',
	 *   startTime: Date.now(),
	 *   tags: { userId: '123' },
	 * };
	 * this.pyroscope.startProfiling(context);
	 * ```
	 */
	public startProfiling(context: IProfileContext): void {
		if (!this.isEnabled()) return;

		// Set start time if not already set (must happen before generateProfileId)
		// Use nullish coalescing to handle startTime: 0 edge case
		context.startTime ??= Date.now();

		// Generate and store profile ID in context for later retrieval
		const profileId = this.generateProfileId(context);
		context.profileId = profileId;

		this.activeProfiles.set(profileId, context);

		// Evict stale profiles to prevent memory leaks from profiles that are started but never stopped
		if (this.activeProfiles.size > this.MAX_ACTIVE_PROFILES) {
			this.evictStaleProfiles();
		}

		// Note: Dynamic tag manipulation is not supported by @pyroscope/nodejs
		// Tags must be set during initialization. Context tags are tracked for metrics only.

		this.logger.debug(`Started profiling: ${context.functionName}`, context.tags);
	}

	/**
	 * Stop profiling and return metrics.
	 *
	 * Marks the end of a profiling session, calculates duration, and adds the metrics
	 * to the internal history (bounded to 1,000 entries).
	 *
	 * @param context Profiling context (should have profileId from startProfiling)
	 * @returns IProfileMetrics with timing and tag information
	 * @remarks
	 * - Returns empty metrics if profiling is disabled
	 * - Calculates duration as endTime - startTime from original context
	 * - Merges start-time and stop-time tags
	 * - Removes the profile from active profiles map
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   const result = await this.heavyOperation();
	 *   return result;
	 * } finally {
	 *   const metrics = this.pyroscope.stopProfiling(context);
	 *   console.log(`Operation took ${metrics.duration}ms`);
	 * }
	 * ```
	 */
	public stopProfiling(context: IProfileContext): IProfileMetrics {
		if (!this.isEnabled()) {
			return this.createEmptyMetrics(context);
		}

		// Use stored profile ID from context
		if (!context.profileId) {
			this.logger.warn(`No profile ID found in context for: ${context.functionName} - profiling session was not started properly`);
			return this.createEmptyMetrics(context);
		}

		const { profileId } = context;
		const startContext = this.activeProfiles.get(profileId);

		if (!startContext) {
			this.logger.warn(`No active profiling session found for: ${context.functionName}`);
			return this.createEmptyMetrics(context);
		}

		context.endTime = Date.now();
		context.duration = context.endTime - startContext.startTime;

		// Note: Dynamic tag manipulation is not supported by @pyroscope/nodejs

		this.activeProfiles.delete(profileId);

		const metrics: IProfileMetrics = {
			cpuTime: 0, // Would need to integrate with actual profiling data
			memoryUsage: 0, // Would need to integrate with actual profiling data
			duration: context.duration,
			timestamp: context.endTime,
			tags: { ...startContext.tags, ...context.tags },
		};

		this.metrics.push(metrics);

		// Keep metrics array bounded to prevent memory leak
		if (this.metrics.length > this.MAX_METRICS_HISTORY) {
			this.metrics.shift();
		}

		this.logger.debug(`Stopped profiling: ${context.functionName} (${context.duration}ms)`, context.tags);

		return metrics;
	}

	/**
	 * Add static tags to all profiling data.
	 *
	 * @param tags Key-value pairs to add to profiling context
	 * @deprecated Dynamic tag manipulation is not supported by @pyroscope/nodejs.
	 * Tags must be set during module initialization via IPyroscopeConfig.tags.
	 * This method logs a debug message and does nothing.
	 *
	 * @example
	 * ```typescript
	 * // Set tags at module initialization instead
	 * PyroscopeModule.forRoot({
	 *   config: {
	 *     // ...
	 *     tags: { environment: 'production', version: '1.0' },
	 *   },
	 * })
	 * ```
	 */
	public addTags(tags: Record<string, string>): void {
		if (!this.isEnabled() || !this.pyroscopeClient) return;

		this.logger.debug('Dynamic tag addition is not supported by @pyroscope/nodejs. Tags must be set during initialization.', tags);
	}

	/**
	 * Remove tags from profiling data.
	 *
	 * @param keys Tag keys to remove
	 * @deprecated Dynamic tag manipulation is not supported by @pyroscope/nodejs.
	 * This method logs a debug message and does nothing.
	 */
	public removeTags(keys: string[]): void {
		if (!this.isEnabled() || !this.pyroscopeClient) return;

		this.logger.debug('Dynamic tag removal is not supported by @pyroscope/nodejs. Tags must be set during initialization.', keys);
	}

	/**
	 * Track function execution with profiling.
	 *
	 * Provides a convenience method to wrap a function with automatic profiling
	 * start/stop lifecycle management.
	 *
	 * @param name Function name for profiling
	 * @param fn Function to execute (sync or async)
	 * @param tags Optional tags to attach to this profile
	 * @returns Result of the function execution
	 * @throws Rethrows any error thrown by fn after stopping profiling
	 *
	 * @example
	 * ```typescript
	 * const result = await this.pyroscope.trackFunction('expensive-operation', async () => {
	 *   return await this.database.query(sql);
	 * }, { queryType: 'select' });
	 * ```
	 */
	public async trackFunction<T>(
		name: string,
		fn: () => T | Promise<T>,
		tags?: Record<string, string>,
	): Promise<T> {
		const context: IProfileContext = {
			functionName: name,
			startTime: Date.now(),
			...(tags && { tags }),
		};

		this.startProfiling(context);

		try {
			const result = await fn();
			this.stopProfiling(context);
			return result;
		} catch (error) {
			context.error = error as Error;
			this.stopProfiling(context);
			throw error;
		}
	}

	/**
	 * Get collected profile metrics.
	 *
	 * Returns a copy of all collected profiling metrics (bounded to 1,000 entries).
	 *
	 * @returns Array of IProfileMetrics with timing and tag information
	 *
	 * @example
	 * ```typescript
	 * const allMetrics = this.pyroscope.getProfileMetrics();
	 * const avgDuration = allMetrics.reduce((sum, m) => sum + m.duration, 0) / allMetrics.length;
	 * ```
	 */
	public getProfileMetrics(): IProfileMetrics[] {
		return [...this.metrics];
	}

	/**
	 * Get aggregated metrics summary.
	 *
	 * Delegates to MetricsService if available, otherwise returns basic aggregations
	 * from collected metrics.
	 *
	 * @returns MetricsResponse with aggregated CPU, memory, and request metrics
	 *
	 * @example
	 * ```typescript
	 * const metrics = this.pyroscope.getMetrics();
	 * console.log(`Processed ${metrics.requests.total} requests with ${metrics.requests.successful} successes`);
	 * ```
	 */
	public getMetrics(): MetricsResponse {
		if (this.metricsService) {
			return this.metricsService.getMetrics();
		}

		// Fallback to basic aggregated data from existing metrics
		const totalMetrics = this.metrics.length;
		const totalCpuTime = this.metrics.reduce((sum, m) => sum + m.cpuTime, 0);
		const totalMemory = this.metrics.reduce((sum, m) => sum + m.memoryUsage, 0);
		const averageDuration = totalMetrics > 0
			? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalMetrics
			: 0;

		return {
			timestamp: Date.now(),
			cpu: {
				samples: totalMetrics,
				duration: totalCpuTime,
			},
			memory: {
				samples: totalMetrics,
				allocations: totalMemory,
			},
			requests: {
				total: totalMetrics,
				successful: totalMetrics, // Assume all are successful for now
				failed: 0,
				averageResponseTime: Math.round(averageDuration * PROFILING_RESPONSE_TIME_PRECISION) / PROFILING_RESPONSE_TIME_PRECISION,
			},
		};
	}

	/**
	 * Get health status of profiling service.
	 *
	 * Returns the current health state including initialization status,
	 * active profiles, and metrics count.
	 *
	 * @returns Object with status ('healthy' | 'unhealthy') and detailed information
	 *
	 * @example
	 * ```typescript
	 * const health = this.pyroscope.getHealth();
	 * if (health.status === 'healthy') {
	 *   console.log(`Active profiles: ${health.details.activeProfiles}`);
	 * }
	 * ```
	 */
	public getHealth(): {
		status: 'healthy' | 'unhealthy';
		details: {
			enabled?: boolean;
			initialized?: boolean;
			activeProfiles?: number;
			totalMetrics?: number;
			serverAddress?: string;
			applicationName?: string;
		};
	} {
		if (!this.config.enabled) {
			return { status: 'healthy', details: { enabled: false } };
		}

		if (!this.isInitialized) {
			return { status: 'unhealthy', details: { initialized: false } };
		}

		return {
			status: 'healthy',
			details: {
				initialized: true,
				activeProfiles: this.activeProfiles.size,
				totalMetrics: this.metrics.length,
				serverAddress: this.config.serverAddress,
				applicationName: this.config.applicationName,
			},
		};
	}

	/**
	 * Check if profiling is enabled and initialized.
	 *
	 * @returns true only if profiling is configured as enabled AND Pyroscope client initialization succeeded
	 */
	public isEnabled(): boolean {
		return this.config.enabled && this.isInitialized;
	}

	/**
	 * Evict stale profiles that have exceeded the timeout threshold.
	 * Prevents unbounded memory growth from profiles that are started but never stopped.
	 */
	private evictStaleProfiles(): void {
		const now = Date.now();
		let evictedCount = 0;

		for (const [profileId, profileContext] of this.activeProfiles.entries()) {
			const age = now - (profileContext.startTime ?? now);
			if (age > this.STALE_PROFILE_TIMEOUT_MS) {
				this.activeProfiles.delete(profileId);
				evictedCount++;
			}
		}

		if (evictedCount > 0) {
			this.logger.warn(`Evicted ${evictedCount} stale active profiles (exceeded ${this.STALE_PROFILE_TIMEOUT_MS}ms timeout)`);
		}
	}

	/**
	 * Generate unique profile ID for tracking
	 */
	private generateProfileId(context: IProfileContext): string {
		const uniquePart = crypto.randomUUID().replace(/-/g, '').substring(0, PROFILING_ID_UUID_LENGTH);
		return `${context.functionName}_${context.startTime}_${uniquePart}`;
	}

	/**
	 * Create empty metrics for disabled profiling
	 */
	private createEmptyMetrics(context: IProfileContext): IProfileMetrics {
		return {
			cpuTime: 0,
			memoryUsage: 0,
			duration: 0,
			timestamp: Date.now(),
			...(context.tags && { tags: context.tags }),
		};
	}
}
