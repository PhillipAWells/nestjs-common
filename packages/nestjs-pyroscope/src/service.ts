import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { PyroscopeConfig } from '@pyroscope/nodejs';
import type { IPyroscopeConfig, IProfileMetrics, IProfileContext } from './interfaces/profiling.interface.js';
import { PYROSCOPE_CONFIG_TOKEN } from './constants.js';
import { MetricsService } from './services/metrics.service.js';
import { PyroscopeError } from './errors/pyroscope.errors.js';
import type { IMetricsResponse } from './services/metrics.service.js';
import { AppLogger, getErrorStack } from '@pawells/nestjs-shared/common';
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
	private PyroscopeClient: IPyroscopeClient | undefined;

	private IsInitialized = false;

	private readonly ActiveProfiles = new Map<string, IProfileContext>();

	private readonly Metrics: IProfileMetrics[] = [];

	private readonly Logger = new AppLogger(undefined, PyroscopeService.name);

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

	private readonly ModuleRef: ModuleRef;

	constructor(moduleRef: ModuleRef) {
		this.ModuleRef = moduleRef;
	}

	private get Config(): IPyroscopeConfig {
		const Cfg = this.ModuleRef.get<IPyroscopeConfig>(PYROSCOPE_CONFIG_TOKEN, { strict: false });
		if (!Cfg) {
			throw new PyroscopeError('PyroscopeService: PYROSCOPE_CONFIG_TOKEN is not available in the module context');
		}
		return Cfg;
	}

	private get MetricsService(): MetricsService | undefined {
		try {
			return this.ModuleRef.get(MetricsService, { strict: false });
		} catch {
			return undefined;
		}
	}

	/**
	 * Initialize Pyroscope client on module initialization
	 * Returns immediately without blocking, initialization happens in background
	 */
	public onModuleInit(): void {
		if (!this.Config.enabled) {
			this.Logger.debug('Pyroscope profiling is disabled');
			return;
		}

		// Fire-and-forget: defer initialization to next event loop iteration
		setImmediate(() => void this.InitializePyroscope());
	}

	/**
	 * Initialize Pyroscope client asynchronously
	 * @private
	 */
	private async InitializePyroscope(): Promise<void> {
		try {
			// Dynamic import to avoid issues if package is not installed
			const Pyroscope = await import('@pyroscope/nodejs');

			// Configure Pyroscope client using the typed PyroscopeConfig interface
			const PyroscopeConfig: PyroscopeConfig = {
				serverAddress: this.Config.serverAddress,
				appName: this.Config.applicationName,
				tags: this.Config.tags ?? {},
			};

			// Add optional configuration
			if (this.Config.basicAuthUser && this.Config.basicAuthPassword) {
				PyroscopeConfig.basicAuthUser = this.Config.basicAuthUser;
				PyroscopeConfig.basicAuthPassword = this.Config.basicAuthPassword;
			}

			// Initialize and start profiling
			Pyroscope.init(PyroscopeConfig);
			Pyroscope.start();

			this.PyroscopeClient = Pyroscope;
			this.IsInitialized = true;

			this.Logger.info(`Pyroscope profiling initialized for ${this.Config.applicationName}`);
			this.Logger.debug('Profiling configuration:', {
				degradedActiveProfilesThreshold: this.Config.degradedActiveProfilesThreshold ?? PROFILING_DEGRADED_ACTIVE_PROFILES_THRESHOLD,
				retryBaseDelayMs: this.Config.retryBaseDelayMs ?? PROFILING_RETRY_BASE_DELAY_MS,
				retryMaxDelayMs: this.Config.retryMaxDelayMs ?? PROFILING_RETRY_MAX_DELAY_MS,
				retryJitterMs: this.Config.retryJitterMs ?? PROFILING_RETRY_JITTER_MS,
				tagMaxLength: this.Config.tagMaxLength ?? PROFILING_TAG_MAX_LENGTH,
			});
		} catch (error) {
			this.Logger.error('Failed to initialize Pyroscope profiling', getErrorStack(error));
			// Graceful degradation - continue without profiling
		}
	}

	/**
	 * Cleanup on module destruction
	 */
	public async onModuleDestroy(): Promise<void> {
		// Clear active profiles to release memory
		this.ActiveProfiles.clear();

		if (this.PyroscopeClient && this.IsInitialized) {
			try {
				await this.PyroscopeClient.stop();
				this.Logger.debug('Pyroscope profiling stopped');
			} catch (error) {
				this.Logger.error('Error stopping Pyroscope profiling', getErrorStack(error));
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
	public StartProfiling(context: IProfileContext): void {
		if (!this.IsEnabled()) return;

		// Set start time if not already set (must happen before generateProfileId)
		// Use nullish coalescing to handle startTime: 0 edge case
		context.startTime ??= Date.now();

		// Generate and store profile ID in context for later retrieval
		const ProfileId = this.GenerateProfileId(context);
		context.profileId = ProfileId;

		this.ActiveProfiles.set(ProfileId, context);

		// Evict stale profiles to prevent memory leaks from profiles that are started but never stopped
		if (this.ActiveProfiles.size > this.MAX_ACTIVE_PROFILES) {
			this.EvictStaleProfiles();
		}

		// Note: Dynamic tag manipulation is not supported by @pyroscope/nodejs
		// Tags must be set during initialization. Context tags are tracked for metrics only.

		this.Logger.debug(`Started profiling: ${context.functionName}`, context.tags);
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
	public StopProfiling(context: IProfileContext): IProfileMetrics {
		if (!this.IsEnabled()) {
			return this.CreateEmptyMetrics(context);
		}

		// Use stored profile ID from context
		if (!context.profileId) {
			this.Logger.warn(`No profile ID found in context for: ${context.functionName} - profiling session was not started properly`);
			return this.CreateEmptyMetrics(context);
		}

		const { profileId: ProfileId } = context;
		const StartContext = this.ActiveProfiles.get(ProfileId);

		if (!StartContext) {
			this.Logger.warn(`No active profiling session found for: ${context.functionName}`);
			return this.CreateEmptyMetrics(context);
		}

		context.endTime = Date.now();
		context.duration = context.endTime - (StartContext.startTime ?? context.endTime);

		// Note: Dynamic tag manipulation is not supported by @pyroscope/nodejs

		this.ActiveProfiles.delete(ProfileId);

		const Metrics: IProfileMetrics = {
			cpuTime: 0, // Would need to integrate with actual profiling data
			memoryUsage: 0, // Would need to integrate with actual profiling data
			duration: context.duration,
			timestamp: context.endTime,
			tags: { ...StartContext.tags, ...context.tags },
		};

		this.Metrics.push(Metrics);

		// Keep metrics array bounded to prevent memory leak
		if (this.Metrics.length > this.MAX_METRICS_HISTORY) {
			this.Metrics.shift();
		}

		this.Logger.debug(`Stopped profiling: ${context.functionName} (${context.duration}ms)`, context.tags);

		return Metrics;
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
	public AddTags(tags: Record<string, string>): void {
		if (!this.IsEnabled() || !this.PyroscopeClient) return;

		this.Logger.debug('Dynamic tag addition is not supported by @pyroscope/nodejs. Tags must be set during initialization.', tags);
	}

	/**
	 * Remove tags from profiling data.
	 *
	 * @param keys ITag keys to remove
	 * @deprecated Dynamic tag manipulation is not supported by @pyroscope/nodejs.
	 * This method logs a debug message and does nothing.
	 */
	public RemoveTags(keys: string[]): void {
		if (!this.IsEnabled() || !this.PyroscopeClient) return;

		this.Logger.debug('Dynamic tag removal is not supported by @pyroscope/nodejs. Tags must be set during initialization.', keys);
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
	public async TrackFunction<T>(
		name: string,
		fn: () => T | Promise<T>,
		tags?: Record<string, string>,
	): Promise<T> {
		const Context: IProfileContext = {
			functionName: name,
			startTime: Date.now(),
			...(tags && { tags }),
		};

		this.StartProfiling(Context);

		try {
			const Result = await fn();
			this.StopProfiling(Context);
			return Result;
		} catch (error) {
			Context.error = error as Error;
			this.StopProfiling(Context);
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
	public GetProfileMetrics(): IProfileMetrics[] {
		return [...this.Metrics];
	}

	/**
	 * Get aggregated metrics summary.
	 *
	 * Delegates to MetricsService if available, otherwise returns basic aggregations
	 * from collected metrics.
	 *
	 * @returns IMetricsResponse with aggregated CPU, memory, and request metrics
	 *
	 * @example
	 * ```typescript
	 * const metrics = this.pyroscope.getMetrics();
	 * console.log(`Processed ${metrics.requests.total} requests with ${metrics.requests.successful} successes`);
	 * ```
	 */
	public GetMetrics(): IMetricsResponse {
		if (this.MetricsService) {
			return this.MetricsService.GetMetrics();
		}

		// Fallback to basic aggregated data from existing metrics
		const TotalMetrics = this.Metrics.length;
		const TotalCpuTime = this.Metrics.reduce((sum, m) => sum + m.cpuTime, 0);
		const TotalMemory = this.Metrics.reduce((sum, m) => sum + m.memoryUsage, 0);
		const AverageDuration = TotalMetrics > 0
			? this.Metrics.reduce((sum, m) => sum + m.duration, 0) / TotalMetrics
			: 0;

		return {
			timestamp: Date.now(),
			cpu: {
				samples: TotalMetrics,
				duration: TotalCpuTime,
			},
			memory: {
				samples: TotalMetrics,
				allocations: TotalMemory,
			},
			requests: {
				total: TotalMetrics,
				successful: TotalMetrics, // Assume all are successful for now
				failed: 0,
				averageResponseTime: Math.round(AverageDuration * PROFILING_RESPONSE_TIME_PRECISION) / PROFILING_RESPONSE_TIME_PRECISION,
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
	public GetHealth(): {
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
		if (!this.Config.enabled) {
			return { status: 'healthy', details: { enabled: false } };
		}

		if (!this.IsInitialized) {
			return { status: 'unhealthy', details: { initialized: false } };
		}

		return {
			status: 'healthy',
			details: {
				initialized: true,
				activeProfiles: this.ActiveProfiles.size,
				totalMetrics: this.Metrics.length,
				serverAddress: this.Config.serverAddress,
				applicationName: this.Config.applicationName,
			},
		};
	}

	/**
	 * Check if profiling is enabled and initialized.
	 *
	 * @returns true only if profiling is configured as enabled AND Pyroscope client initialization succeeded
	 */
	public IsEnabled(): boolean {
		return this.Config.enabled && this.IsInitialized;
	}

	/**
	 * Evict stale profiles that have exceeded the timeout threshold.
	 * Prevents unbounded memory growth from profiles that are started but never stopped.
	 */
	private EvictStaleProfiles(): void {
		const Now = Date.now();
		let EvictedCount = 0;

		for (const [ProfileId, ProfileContext] of this.ActiveProfiles.entries()) {
			const Age = Now - (ProfileContext.startTime ?? Now);
			if (Age > this.STALE_PROFILE_TIMEOUT_MS) {
				this.ActiveProfiles.delete(ProfileId);
				EvictedCount++;
			}
		}

		if (EvictedCount > 0) {
			this.Logger.warn(`Evicted ${EvictedCount} stale active profiles (exceeded ${this.STALE_PROFILE_TIMEOUT_MS}ms timeout)`);
		}
	}

	/**
	 * Generate unique profile ID for tracking
	 */
	private GenerateProfileId(context: IProfileContext): string {
		const UniquePart = crypto.randomUUID().replace(/-/g, '').substring(0, PROFILING_ID_UUID_LENGTH);
		return `${context.functionName}_${context.startTime}_${UniquePart}`;
	}

	/**
	 * Create empty metrics for disabled profiling
	 */
	private CreateEmptyMetrics(context: IProfileContext): IProfileMetrics {
		return {
			cpuTime: 0,
			memoryUsage: 0,
			duration: 0,
			timestamp: Date.now(),
			...(context.tags && { tags: context.tags }),
		};
	}
}
