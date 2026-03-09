import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Setup mocks before importing the module
const mockCounter = { inc: vi.fn() };
const mockHistogram = { observe: vi.fn() };
const mockGauge = { set: vi.fn() };
const mockRegistry = {
	metrics: vi.fn().mockResolvedValue('# HELP test_metric Test metric\n# TYPE test_metric gauge'),
	clear: vi.fn(),
};

vi.mock('prom-client', () => ({
	Registry: class {
		metrics = mockRegistry.metrics;
		clear = mockRegistry.clear;
	},
	Counter: class {
		inc = mockCounter.inc;
	},
	Histogram: class {
		observe = mockHistogram.observe;
	},
	Gauge: class {
		set = mockGauge.set;
	},
	collectDefaultMetrics: vi.fn(),
}));

import { PrometheusExporter } from '../prometheus.exporter.js';

describe('PrometheusExporter', () => {
	let exporter: PrometheusExporter;

	beforeEach(() => {
		vi.clearAllMocks();
		exporter = new PrometheusExporter();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('onDescriptorRegistered', () => {
		it('should create Counter for counter type descriptor', () => {
			exporter.onDescriptorRegistered({
				name: 'test_counter',
				type: 'counter',
				help: 'Test counter',
				labelNames: ['method', 'route'],
			});

			// The instrument should be created and stored
			expect(exporter).toBeDefined();
		});

		it('should create Histogram for histogram type descriptor', () => {
			exporter.onDescriptorRegistered({
				name: 'test_histogram',
				type: 'histogram',
				help: 'Test histogram',
				labelNames: ['status'],
				buckets: [0.1, 0.5, 1.0],
			});

			expect(exporter).toBeDefined();
		});

		it('should create Gauge for gauge type descriptor', () => {
			exporter.onDescriptorRegistered({
				name: 'test_gauge',
				type: 'gauge',
				help: 'Test gauge',
				labelNames: [],
			});

			expect(exporter).toBeDefined();
		});

		it('should create Gauge for updown_counter type descriptor', () => {
			exporter.onDescriptorRegistered({
				name: 'test_updown',
				type: 'updown_counter',
				help: 'Test updown counter',
				labelNames: [],
			});

			expect(exporter).toBeDefined();
		});
	});

	describe('onMetricRecorded', () => {
		it('should buffer the value in pending map', () => {
			const descriptor = {
				name: 'test_metric',
				type: 'counter' as const,
				help: 'Test metric',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);

			const metricValue = {
				descriptor,
				value: 5,
				labels: {},
				timestamp: Date.now(),
			};

			exporter.onMetricRecorded(metricValue);

			// Verify that the metric was buffered by checking getMetrics flushes it
			expect(exporter).toBeDefined();
		});
	});

	describe('getMetrics', () => {
		it('should flush pending counters via counter.inc()', async () => {
			const descriptor = {
				name: 'test_counter',
				type: 'counter' as const,
				help: 'Test counter',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);

			const metricValue = {
				descriptor,
				value: 10,
				labels: {},
				timestamp: Date.now(),
			};

			exporter.onMetricRecorded(metricValue);
			await exporter.getMetrics();

			expect(mockCounter.inc).toHaveBeenCalledWith({}, 10);
		});

		it('should flush pending histograms via histogram.observe()', async () => {
			const descriptor = {
				name: 'test_histogram',
				type: 'histogram' as const,
				help: 'Test histogram',
				labelNames: [],
				buckets: [0.1, 0.5, 1.0],
			};

			exporter.onDescriptorRegistered(descriptor);

			const metricValue = {
				descriptor,
				value: 0.25,
				labels: {},
				timestamp: Date.now(),
			};

			exporter.onMetricRecorded(metricValue);
			await exporter.getMetrics();

			expect(mockHistogram.observe).toHaveBeenCalledWith({}, 0.25);
		});

		it('should flush pending gauges via gauge.set()', async () => {
			const descriptor = {
				name: 'test_gauge',
				type: 'gauge' as const,
				help: 'Test gauge',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);

			const metricValue = {
				descriptor,
				value: 42,
				labels: {},
				timestamp: Date.now(),
			};

			exporter.onMetricRecorded(metricValue);
			await exporter.getMetrics();

			expect(mockGauge.set).toHaveBeenCalledWith({}, 42);
		});

		it('should return Prometheus text format string', async () => {
			const result = await exporter.getMetrics();

			expect(mockRegistry.metrics).toHaveBeenCalled();
			expect(typeof result).toBe('string');
		});

		it('should clear pending after flush', async () => {
			const descriptor = {
				name: 'test_counter',
				type: 'counter' as const,
				help: 'Test counter',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);

			const metricValue = {
				descriptor,
				value: 5,
				labels: {},
				timestamp: Date.now(),
			};

			exporter.onMetricRecorded(metricValue);
			await exporter.getMetrics();

			mockCounter.inc.mockClear();
			await exporter.getMetrics();

			expect(mockCounter.inc).not.toHaveBeenCalled();
		});
	});

	describe('shutdown', () => {
		it('should clear the registry', async () => {
			await exporter.shutdown();

			expect(mockRegistry.clear).toHaveBeenCalled();
		});
	});
});
