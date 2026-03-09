import { Module, Global, DynamicModule } from '@nestjs/common';
import { MetricsRegistryService } from './services/metrics-registry.service.js';
import { HTTPMetricsInterceptor } from './interceptors/http-metrics.interceptor.js';
import { MetricsController } from './controllers/metrics.controller.js';

/**
 * Metrics Module
 *
 * Provides comprehensive metrics collection and exposure for NestJS applications.
 * Includes HTTP request metrics, custom metrics support, and Prometheus endpoint.
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
			global: true,
		};
	}

	/**
	 * Configure metrics module with async options
	 */
	public static forRootAsync(options: any): DynamicModule {
		return {
			module: MetricsModule,
			global: true,
			...options,
		};
	}
}
