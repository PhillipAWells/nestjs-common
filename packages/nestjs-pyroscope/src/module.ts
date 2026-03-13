import { DynamicModule, Global, Logger, Provider } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PyroscopeService } from './service.js';
import { MetricsService } from './services/metrics.service.js';
import { ProfilingHealthIndicator } from './indicators/profiling.health.js';
import { HealthController } from './controllers/health.controller.js';
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

		const loggerProvider: Provider = {
			provide: Logger,
			useValue: new Logger(PyroscopeService.name),
		};

		const metricsServiceProvider: Provider = {
			provide: MetricsService,
			useFactory: (moduleRef: ModuleRef) => new MetricsService(moduleRef),
			inject: [ModuleRef],
		};

		const serviceProvider: Provider = {
			provide: PyroscopeService,
			useFactory: (moduleRef: ModuleRef) => new PyroscopeService(moduleRef),
			inject: [ModuleRef],
		};

		const healthIndicatorProvider: Provider = {
			provide: ProfilingHealthIndicator,
			useFactory: (moduleRef: ModuleRef) => new ProfilingHealthIndicator(moduleRef),
			inject: [ModuleRef],
		};

		const healthControllerProvider: Provider = {
			provide: HealthController,
			useFactory: (moduleRef: ModuleRef) => new HealthController(moduleRef),
			inject: [ModuleRef],
		};

		const providers: Provider[] = [
			configProvider,
			loggerProvider,
			metricsServiceProvider,
			serviceProvider,
			healthIndicatorProvider,
			...(config.enableHealthChecks !== false ? [healthControllerProvider] : []),
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

		const loggerProvider: Provider = {
			provide: Logger,
			useValue: new Logger(PyroscopeService.name),
		};

		const metricsServiceProvider: Provider = {
			provide: MetricsService,
			useFactory: (moduleRef: ModuleRef) => new MetricsService(moduleRef),
			inject: [ModuleRef],
		};

		const serviceProvider: Provider = {
			provide: PyroscopeService,
			useFactory: (moduleRef: ModuleRef) => new PyroscopeService(moduleRef),
			inject: [ModuleRef],
		};

		const healthIndicatorProvider: Provider = {
			provide: ProfilingHealthIndicator,
			useFactory: (moduleRef: ModuleRef) => new ProfilingHealthIndicator(moduleRef),
			inject: [ModuleRef],
		};

		const providers: Provider[] = [
			configProvider,
			loggerProvider,
			metricsServiceProvider,
			serviceProvider,
			healthIndicatorProvider,
		];

		const exports = [PyroscopeService, ProfilingHealthIndicator];
		const controllers = options.enableHealthChecks !== false ? [HealthController] : [];

		const dynamicModule: DynamicModule = {
			module: PyroscopeModule,
			global: options.isGlobal ?? true,
			imports: options.imports ?? [],
			controllers,
			providers,
			exports,
		};

		return dynamicModule;
	}
}
