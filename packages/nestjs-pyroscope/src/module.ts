import { DynamicModule, Global, Provider, Logger } from '@nestjs/common';
import { PyroscopeService } from './service.js';
import { MetricsService } from './services/metrics.service.js';
import { ProfilingHealthIndicator } from './indicators/profiling.health.js';
import { HealthController } from './controllers/health.controller.js';
import { IPyroscopeConfig } from './interfaces/profiling.interface.js';
import { IPyroscopeModuleAsyncOptions, IPyroscopeModuleOptions } from './interfaces/module.interface.js';
import { PYROSCOPE_CONFIG_TOKEN } from './constants.js';

/**
 * Pyroscope module for NestJS profiling integration
 * Provides PyroscopeService and profiling decorators/interceptors
 */
@Global()
export class PyroscopeModule {
	/**
	 * Configure Pyroscope with synchronous configuration
	 */
	public static forRoot(options: IPyroscopeModuleOptions): DynamicModule {
		const config = typeof options.config === 'function' ? options.config() : options.config;

		const configProvider: Provider = {
			provide: PYROSCOPE_CONFIG_TOKEN,
			useValue: config,
		};

		const metricsServiceProvider: Provider = {
			provide: MetricsService,
			useClass: MetricsService,
		};

		const serviceProvider: Provider = {
			provide: PyroscopeService,
			useFactory: (config: IPyroscopeConfig, metricsService: MetricsService) => {
				const logger = new Logger(PyroscopeService.name);
				return new PyroscopeService(config, logger, metricsService);
			},
			inject: [PYROSCOPE_CONFIG_TOKEN, MetricsService],
		};

		const healthIndicatorProvider: Provider = {
			provide: ProfilingHealthIndicator,
			useClass: ProfilingHealthIndicator,
		};

		const providers: Provider[] = [
			configProvider,
			metricsServiceProvider,
			serviceProvider,
			healthIndicatorProvider,
		];

		const controllers = config.enableHealthChecks !== false ? [HealthController] : [];
		const exports = [PyroscopeService, ProfilingHealthIndicator];

		return {
			module: PyroscopeModule,
			global: options.isGlobal ?? true,
			controllers,
			providers,
			exports,
		};
	}

	/**
	 * Configure Pyroscope with asynchronous configuration
	 */
	public static forRootAsync(options: IPyroscopeModuleAsyncOptions): DynamicModule {
		const configProvider: Provider = {
			provide: PYROSCOPE_CONFIG_TOKEN,
			useFactory: options.useFactory,
			inject: options.inject ?? [],
		};

		const metricsServiceProvider: Provider = {
			provide: MetricsService,
			useClass: MetricsService,
		};

		const serviceProvider: Provider = {
			provide: PyroscopeService,
			useFactory: (config: IPyroscopeConfig, metricsService: MetricsService) => {
				const logger = new Logger(PyroscopeService.name);
				return new PyroscopeService(config, logger, metricsService);
			},
			inject: [PYROSCOPE_CONFIG_TOKEN, MetricsService],
		};

		const healthIndicatorProvider: Provider = {
			provide: ProfilingHealthIndicator,
			useClass: ProfilingHealthIndicator,
		};

		const providers: Provider[] = [
			configProvider,
			metricsServiceProvider,
			serviceProvider,
			healthIndicatorProvider,
		];

		// Note: For async config, we can't conditionally enable controllers
		// Health checks will be enabled by default, can be disabled via config
		const controllers = [HealthController];
		const exports = [PyroscopeService, ProfilingHealthIndicator];

		return {
			module: PyroscopeModule,
			global: options.isGlobal ?? true,
			imports: options.imports ?? [],
			controllers,
			providers,
			exports,
		};
	}
}
