
import { register } from 'prom-client';
import { MetricsRegistryService } from '../../services/metrics-registry.service.js';
import { BaseMetricsCollector } from '../base-metrics-collector.js';

class TestMetricsCollector extends BaseMetricsCollector {
	protected InitializeMetrics(): void {
		this.RegisterCounter('test_counter', 'Test counter', ['type']);
		this.RegisterGauge('test_gauge', 'Test gauge', ['type']);
		this.RegisterHistogram('test_histogram', 'Test histogram', ['type'], [0.1, 0.5, 1]);
	}
}

describe('BaseMetricsCollector', () => {
	let metricsRegistry: MetricsRegistryService;
	let collector: TestMetricsCollector;
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
		metricsRegistry = new MetricsRegistryService(mockModuleRef);
		collector = new TestMetricsCollector(metricsRegistry);
	});

	afterEach(() => {
		register.clear();
	});

	it('should initialize metrics', () => {
		expect(collector).toBeDefined();
	});

	it('should return registered counter', () => {
		const counter = collector.GetMetric('test_counter');
		expect(counter).toBeDefined();
	});

	it('should return registered gauge', () => {
		const gauge = collector.GetMetric('test_gauge');
		expect(gauge).toBeDefined();
	});

	it('should return registered histogram', () => {
		const histogram = collector.GetMetric('test_histogram');
		expect(histogram).toBeDefined();
	});

	it('should return all metrics', () => {
		const allMetrics = collector.GetAllMetrics();
		expect(allMetrics).toBeDefined();
		expect(allMetrics.size).toBe(3);
		expect(allMetrics.has('test_counter')).toBe(true);
		expect(allMetrics.has('test_gauge')).toBe(true);
		expect(allMetrics.has('test_histogram')).toBe(true);
	});

	it('should return undefined for non-existent metric', () => {
		const metric = collector.GetMetric('non_existent_metric');
		expect(metric).toBeUndefined();
	});
});
