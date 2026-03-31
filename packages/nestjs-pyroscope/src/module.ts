import { DynamicModule, Provider } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PyroscopeService } from './service.js';
import { MetricsService } from './services/metrics.service.js';
import { ProfilingHealthIndicator } from './indicators/profiling.health.js';
import { HealthController } from './controllers/health.controller.js';
import { IPyroscopeModuleAsyncOptions, IPyroscopeModuleOptions } from './interfaces/module.interface.js';
import { PYROSCOPE_CONFIG_TOKEN } from './constants.js';

/**
 * Pyroscope module for NestJS profiling integration
 * Provides PyroscopeService and profiling decorators/interceptors for continuous profiling.
 *
 * The module is global by default and provides:
 * - PyroscopeService for managing profiling sessions
 * - Built-in health check endpoints (can be disabled)
 * - Metrics aggregation and export (Prometheus format)
 * - Integration with NestJS health checks via ProfilingHealthIndicator
 *
 * @example
 * ```typescript
 * PyroscopeModule.forRoot({
 *   isGlobal: true,
 *   config: {
 *     enabled: true,
 *     serverAddress: 'http://localhost:4040',
 *     applicationName: 'my-app',
 *   },
 * })
 * ```
 */
export class PyroscopeModule {
	/**
	 * Configure Pyroscope with synchronous configuration.
	 *
	 * Use this when you have your configuration available at module initialization time.
	 *
	 * @param options Configuration options with IPyroscopeModuleOptions
	 * @returns DynamicModule configured with PyroscopeService and related providers
	 *
	 * @example
	 * ```typescript
	 * PyroscopeModule.forRoot({
	 *   isGlobal: true,
	 *   config: {
	 *     enabled: process.env.NODE_ENV === 'production',
	 *     serverAddress: 'http://localhost:4040',
	 *     applicationName: 'my-service',
	 *     tags: { version: '1.0.0' },
	 *   },
	 * })
	 * ```
	 */
	public static ForRoot(options: IPyroscopeModuleOptions): DynamicModule {
		const Config = typeof options.config === 'function' ? options.config() : options.config;

		const ConfigProvider: Provider = {
			provide: PYROSCOPE_CONFIG_TOKEN,
			useValue: Config,
		};

		const MetricsServiceProvider: Provider = {
			provide: MetricsService,
			useFactory: () => new MetricsService(),
			inject: [],
		};

		const ServiceProvider: Provider = {
			provide: PyroscopeService,
			useFactory: (moduleRef: ModuleRef) => new PyroscopeService(moduleRef),
			inject: [ModuleRef],
		};

		const HealthIndicatorProvider: Provider = {
			provide: ProfilingHealthIndicator,
			useFactory: (moduleRef: ModuleRef) => new ProfilingHealthIndicator(moduleRef),
			inject: [ModuleRef],
		};

		const Providers: Provider[] = [
			ConfigProvider,
			MetricsServiceProvider,
			ServiceProvider,
			HealthIndicatorProvider,
		];

		const Controllers = Config.enableHealthChecks !== false ? [HealthController] : [];
		const Exports = [PyroscopeService, MetricsService, ProfilingHealthIndicator];

		return {
			module: PyroscopeModule,
			global: options.isGlobal ?? true,
			controllers: Controllers,
			providers: Providers,
			exports: Exports,
		};
	}

	/**
	 * Configure Pyroscope with asynchronous configuration.
	 *
	 * Use this when your configuration depends on other providers (e.g., ConfigService)
	 * or needs to be resolved asynchronously.
	 *
	 * @param options Configuration options with useFactory and optional inject dependencies
	 * @returns DynamicModule configured with PyroscopeService and related providers
	 *
	 * @example
	 * ```typescript
	 * PyroscopeModule.forRootAsync({
	 *   isGlobal: true,
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
	public static ForRootAsync(options: IPyroscopeModuleAsyncOptions): DynamicModule {
		const ConfigProvider: Provider = {
			provide: PYROSCOPE_CONFIG_TOKEN,
			useFactory: options.useFactory,
			inject: options.inject ?? [],
		};

		const MetricsServiceProvider: Provider = {
			provide: MetricsService,
			useFactory: () => new MetricsService(),
			inject: [],
		};

		const ServiceProvider: Provider = {
			provide: PyroscopeService,
			useFactory: (moduleRef: ModuleRef) => new PyroscopeService(moduleRef),
			inject: [ModuleRef],
		};

		const HealthIndicatorProvider: Provider = {
			provide: ProfilingHealthIndicator,
			useFactory: (moduleRef: ModuleRef) => new ProfilingHealthIndicator(moduleRef),
			inject: [ModuleRef],
		};

		const Providers: Provider[] = [
			ConfigProvider,
			MetricsServiceProvider,
			ServiceProvider,
			HealthIndicatorProvider,
		];

		const Exports = [PyroscopeService, MetricsService, ProfilingHealthIndicator];
		const Controllers = options.enableHealthChecks !== false ? [HealthController] : [];

		const DynamicModule: DynamicModule = {
			module: PyroscopeModule,
			global: options.isGlobal ?? true,
			imports: options.imports ?? [],
			controllers: Controllers,
			providers: Providers,
			exports: Exports,
		};

		return DynamicModule;
	}
}
