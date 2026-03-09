import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import type { IPyroscopeConfig, IProfileMetrics, IProfileContext } from './interfaces/profiling.interface.js';
import { PYROSCOPE_CONFIG_TOKEN } from './constants.js';
import { MetricsService } from './services/metrics.service.js';
import {
	PROFILING_DEGRADED_ACTIVE_PROFILES_THRESHOLD,
	PROFILING_RETRY_BASE_DELAY_MS,
	PROFILING_RETRY_MAX_DELAY_MS,
	PROFILING_RETRY_JITTER_MS,
	PROFILING_TAG_MAX_LENGTH
} from './constants/profiling.constants.js';

/**
 * Service for managing Pyroscope profiling integration
 * Provides methods for starting/stopping profiling, adding tags, and tracking function execution
 */
@Injectable()
export class PyroscopeService implements OnModuleInit, OnModuleDestroy {
	private pyroscopeClient: any;

	private isInitialized = false;

	private readonly activeProfiles = new Map<string, IProfileContext>();

	private readonly metrics: IProfileMetrics[] = [];

	constructor(
		@Inject(PYROSCOPE_CONFIG_TOKEN) private readonly config: IPyroscopeConfig,
		private readonly logger: Logger,
		private readonly metricsService?: MetricsService
	) {}

	/**
	 * Initialize Pyroscope client on module initialization
	 */
	public async onModuleInit(): Promise<void> {
		if (!this.config.enabled) {
			this.logger.log('Pyroscope profiling is disabled');
			return;
		}

		try {
			// Dynamic import to avoid issues if package is not installed
			const Pyroscope = await import('@pyroscope/nodejs');

			// Configure Pyroscope client
			const pyroscopeConfig: any = {
				serverAddress: this.config.serverAddress,
				appName: this.config.applicationName,
				tags: this.config.tags ?? {}
			};

			// Add optional configuration
			if (this.config.basicAuthUser && this.config.basicAuthPassword) {
				pyroscopeConfig.basicAuthUser = this.config.basicAuthUser;
				pyroscopeConfig.basicAuthPassword = this.config.basicAuthPassword;
			}

			if (this.config.sampleRate) {
				pyroscopeConfig.sampleRate = this.config.sampleRate;
			}

			if (this.config.logLevel) {
				pyroscopeConfig.logLevel = this.config.logLevel;
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
				tagMaxLength: this.config.tagMaxLength ?? PROFILING_TAG_MAX_LENGTH
			});
		}
		catch (error) {
			this.logger.error('Failed to initialize Pyroscope profiling', error);
			// Graceful degradation - continue without profiling
		}
	}

	/**
	 * Cleanup on module destruction
	 */
	public onModuleDestroy(): void {
		if (this.pyroscopeClient && this.isInitialized) {
			try {
				this.pyroscopeClient.stop();
				this.logger.log('Pyroscope profiling stopped');
			}
			catch (error) {
				this.logger.error('Error stopping Pyroscope profiling', error);
			}
		}
	}

	/**
	 * Start profiling for a given context
	 */
	public startProfiling(context: IProfileContext): void {
		if (!this.isEnabled()) return;

		// Generate and store profile ID in context for later retrieval
		const profileId = this.generateProfileId(context);
		context.profileId = profileId;

		// Set start time if not already set
		if (!context.startTime) {
			context.startTime = Date.now();
		}

		this.activeProfiles.set(profileId, context);

		// Note: Dynamic tag manipulation is not supported by @pyroscope/nodejs
		// Tags must be set during initialization. Context tags are tracked for metrics only.

		this.logger.debug(`Started profiling: ${context.functionName}`, context.tags);
	}

	/**
	 * Stop profiling and return metrics
	 */
	public stopProfiling(context: IProfileContext): IProfileMetrics {
		if (!this.isEnabled()) {
			return this.createEmptyMetrics(context);
		}

		// Use stored profile ID from context, or generate if not available
		const profileId = context.profileId ?? this.generateProfileId(context);
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
			tags: { ...startContext.tags, ...context.tags }
		};

		this.metrics.push(metrics);

		this.logger.debug(`Stopped profiling: ${context.functionName} (${context.duration}ms)`, context.tags);

		return metrics;
	}

	/**
	 * Add static tags to all profiling data
	 * Note: Dynamic tag manipulation is not supported by @pyroscope/nodejs v0.2.x
	 * Tags must be set during initialization via config.tags
	 */
	public addTags(tags: Record<string, string>): void {
		if (!this.isEnabled() || !this.pyroscopeClient) return;

		this.logger.debug('Dynamic tag addition is not supported by @pyroscope/nodejs. Tags must be set during initialization.', tags);
	}

	/**
	 * Remove tags from profiling data
	 * Note: Dynamic tag manipulation is not supported by @pyroscope/nodejs v0.2.x
	 */
	public removeTags(keys: string[]): void {
		if (!this.isEnabled() || !this.pyroscopeClient) return;

		this.logger.debug('Dynamic tag removal is not supported by @pyroscope/nodejs. Tags must be set during initialization.', keys);
	}

	/**
	 * Track function execution with profiling
	 */
	public async trackFunction<T>(
		name: string,
		fn: () => T | Promise<T>,
		tags?: Record<string, string>
	): Promise<T> {
		const context: IProfileContext = {
			functionName: name,
			startTime: Date.now(),
			...(tags && { tags })
		};

		this.startProfiling(context);

		try {
			const result = await fn();
			this.stopProfiling(context);
			return result;
		}
		catch (error) {
			context.error = error as Error;
			this.stopProfiling(context);
			throw error;
		}
	}

	/**
	 * Get collected metrics
	 */
	/**
	 * Get collected profile metrics
	 */
	public getProfileMetrics(): IProfileMetrics[] {
		return [...this.metrics];
	}

	/**
	 * Get aggregated metrics summary
	 * @returns MetricsResponse with aggregated profiling data
	 */
	public getMetrics(): { timestamp: number; cpu: any; memory: any; requests: any } {
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
				duration: totalCpuTime
			},
			memory: {
				samples: totalMetrics,
				allocations: totalMemory
			},
			requests: {
				total: totalMetrics,
				successful: totalMetrics, // Assume all are successful for now
				failed: 0,
				averageResponseTime: Math.round(averageDuration * 100) / 100
			}
		};
	}

	/**
	 * Get health status of profiling service
	 */
	public getHealth(): { status: 'healthy' | 'unhealthy'; details: any } {
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
				applicationName: this.config.applicationName
			}
		};
	}

	/**
	 * Check if profiling is enabled and initialized
	 */
	public isEnabled(): boolean {
		return this.config.enabled && this.isInitialized;
	}

	/**
	 * Generate unique profile ID for tracking
	 */
	private generateProfileId(context: IProfileContext): string {
		return `${context.functionName}_${context.startTime}_${Math.random().toString(36).substr(2, 9)}`;
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
			...(context.tags && { tags: context.tags })
		};
	}
}
