import { Global, Module, OnModuleInit, DynamicModule } from '@nestjs/common';
import { InstrumentationRegistry } from '@pawells/nestjs-shared';
import { OpenTelemetryExporter } from './exporters/index.js';

/**
 * OpenTelemetry module for NestJS applications.
 *
 * This module integrates OpenTelemetry with NestJS by:
 * 1. Providing the OpenTelemetryExporter for metrics collection
 * 2. Registering the exporter with the InstrumentationRegistry (from nestjs-shared)
 * 3. Automatically linking HTTP metrics (via HTTPInstrumentationInterceptor)
 *    to OpenTelemetry instruments
 *
 * Note: HTTP metrics are handled globally by HTTPInstrumentationInterceptor from
 * @pawells/nestjs-shared, which records into the InstrumentationRegistry. This
 * module simply connects the exporter to the registry.
 *
 * @example
 * ```typescript
 * import { OpenTelemetryModule } from '@pawells/nestjs-open-telemetry';
 * import { CommonModule } from '@pawells/nestjs-shared';
 *
 * @Module({
 *   imports: [
 *     CommonModule,          // Provides InstrumentationRegistry
 *     OpenTelemetryModule,   // Integrates OpenTelemetry exporter
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({
	providers: [OpenTelemetryExporter],
	exports: [OpenTelemetryExporter],
})
export class OpenTelemetryModule implements OnModuleInit {
	/**
	 * Initialize the module by registering the exporter with the registry
	 * @param exporter - The OpenTelemetry exporter
	 * @param registry - The instrumentation registry (from nestjs-shared)
	 */
	constructor(
		private readonly exporter: OpenTelemetryExporter,
		private readonly registry: InstrumentationRegistry,
	) {}

	/**
	 * Called after module initialization.
	 * Registers the OpenTelemetry exporter with the instrumentation registry.
	 */
	onModuleInit(): void {
		this.registry.registerExporter(this.exporter);
	}

	/**
	 * Create a global OpenTelemetryModule for root application
	 * @returns DynamicModule configured as global
	 *
	 * @example
	 * ```typescript
	 * @Module({
	 *   imports: [OpenTelemetryModule.forRoot()],
	 * })
	 * export class AppModule {}
	 * ```
	 */
	static forRoot(): DynamicModule {
		return {
			module: OpenTelemetryModule,
			global: true,
		};
	}
}
