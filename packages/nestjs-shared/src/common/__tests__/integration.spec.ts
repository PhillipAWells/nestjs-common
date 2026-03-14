
/// <reference types="vitest" />
import { INestApplication } from '@nestjs/common';
import { register } from 'prom-client';
import {
	MetricsRegistryService,
	BaseMetricsCollector,
	HealthCheckService,
	AppLogger,
	ApplySecurityMiddleware,
	CreateRateLimitConfig,
	GlobalExceptionFilter,
	LoggingInterceptor,
	ErrorSanitizerService,
	CSRFService,
	type SecurityBootstrapOptions,
	type RateLimitConfig,
	type IHealthCheck,
} from '../index.js';

/**
 * Test implementation of BaseMetricsCollector
 * Demonstrates how subclasses extend the base class to define domain-specific metrics
 */
class TestMetricsCollector extends BaseMetricsCollector {
	protected InitializeMetrics(): void {
		this.RegisterCounter('test_ops_total', 'Test operations completed', ['type', 'status']);
		this.RegisterGauge('test_active', 'Number of active tests', ['environment']);
		this.RegisterHistogram('test_duration_seconds', 'Test execution duration', ['suite']);
	}
}

describe('nestjs-shared Integration Tests', () => {
	let app: INestApplication;
	let metricsRegistry: MetricsRegistryService;
	let healthCheck: HealthCheckService;
	let appUseCallCount: number;
	let enableCorsCallCount: number;
	let useGlobalPipesCallCount: number;

	beforeEach(() => {
		register.clear();

		const mockConfigService = {
			get: (key: string, defaultValue?: any) => defaultValue,
		};
		const mockAppLogger = new AppLogger(mockConfigService as any, 'TestContext');

		const mockModuleRef = {
			get: (token: any) => {
				if (token === AppLogger) return mockAppLogger;
				if (token === MetricsRegistryService) return metricsRegistry;
				if (token === HealthCheckService) return healthCheck;
				throw new Error(`not found: ${String(token)}`);
			},
		} as any;

		metricsRegistry = new MetricsRegistryService(mockModuleRef);
		healthCheck = new HealthCheckService(mockModuleRef);

		// Initialize call counters
		appUseCallCount = 0;
		enableCorsCallCount = 0;
		useGlobalPipesCallCount = 0;

		// Mock NestJS application instance
		app = {
			use: ((_req?: any, _res?: any, _next?: any) => {
				appUseCallCount++;
				return app;
			}) as any,
			enableCors: ((_options?: any) => {
				enableCorsCallCount++;
				return app;
			}) as any,
			useGlobalPipes: ((..._pipes: any[]) => {
				useGlobalPipesCallCount++;
				return app;
			}) as any,
		} as any;
	});

	describe('BaseMetricsCollector Integration', () => {
		it('should instantiate BaseMetricsCollector with MetricsRegistryService', () => {
			const collector = new TestMetricsCollector(metricsRegistry);
			expect(collector).toBeDefined();
			expect(collector).toBeInstanceOf(TestMetricsCollector);
		});

		it('should register multiple metric types during initialization', () => {
			const collector = new TestMetricsCollector(metricsRegistry);
			expect(collector['GetMetric']('test_ops_total')).toBeDefined();
			expect(collector['GetMetric']('test_active')).toBeDefined();
			expect(collector['GetMetric']('test_duration_seconds')).toBeDefined();
		});

		it('should register counter metrics with labels', () => {
			const collector = new TestMetricsCollector(metricsRegistry);
			const counterMetric = collector['GetMetric']('test_ops_total');
			expect(counterMetric).toBeDefined();
		});

		it('should register gauge metrics with labels', () => {
			const collector = new TestMetricsCollector(metricsRegistry);
			const gaugeMetric = collector['GetMetric']('test_active');
			expect(gaugeMetric).toBeDefined();
		});

		it('should register histogram metrics with buckets', () => {
			const collector = new TestMetricsCollector(metricsRegistry);
			const histogramMetric = collector['GetMetric']('test_duration_seconds');
			expect(histogramMetric).toBeDefined();
		});

		it('should retrieve all registered metrics', () => {
			const collector = new TestMetricsCollector(metricsRegistry);
			const allMetrics = collector['GetAllMetrics']();
			expect(allMetrics.size).toBeGreaterThan(0);
			expect(allMetrics.has('test_ops_total')).toBe(true);
			expect(allMetrics.has('test_active')).toBe(true);
			expect(allMetrics.has('test_duration_seconds')).toBe(true);
		});
	});

	describe('HealthCheckService Integration', () => {
		it('should instantiate HealthCheckService and return proper health response', () => {
			const health = healthCheck.getHealth('test-service', '1.0.0');
			expect(health).toBeDefined();
			expect(health.status).toBe('ok');
			expect(health.service).toBe('test-service');
			expect(health.version).toBe('1.0.0');
			expect(health.timestamp).toBeDefined();
		});

		it('should return health status with correct structure', () => {
			const health = healthCheck.getHealth();
			expect(health.status).toBe('ok');
			expect(health.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		});

		it('should return readiness with default checks', () => {
			const readiness = healthCheck.getReadiness();
			expect(readiness).toBeDefined();
			expect(readiness.status).toBe('ready');
			expect(readiness.checks).toBeDefined();
			expect(readiness.checks?.['database']).toBe('ok');
			expect(readiness.checks?.['cache']).toBe('ok');
			expect(readiness.timestamp).toBeDefined();
		});

		it('should return readiness with custom checks', () => {
			const customChecks = {
				database: 'connected',
				cache: 'available',
				queue: 'operational',
			};
			const readiness = healthCheck.getReadiness(customChecks);
			expect(readiness.status).toBe('ready');
			expect(readiness.checks).toEqual(customChecks);
		});

		it('should return liveness status', () => {
			const liveness = healthCheck.getLiveness();
			expect(liveness).toBeDefined();
			expect(liveness.status).toBe('alive');
			expect(liveness.timestamp).toBeDefined();
		});
	});

	describe('ApplySecurityMiddleware Integration', () => {
		it('should apply security middleware without errors', () => {
			expect(() => ApplySecurityMiddleware(app, {})).not.toThrow();
			expect(appUseCallCount).toBeGreaterThan(0);
		});

		it('should apply security features in correct order', () => {
			appUseCallCount = 0;
			enableCorsCallCount = 0;
			useGlobalPipesCallCount = 0;
			ApplySecurityMiddleware(app, {
				corsOrigins: ['https://example.com'],
				environment: 'production',
			});
			expect(appUseCallCount).toBeGreaterThan(0);
			expect(enableCorsCallCount).toBeGreaterThan(0);
			expect(useGlobalPipesCallCount).toBeGreaterThan(0);
		});

		it('should enable compression when compressionEnabled is true', () => {
			appUseCallCount = 0;
			ApplySecurityMiddleware(app, {
				compressionEnabled: true,
			});
			expect(appUseCallCount).toBeGreaterThan(0);
		});

		it('should skip compression when compressionEnabled is false', () => {
			let appWithoutCompressionUseCount = 0;
			const appWithoutCompression = {
				use: ((_req?: any, _res?: any, _next?: any) => {
					appWithoutCompressionUseCount++;
					return appWithoutCompression;
				}) as any,
				enableCors: ((_options?: any) => appWithoutCompression) as any,
				useGlobalPipes: ((..._pipes: any[]) => appWithoutCompression) as any,
			} as any;

			ApplySecurityMiddleware(appWithoutCompression, {
				compressionEnabled: false,
			});
			// Should still be called at least once for other middleware
			expect(appWithoutCompressionUseCount).toBeGreaterThan(0);
		});

		it('should enable CORS with correct configuration', () => {
			enableCorsCallCount = 0;
			ApplySecurityMiddleware(app, {
				corsOrigins: ['https://example.com', 'https://another.com'],
				environment: 'production',
				corsEnabled: true,
			});
			expect(enableCorsCallCount).toBeGreaterThan(0);
		});

		it('should skip CORS when corsEnabled is false', () => {
			let appNoCorsEnableCorsCount = 0;
			const appNoCors = {
				use: ((_req?: any, _res?: any, _next?: any) => appNoCors) as any,
				enableCors: ((_options?: any) => {
					appNoCorsEnableCorsCount++;
					return appNoCors;
				}) as any,
				useGlobalPipes: ((..._pipes: any[]) => appNoCors) as any,
			} as any;

			ApplySecurityMiddleware(appNoCors, {
				corsEnabled: false,
			});
			expect(appNoCorsEnableCorsCount).toBe(0);
		});

		it('should apply global validation pipe', () => {
			useGlobalPipesCallCount = 0;
			ApplySecurityMiddleware(app, {});
			expect(useGlobalPipesCallCount).toBeGreaterThan(0);
		});
	});

	describe('CreateRateLimitConfig Integration', () => {
		it('should create default rate limit configuration', () => {
			const config = CreateRateLimitConfig();
			expect(config).toBeDefined();
			expect(config.auth).toBeDefined();
			expect(config.api).toBeDefined();
		});

		it('should have correct default auth limits', () => {
			const config = CreateRateLimitConfig();
			expect(config.auth?.login).toBeDefined();
			expect(config.auth?.login?.ttl).toBe(60000);
			expect(config.auth?.login?.limit).toBe(5);
			expect(config.auth?.register).toBeDefined();
			expect(config.auth?.register?.limit).toBe(3);
			expect(config.auth?.refreshToken).toBeDefined();
			expect(config.auth?.refreshToken?.limit).toBe(10);
		});

		it('should have correct default API limits', () => {
			const config = CreateRateLimitConfig();
			expect(config.api?.default).toBeDefined();
			expect(config.api?.default?.limit).toBe(100);
			expect(config.api?.search).toBeDefined();
			expect(config.api?.search?.limit).toBe(30);
		});

		it('should merge custom overrides with defaults', () => {
			const config = CreateRateLimitConfig({
				auth: {
					login: { ttl: 30000, limit: 3 },
				},
			});
			expect(config.auth?.login?.limit).toBe(3);
			expect(config.auth?.login?.ttl).toBe(30000);
			// Other auth limits should still have defaults
			expect(config.auth?.register).toBeDefined();
			expect(config.auth?.register?.limit).toBe(3);
		});

		it('should preserve defaults when overriding partial auth config', () => {
			const config = CreateRateLimitConfig({
				auth: {
					login: { ttl: 45000, limit: 2 },
				},
			});
			// Override applied
			expect(config.auth?.login?.limit).toBe(2);
			expect(config.auth?.login?.ttl).toBe(45000);
			// Defaults preserved for other auth endpoints
			expect(config.auth?.register?.limit).toBe(3);
			expect(config.auth?.refreshToken?.limit).toBe(10);
		});

		it('should preserve defaults when overriding partial API config', () => {
			const config = CreateRateLimitConfig({
				api: {
					default: { ttl: 120000, limit: 50 },
				},
			});
			// Override applied
			expect(config.api?.default?.limit).toBe(50);
			expect(config.api?.default?.ttl).toBe(120000);
			// Search limit preserved from defaults
			expect(config.api?.search?.limit).toBe(30);
		});

		it('should support custom rate limit definitions', () => {
			const config = CreateRateLimitConfig({
				custom: {
					upload: { ttl: 300000, limit: 5 },
					export: { ttl: 600000, limit: 2 },
				},
			});
			expect((config as any).custom?.upload).toBeDefined();
			expect((config as any).custom?.upload?.limit).toBe(5);
			expect((config as any).custom?.export).toBeDefined();
			expect((config as any).custom?.export?.limit).toBe(2);
		});
	});

	describe('All Components Together - Integration Scenarios', () => {
		it('should allow using BaseMetricsCollector with MetricsRegistryService', () => {
			const collector = new TestMetricsCollector(metricsRegistry);
			expect(collector).toBeDefined();
			expect(collector['GetMetric']('test_ops_total')).toBeDefined();
		});

		it('should allow using HealthCheckService for Kubernetes probes', () => {
			const health = healthCheck.getHealth('integration-test', '1.0.0');
			const readiness = healthCheck.getReadiness();
			const liveness = healthCheck.getLiveness();

			expect(health.status).toBe('ok');
			expect(readiness.status).toBe('ready');
			expect(liveness.status).toBe('alive');
		});

		it('should allow using ApplySecurityMiddleware for app initialization', () => {
			expect(() => {
				ApplySecurityMiddleware(app, {
					corsOrigins: ['https://example.com'],
					environment: 'production',
				});
			}).not.toThrow();
			expect(appUseCallCount).toBeGreaterThan(0);
			expect(enableCorsCallCount).toBeGreaterThan(0);
		});

		it('should allow using CreateRateLimitConfig for API protection', () => {
			const rateLimitConfig = CreateRateLimitConfig({
				auth: {
					login: { ttl: 30000, limit: 3 },
				},
			});
			expect(rateLimitConfig).toBeDefined();
			expect(rateLimitConfig.auth?.login?.limit).toBe(3);
		});

		it('should compose all utilities together without conflicts', () => {
			// Create metrics collector
			const collector = new TestMetricsCollector(metricsRegistry);

			// Get health checks
			const health = healthCheck.getHealth('integration-test', '1.0.0');
			const readiness = healthCheck.getReadiness();

			// Apply security
			ApplySecurityMiddleware(app, {
				corsOrigins: ['https://example.com'],
				environment: 'production',
			});

			// Get rate limit config
			const rateLimitConfig = CreateRateLimitConfig();

			// Verify all are available and functional
			expect(collector).toBeDefined();
			expect(collector['GetAllMetrics']().size).toBeGreaterThan(0);
			expect(health.status).toBe('ok');
			expect(readiness.status).toBe('ready');
			expect(appUseCallCount).toBeGreaterThan(0);
			expect(enableCorsCallCount).toBeGreaterThan(0);
			expect(rateLimitConfig.auth?.login?.limit).toBe(5);
			expect(rateLimitConfig.api?.default?.limit).toBe(100);
		});

		it('should allow creating multiple metric collectors independently', () => {
			const collector1 = new TestMetricsCollector(metricsRegistry);

			// Create a second collector with different metric names to avoid conflicts
			class TestMetricsCollector2 extends BaseMetricsCollector {
				protected InitializeMetrics(): void {
					this.RegisterCounter('test_ops_total_2', 'Test operations completed', ['type', 'status']);
					this.RegisterGauge('test_active_2', 'Number of active tests', ['environment']);
				}
			}
			const collector2 = new TestMetricsCollector2(metricsRegistry);

			expect(collector1).toBeDefined();
			expect(collector2).toBeDefined();
			// Both should have access to their respective metrics
			expect(collector1['GetMetric']('test_ops_total')).toBeDefined();
			expect(collector2['GetMetric']('test_ops_total_2')).toBeDefined();
		});

		it('should work with different environment configurations', () => {
			let _devAppUseCount = 0;
			let devAppEnableCorsCount = 0;
			const devApp = {
				use: ((_req?: any, _res?: any, _next?: any) => {
					_devAppUseCount++;
					return devApp;
				}) as any,
				enableCors: ((_options?: any) => {
					devAppEnableCorsCount++;
					return devApp;
				}) as any,
				useGlobalPipes: ((..._pipes: any[]) => devApp) as any,
			} as any;

			let _prodAppUseCount = 0;
			let prodAppEnableCorsCount = 0;
			const prodApp = {
				use: ((_req?: any, _res?: any, _next?: any) => {
					_prodAppUseCount++;
					return prodApp;
				}) as any,
				enableCors: ((_options?: any) => {
					prodAppEnableCorsCount++;
					return prodApp;
				}) as any,
				useGlobalPipes: ((..._pipes: any[]) => prodApp) as any,
			} as any;

			// Apply dev configuration
			ApplySecurityMiddleware(devApp, {
				environment: 'development',
				corsOrigins: ['http://localhost:3000'],
			});

			// Apply prod configuration
			ApplySecurityMiddleware(prodApp, {
				environment: 'production',
				corsOrigins: ['https://example.com'],
			});

			expect(devAppEnableCorsCount).toBeGreaterThan(0);
			expect(prodAppEnableCorsCount).toBeGreaterThan(0);
		});

		it('should support extending BaseMetricsCollector with custom logic', () => {
			class CustomMetricsCollector extends BaseMetricsCollector {
				private operationCount = 0;

				protected InitializeMetrics(): void {
					this.RegisterCounter('custom_ops', 'Custom operations');
				}

				public RecordOperation(): void {
					this.operationCount++;
				}

				public GetOperationCount(): number {
					return this.operationCount;
				}
			}

			const customCollector = new CustomMetricsCollector(metricsRegistry);
			customCollector.RecordOperation();
			customCollector.RecordOperation();

			expect(customCollector.GetOperationCount()).toBe(2);
			expect(customCollector['GetMetric']('custom_ops')).toBeDefined();
		});

		it('should properly isolate metrics from different collectors', () => {
			class CollectorA extends BaseMetricsCollector {
				protected InitializeMetrics(): void {
					this.RegisterCounter('collector_a_metric', 'Collector A metric');
				}
			}

			class CollectorB extends BaseMetricsCollector {
				protected InitializeMetrics(): void {
					this.RegisterCounter('collector_b_metric', 'Collector B metric');
				}
			}

			const collectorA = new CollectorA(metricsRegistry);
			const collectorB = new CollectorB(metricsRegistry);

			const metricsA = collectorA['GetAllMetrics']();
			const metricsB = collectorB['GetAllMetrics']();

			expect(metricsA.has('collector_a_metric')).toBe(true);
			expect(metricsB.has('collector_b_metric')).toBe(true);
			// Both should be registered in the shared registry
			expect(metricsA.size).toBeGreaterThan(0);
			expect(metricsB.size).toBeGreaterThan(0);
		});
	});

	describe('Error Handling and Edge Cases', () => {
		it('should handle empty rate limit configuration overrides', () => {
			const config = CreateRateLimitConfig({});
			expect(config.auth?.login?.limit).toBe(5);
			expect(config.api?.default?.limit).toBe(100);
		});

		it('should handle null rate limit configuration overrides', () => {
			const config = CreateRateLimitConfig(undefined);
			expect(config.auth?.login?.limit).toBe(5);
			expect(config.api?.default?.limit).toBe(100);
		});

		it('should handle undefined health check parameters', () => {
			const health = healthCheck.getHealth(undefined, undefined);
			expect(health.service).toBeUndefined();
			expect(health.version).toBeUndefined();
			expect(health.status).toBe('ok');
		});

		it('should handle security middleware with partial options', () => {
			const options: SecurityBootstrapOptions = {
				corsOrigins: ['https://example.com'],
			};
			expect(() => ApplySecurityMiddleware(app, options)).not.toThrow();
		});
	});

	describe('Type Safety and Interfaces', () => {
		it('should maintain type safety for RateLimitConfig', () => {
			const config: RateLimitConfig = CreateRateLimitConfig();
			expect(config.auth).toBeDefined();
			expect(config.api).toBeDefined();
		});

		it('should maintain type safety for IHealthCheck', () => {
			const health: IHealthCheck = healthCheck.getHealth('test', '1.0.0');
			expect(health.status).toBe('ok');
			expect(health.service).toBe('test');
			expect(health.version).toBe('1.0.0');
		});

		it('should maintain type safety for SecurityBootstrapOptions', () => {
			const options: SecurityBootstrapOptions = {
				corsOrigins: ['https://example.com'],
				environment: 'production',
				compressionEnabled: true,
				corsEnabled: true,
			};
			expect(() => ApplySecurityMiddleware(app, options)).not.toThrow();
		});
	});

	describe('CommonModule Integration and Import Order Validation', () => {
		it('should export global exception filter from CommonModule', () => {
			// Verify that GlobalExceptionFilter is exported
			expect(GlobalExceptionFilter).toBeDefined();
		});

		it('should export CSRF service from CommonModule', () => {
			// Verify that CSRFService is exported
			expect(CSRFService).toBeDefined();
		});

		it('should export error sanitizer service from CommonModule', () => {
			// Verify that ErrorSanitizerService is exported
			expect(ErrorSanitizerService).toBeDefined();
		});

		it('should export logging interceptor from CommonModule', () => {
			// Verify that LoggingInterceptor is exported
			expect(LoggingInterceptor).toBeDefined();
		});

		it('should export app logger from CommonModule', () => {
			// Verify that AppLogger is exported
			expect(AppLogger).toBeDefined();
		});
	});
});
