import { Global, Module, OnModuleInit, OnApplicationShutdown, type DynamicModule } from '@nestjs/common';
import { InstrumentationRegistry } from '@pawells/nestjs-shared';
import { PrometheusExporter } from './prometheus.exporter.js';
import { MetricsController } from './controllers/metrics.controller.js';

/**
 * Prometheus metrics module for NestJS
 *
 * Provides integration with @pawells/nestjs-shared InstrumentationRegistry
 * to export metrics in Prometheus format via a `/metrics` HTTP endpoint.
 *
 * Features:
 * - Event-based metric collection: buffers metric values and flushes on pull
 * - Automatic HTTP endpoint: exposes GET /metrics with Prometheus text format
 * - Node.js default metrics: process CPU, memory, event loop, garbage collection
 * - MetricsGuard integration: optional METRICS_API_KEY authentication
 * - Lifecycle management: registers exporter on init, cleans up on shutdown
 *
 * Registers PrometheusExporter globally and automatically connects it to the
 * InstrumentationRegistry so that metric descriptors and values are forwarded
 * to the Prometheus exporter.
 *
 * @example
 * ```typescript
 * import { PrometheusModule } from '@pawells/nestjs-prometheus';
 *
 * @Module({
 *   imports: [
 *     ConfigModule,
 *     CommonModule,
 *     PrometheusModule.forRoot(),  // Register module globally
 *   ],
 * })
 * export class AppModule {}
 *
 * // Metrics are now available at: GET /metrics
 * ```
 */
@Global()
@Module({
	providers: [PrometheusExporter],
	exports: [PrometheusExporter],
	controllers: [MetricsController],
})
export class PrometheusModule implements OnModuleInit, OnApplicationShutdown {
	private readonly Exporter: PrometheusExporter;
	private readonly Registry: InstrumentationRegistry;

	/**
	 * Create a global PrometheusModule with automatic registration
	 *
	 * Returns a DynamicModule that marks this module as global, enabling
	 * it to be imported once at the top level and used throughout the application.
	 *
	 * @returns DynamicModule configured as global
	 *
	 * @example
	 * ```typescript
	 * @Module({
	 *   imports: [PrometheusModule.forRoot()],
	 * })
	 * export class AppModule {}
	 * ```
	 */
	public static forRoot(): DynamicModule {
		return {
			module: PrometheusModule,
		};
	}

	constructor(
		exporter: PrometheusExporter,
		registry: InstrumentationRegistry,
	) {
		this.Exporter = exporter;
		this.Registry = registry;
	}

	/**
	 * Initialize the module and register the Prometheus exporter
	 *
	 * Called by NestJS during module initialization. Registers the PrometheusExporter
	 * with the InstrumentationRegistry so that it receives descriptor registration
	 * events and metric values.
	 *
	 * @example
	 * ```typescript
	 * // During application startup:
	 * // 1. PrometheusModule is initialized
	 * // 2. onModuleInit() registers PrometheusExporter with InstrumentationRegistry
	 * // 3. All metrics registered with registry are now tracked by Prometheus exporter
	 * ```
	 */
	public onModuleInit(): void {
		this.Registry.registerExporter(this.Exporter);
	}

	/**
	 * Clean up resources on application shutdown
	 *
	 * Called by NestJS during application shutdown. Calls the PrometheusExporter's
	 * shutdown method to clean up the registry and release resources.
	 *
	 * @example
	 * ```typescript
	 * // During application shutdown:
	 * // onApplicationShutdown() is called
	 * // PrometheusExporter clears registry and internal state
	 * ```
	 */
	public async onApplicationShutdown(): Promise<void> {
		await this.Exporter.shutdown();
	}
}
