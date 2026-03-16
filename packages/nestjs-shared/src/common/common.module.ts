import { Module, Logger, Global, OnModuleInit } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE, ModuleRef } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter.js';
import { GlobalExceptionFilter } from './filters/global-exception.filter.js';
import { LoggingInterceptor } from './interceptors/logging.interceptor.js';
import { HTTPMetricsInterceptor } from './interceptors/http-metrics.interceptor.js';
import { ValidationPipe } from './pipes/validation.pipe.js';
import { AppLogger } from './services/logger.service.js';
import { ErrorSanitizerService } from './services/error-sanitizer.service.js';
import { AuditLoggerService } from './services/audit-logger.service.js';
import { CSRFService } from './services/csrf.service.js';
import { CSRFGuard } from './guards/csrf.guard.js';
import { ErrorCategorizerService } from './services/error-categorizer.service.js';
import { HttpClientService } from './services/http-client.service.js';
import { MetricsRegistryService } from './services/metrics-registry.service.js';
import { HealthCheckService } from './services/health-check.service.js';
import { SetRequestPropertyDecoratorLogger } from './decorators/request-property.decorator.js';
import { ConfigService } from '../config/index.js';
import { InstrumentationRegistry } from './registry/instrumentation-registry.js';

/**
 * Common Module.
 * Global module providing foundational infrastructure for NestJS applications:
 * - Filters: GlobalExceptionFilter, HttpExceptionFilter
 * - Interceptors: LoggingInterceptor, HTTPMetricsInterceptor
 * - Pipes: ValidationPipe
 * - Services: AppLogger, AuditLoggerService, CSRFService, ErrorCategorizerService, ErrorSanitizerService, HttpClientService, MetricsRegistryService, HealthCheckService
 *
 * @important ConfigModule MUST be imported before CommonModule in your application.
 * Failure to do so will cause initialization errors at startup.
 *
 * @remarks
 * - Automatically registers global filters, interceptors, and pipes
 * - Exports all services for use in feature modules
 * - Initializes AppLogger and RequestProperty decorator at module init
 * - Validates ConfigService availability to catch import order issues
 * - Global flag ensures exports are available application-wide without explicit imports
 *
 * @example
 * ```typescript
 * // Correct import order
 * @Module({
 *   imports: [
 *     ConfigModule.forRoot({}),    // MUST come first
 *     CommonModule,                // Depends on ConfigModule
 *     // ... feature modules
 *   ]
 * })
 * export class AppModule {}
 * ```
 */

@Global()
@Module({
	// Note: PyroscopeModule is imported by TracingModule - do not duplicate here
	providers: [
		{
			provide: APP_FILTER,
			useClass: HttpExceptionFilter,
		},
		{
			provide: APP_FILTER,
			useClass: GlobalExceptionFilter,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: LoggingInterceptor,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: HTTPMetricsInterceptor,
		},
		{
			provide: APP_PIPE,
			useClass: ValidationPipe,
		},
		// Also exported below as standalone classes for direct injection in feature modules
		GlobalExceptionFilter,
		HttpExceptionFilter,
		LoggingInterceptor,
		HTTPMetricsInterceptor,
		ValidationPipe,
		AppLogger,
		ErrorSanitizerService,
		AuditLoggerService,
		CSRFService,
		CSRFGuard,
		ErrorCategorizerService,
		HttpClientService,
		MetricsRegistryService,
		HealthCheckService,
		InstrumentationRegistry,
		Logger,
	],
	exports: [
		GlobalExceptionFilter,
		HttpExceptionFilter,
		LoggingInterceptor,
		HTTPMetricsInterceptor,
		ValidationPipe,
		AppLogger,
		ErrorSanitizerService,
		AuditLoggerService,
		CSRFService,
		CSRFGuard,
		ErrorCategorizerService,
		HttpClientService,
		MetricsRegistryService,
		HealthCheckService,
		InstrumentationRegistry,
	],
})
export class CommonModule implements OnModuleInit {
	private initialized = false;

	constructor(
		private readonly appLogger: AppLogger,
		private readonly moduleRef: ModuleRef,
	) {}

	public onModuleInit(): void {
		if (this.initialized) {
			return;
		}
		this.initialized = true;

		// Initialize the RequestProperty decorator with the AppLogger instance
		// This ensures structured logging is available before any route handlers are processed
		SetRequestPropertyDecoratorLogger(this.appLogger);

		// Verify ConfigService is available to help developers catch import order issues early
		this.verifyConfigServiceAvailable();
	}

	/**
	 * Verify that ConfigService from the config module is registered in the application.
	 * This helps catch import order issues where CommonModule is imported before ConfigModule.
	 */
	private verifyConfigServiceAvailable(): void {
		try {
			const configService = this.moduleRef.get(ConfigService, { strict: false });
			if (!configService) {
				throw new Error('ConfigService is null or undefined');
			}
		} catch (error) {
			const errorMessage = `
Failed to initialize CommonModule: ConfigService is not registered in the module hierarchy.

CommonModule requires ConfigModule to be imported first in your application.
Ensure your AppModule imports ConfigModule before CommonModule:

  @Module({
    imports: [ConfigModule, CommonModule],
  })
  export class AppModule {}

Importing in the wrong order will cause services to fail during initialization.
Error details: ${error instanceof Error ? error.message : String(error)}
			`.trim();

			throw new Error(errorMessage, { cause: error });
		}
	}
}
