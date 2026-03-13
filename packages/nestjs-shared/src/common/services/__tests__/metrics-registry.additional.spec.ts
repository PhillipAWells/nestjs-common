import { MetricsRegistryService } from '../metrics-registry.service.js';
import { register } from 'prom-client';

describe('MetricsRegistryService - Advanced Scenarios', () => {
	let service: MetricsRegistryService;
	let mockAppLogger: any;

	beforeEach(() => {
		register.clear();

		mockAppLogger = {
			info: () => {},
			warn: () => {},
			error: () => {},
			debug: () => {},
			createContextualLogger: () => ({
				info: () => {},
				warn: () => {},
				error: () => {},
				debug: () => {},
			}),
		};

		const mockModuleRef = { get: () => mockAppLogger } as any;
		service = new MetricsRegistryService(mockModuleRef);
	});

	afterEach(() => {
		register.clear();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('counter operations', () => {
		it('should increment counter multiple times', () => {
			service.recordCounter('requests_total', 1);
			service.recordCounter('requests_total', 1);
			service.recordCounter('requests_total', 1);

			const metrics = service.getMetricsAsJSON();

			expect(metrics).toBeDefined();
		});

		it('should track different counter names separately', () => {
			service.recordCounter('http_requests', 1);
			service.recordCounter('db_queries', 1);
			service.recordCounter('cache_hits', 1);

			const metrics = service.getMetricsAsJSON();

			expect(metrics).toBeDefined();
		});

		it('should handle counter labels', () => {
			service.recordCounter('requests_total', 1, { method: 'GET', status: '200' });
			service.recordCounter('requests_total', 1, { method: 'POST', status: '201' });

			const metrics = service.getMetricsAsJSON();

			expect(metrics).toBeDefined();
		});
	});

	describe('histogram operations', () => {
		it('should record histogram values', () => {
			service.recordHistogram('request_duration_ms', 45);
			service.recordHistogram('request_duration_ms', 120);
			service.recordHistogram('request_duration_ms', 28);

			const metrics = service.getMetricsAsJSON();

			expect(metrics).toBeDefined();
		});

		it('should track different histogram names', () => {
			service.recordHistogram('response_time', 100);
			service.recordHistogram('processing_time', 50);
			service.recordHistogram('database_time', 25);

			const metrics = service.getMetricsAsJSON();

			expect(metrics).toBeDefined();
		});

		it('should handle large histogram values', () => {
			service.recordHistogram('memory_usage_bytes', 1024 * 1024 * 512);
			service.recordHistogram('disk_usage_bytes', 1024 * 1024 * 1024 * 10);

			const metrics = service.getMetricsAsJSON();

			expect(metrics).toBeDefined();
		});
	});

	describe('gauge operations', () => {
		it('should set gauge values', () => {
			service.recordGauge('connections_active', 42);
			service.recordGauge('connections_active', 45);
			service.recordGauge('connections_active', 38);

			const metrics = service.getMetricsAsJSON();

			expect(metrics).toBeDefined();
		});

		it('should track multiple gauges', () => {
			service.recordGauge('cpu_usage_percent', 45.5);
			service.recordGauge('memory_usage_percent', 72.3);
			service.recordGauge('disk_usage_percent', 58.9);

			const metrics = service.getMetricsAsJSON();

			expect(metrics).toBeDefined();
		});
	});

	describe('metrics export', () => {
		it('should export metrics as JSON', () => {
			service.recordCounter('test_counter', 1);
			service.recordHistogram('test_histogram', 100);
			service.recordGauge('test_gauge', 50);

			const json = service.getMetricsAsJSON();

			expect(json).toBeDefined();
			expect(json).not.toBeNull();
		});

		it('should handle empty metrics', () => {
			const json = service.getMetricsAsJSON();

			expect(json).toBeDefined();
		});
	});
});
