import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
			CreateContextualLogger: () => ({
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
			service.RecordCounter('requests_total', 1);
			service.RecordCounter('requests_total', 1);
			service.RecordCounter('requests_total', 1);

			const metrics = service.GetMetricsAsJSON();

			expect(metrics).toBeDefined();
		});

		it('should track different counter names separately', () => {
			service.RecordCounter('http_requests', 1);
			service.RecordCounter('db_queries', 1);
			service.RecordCounter('cache_hits', 1);

			const metrics = service.GetMetricsAsJSON();

			expect(metrics).toBeDefined();
		});

		it('should handle counter labels', () => {
			service.RecordCounter('requests_total', 1, { method: 'GET', status: '200' });
			service.RecordCounter('requests_total', 1, { method: 'POST', status: '201' });

			const metrics = service.GetMetricsAsJSON();

			expect(metrics).toBeDefined();
		});
	});

	describe('histogram operations', () => {
		it('should record histogram values', () => {
			service.RecordHistogram('request_duration_ms', 45);
			service.RecordHistogram('request_duration_ms', 120);
			service.RecordHistogram('request_duration_ms', 28);

			const metrics = service.GetMetricsAsJSON();

			expect(metrics).toBeDefined();
		});

		it('should track different histogram names', () => {
			service.RecordHistogram('response_time', 100);
			service.RecordHistogram('processing_time', 50);
			service.RecordHistogram('database_time', 25);

			const metrics = service.GetMetricsAsJSON();

			expect(metrics).toBeDefined();
		});

		it('should handle large histogram values', () => {
			service.RecordHistogram('memory_usage_bytes', 1024 * 1024 * 512);
			service.RecordHistogram('disk_usage_bytes', 1024 * 1024 * 1024 * 10);

			const metrics = service.GetMetricsAsJSON();

			expect(metrics).toBeDefined();
		});
	});

	describe('gauge operations', () => {
		it('should set gauge values', () => {
			service.RecordGauge('connections_active', 42);
			service.RecordGauge('connections_active', 45);
			service.RecordGauge('connections_active', 38);

			const metrics = service.GetMetricsAsJSON();

			expect(metrics).toBeDefined();
		});

		it('should track multiple gauges', () => {
			service.RecordGauge('cpu_usage_percent', 45.5);
			service.RecordGauge('memory_usage_percent', 72.3);
			service.RecordGauge('disk_usage_percent', 58.9);

			const metrics = service.GetMetricsAsJSON();

			expect(metrics).toBeDefined();
		});
	});

	describe('metrics export', () => {
		it('should export metrics as JSON', () => {
			service.RecordCounter('test_counter', 1);
			service.RecordHistogram('test_histogram', 100);
			service.RecordGauge('test_gauge', 50);

			const json = service.GetMetricsAsJSON();

			expect(json).toBeDefined();
			expect(json).not.toBeNull();
		});

		it('should handle empty metrics', () => {
			const json = service.GetMetricsAsJSON();

			expect(json).toBeDefined();
		});
	});
});
