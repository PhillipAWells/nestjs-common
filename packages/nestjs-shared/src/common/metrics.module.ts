import { Module, Global, DynamicModule } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common/interfaces';
import { MetricsRegistryService } from './services/metrics-registry.service.js';
import { HTTPMetricsInterceptor } from './interceptors/http-metrics.interceptor.js';
import { MetricsController } from './controllers/metrics.controller.js';

/**
 * Async options for MetricsModule.
 * Configuration options for asynchronous MetricsModule initialization.
 */
export interface MetricsModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	/** Optional modules to import for async configuration */
}

/**
 * Metrics Module.
 * Provides comprehensive Prometheus metrics collection and exposure for NestJS applications.
 *
 * Features:
 * - HTTP request metrics (duration, count, size) with automatic cardinality prevention
 * - Custom metric creation (counter, gauge, histogram)
 * - Default Node.js metrics collection
 * - Prometheus endpoint at /metrics
 * - Metrics registry management
 *
 * @remarks
 * - Imported as global module in CommonModule
 * - Controlled by METRICS_ENABLED environment variable (default: true)
 * - Automatically normalizes dynamic path segments to prevent unbounded label cardinality
 * - MetricsController exports metrics at GET /metrics in Prometheus format
 *
 * @example
 * ```typescript
 * // Access metrics in any injectable
 * constructor(private metrics: MetricsRegistryService) {}
 *
 * // Create and record custom metrics
 * const counter = this.metrics.createCounter('orders_total', 'Total orders');
 * counter.inc({ status: 'completed' });
 *
 * // Get metrics (typically called by MetricsController)
 * const prometheusText = await this.metrics.getMetrics();
 * ```
 */

@Global()
@Module({
	controllers: [MetricsController],
	providers: [
		MetricsRegistryService,
		HTTPMetricsInterceptor,
	],
	exports: [
		MetricsRegistryService,
		HTTPMetricsInterceptor,
	],
})
export class MetricsModule {
	/**
	 * Configure metrics module for root application
	 * Enables HTTP metrics collection and /metrics endpoint
	 */
	public static forRoot(): DynamicModule {
		return {
			module: MetricsModule,
		};
	}

	/**
	 * Configure metrics module with async options
	 */
	public static forRootAsync(options: MetricsModuleAsyncOptions): DynamicModule {
		return {
			module: MetricsModule,
			imports: options.imports,
		};
	}
}
