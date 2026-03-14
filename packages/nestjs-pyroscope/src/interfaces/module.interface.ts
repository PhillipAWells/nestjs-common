import { InjectionToken, ModuleMetadata, OptionalFactoryDependency } from '@nestjs/common';
import { IPyroscopeConfig } from './profiling.interface.js';

/**
 * Synchronous module configuration options.
 *
 * Use when you have configuration available at module initialization time.
 */
export interface IPyroscopeModuleOptions {
	/**
	 * Whether this module should be global (available in all modules without explicit import).
	 * Defaults to true for convenience.
	 */
	isGlobal?: boolean;

	/**
	 * Pyroscope configuration object or factory function.
	 * If a function, will be called during module initialization.
	 */
	config: IPyroscopeConfig | (() => IPyroscopeConfig);
}

/**
 * Asynchronous module configuration options.
 *
 * Use when your configuration depends on other providers or needs to be resolved asynchronously.
 *
 * @example
 * ```typescript
 * PyroscopeModule.forRootAsync({
 *   imports: [ConfigModule],
 *   useFactory: (configService: ConfigService) => ({
 *     enabled: configService.get('PROFILING_ENABLED') === 'true',
 *     serverAddress: configService.get('PYROSCOPE_SERVER'),
 *     applicationName: configService.get('APP_NAME'),
 *   }),
 *   inject: [ConfigService],
 * })
 * ```
 */
export interface IPyroscopeModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	/**
	 * Whether this module should be global (available in all modules without explicit import).
	 * Defaults to true for convenience.
	 */
	isGlobal?: boolean;

	/**
	 * Whether to register the health check controller.
	 * Defaults to true. Set to false to disable the /profiling/health, /profiling/metrics,
	 * /profiling/status, and /profiling/metrics/prometheus endpoints.
	 */
	enableHealthChecks?: boolean;

	/**
	 * Factory function to create the configuration asynchronously.
	 * Dependencies listed in inject will be passed as arguments.
	 */
	useFactory: (...args: unknown[]) => IPyroscopeConfig;

	/**
	 * Injection tokens for dependencies to pass to useFactory.
	 */
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
}
