/**
 * Main configuration interface for Pyroscope profiling.
 *
 * Uses plain TypeScript interfaces (not Joi validation) to configure the Pyroscope client
 * and profiling behavior.
 *
 * @example
 * ```typescript
 * const config: IPyroscopeConfig = {
 *   enabled: true,
 *   serverAddress: 'http://localhost:4040',
 *   applicationName: 'my-service',
 *   environment: 'production',
 *   version: '1.0.0',
 *   tags: { region: 'us-east-1' },
 *   basicAuthUser: process.env.PYROSCOPE_USER,
 *   basicAuthPassword: process.env.PYROSCOPE_PASSWORD,
 * };
 * ```
 */
export interface IPyroscopeConfig {
	enabled: boolean;
	serverAddress: string;
	applicationName: string;
	environment?: string;
	version?: string;
	sampleRate?: number;
	profileTypes?: TProfileType[];
	tags?: Record<string, string>;
	basicAuthUser?: string;
	basicAuthPassword?: string;
	tlsEnabled?: boolean;
	tlsCertPath?: string;
	tlsKeyPath?: string;
	tlsCaPath?: string;
	tlsInsecureSkipVerify?: boolean;
	logLevel?: 'debug' | 'info' | 'warn' | 'error';
	enableHealthChecks?: boolean;
	degradedActiveProfilesThreshold?: number;
	retryBaseDelayMs?: number;
	retryMaxDelayMs?: number;
	retryJitterMs?: number;
	tagMaxLength?: number;
}

/**
 * Type of profiling to collect.
 *
 * - 'cpu': CPU time profiling
 * - 'memory': Memory allocation profiling
 * - 'goroutine': Goroutine profiling (Go compatibility)
 * - 'mutex': Mutex contention profiling (Go compatibility)
 * - 'block': Block contention profiling (Go compatibility)
 */
export type TProfileType = 'cpu' | 'memory' | 'goroutine' | 'mutex' | 'block';

/**
 * Profiling metrics collected for a single operation.
 *
 * Contains timing and resource usage information from a profiling session.
 */
export interface IProfileMetrics {
	cpuTime: number;
	memoryUsage: number;
	duration: number;
	timestamp: number;
	tags?: Record<string, string>;
}

/**
 * Profiling context for a single operation.
 *
 * Represents the lifecycle of a profiling session, from start to stop.
 * Used internally by PyroscopeService and decorators/interceptors.
 */
export interface IProfileContext {
	profileId?: string;
	functionName: string;
	className?: string;
	methodName?: string;
	startTime: number;
	endTime?: number;
	duration?: number;
	error?: Error;
	tags?: Record<string, string>;
}
