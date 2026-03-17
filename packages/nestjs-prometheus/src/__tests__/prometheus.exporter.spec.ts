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

vi.mock('@pawells/nestjs-shared/common', () => ({
	AppLogger: class {
		constructor() {}
		warn = vi.fn();
		error = vi.fn();
		info = vi.fn();
		debug = vi.fn();
		fatal = vi.fn();
	},
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
			expect(exporter['instruments'].has('test_counter')).toBe(true);
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
			expect(exporter['instruments'].has('test_histogram')).toBe(true);
		});

		it('should create Gauge for gauge type descriptor', () => {
			exporter.onDescriptorRegistered({
				name: 'test_gauge',
				type: 'gauge',
				help: 'Test gauge',
				labelNames: [],
			});

			expect(exporter).toBeDefined();
			expect(exporter['instruments'].has('test_gauge')).toBe(true);
		});

		it('should create Gauge for updown_counter type descriptor', () => {
			exporter.onDescriptorRegistered({
				name: 'test_updown',
				type: 'updown_counter',
				help: 'Test updown counter',
				labelNames: [],
			});

			expect(exporter).toBeDefined();
			expect(exporter['instruments'].has('test_updown')).toBe(true);
		});

		it('should throw error for unsupported metric type', () => {
			expect(() => {
				exporter.onDescriptorRegistered({
					name: 'test_invalid',
					type: 'invalid_type' as any,
					help: 'Test invalid',
					labelNames: [],
				});
			}).toThrow('Unsupported metric type "invalid_type" for descriptor "test_invalid"');
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

			// Verify that the metric was buffered in the pending map
			expect(exporter).toBeDefined();
			expect(exporter['pending'].has('test_metric')).toBe(true);
			expect(exporter['pending'].get('test_metric')).toHaveLength(1);
		});

		it('should warn when metric is recorded before descriptor registration', () => {
			const warnSpy = vi.spyOn(exporter['logger'], 'warn').mockImplementation(() => {});

			const descriptor = {
				name: 'unregistered_metric',
				type: 'counter' as const,
				help: 'Unregistered metric',
				labelNames: [],
			};

			const metricValue = {
				descriptor,
				value: 5,
				labels: {},
				timestamp: Date.now(),
			};

			exporter.onMetricRecorded(metricValue);

			expect(warnSpy).toHaveBeenCalledWith(
				'Metric recorded before descriptor registration: unregistered_metric',
			);
			warnSpy.mockRestore();
		});

		it('should cap pending array to MAX_PENDING_PER_METRIC', () => {
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

			// Record MAX_PENDING_PER_METRIC + 100 values

			for (let i = 0; i < 1100; i++) {
				exporter.onMetricRecorded(metricValue);
			}

			// Should have at most MAX_PENDING_PER_METRIC items

			expect(exporter['pending'].get('test_metric')).toHaveLength(1000);
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

	describe('getMetrics', () => {
		it('should skip empty pending arrays', async () => {
			const descriptor = {
				name: 'test_counter',
				type: 'counter' as const,
				help: 'Test counter',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);

			// Call getMetrics without recording any metrics
			await exporter.getMetrics();

			// Counter.inc should not have been called since pendingValues is empty
			expect(mockCounter.inc).not.toHaveBeenCalled();
		});

		it('should skip pending metrics without instruments', async () => {
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

			// Remove the instrument before calling getMetrics
			exporter['instruments'].delete('test_counter');

			await exporter.getMetrics();

			// Counter.inc should not have been called since instrument was removed
			expect(mockCounter.inc).not.toHaveBeenCalled();
		});

		it('should handle metric with no descriptor in pending values', async () => {
			const descriptor = {
				name: 'test_counter',
				type: 'counter' as const,
				help: 'Test counter',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);

			// Manually add a pending array with an entry that has no descriptor
			exporter['pending'].set('test_no_descriptor', [
				{
					descriptor: undefined as any,
					value: 5,
					labels: {},
					timestamp: Date.now(),
				},
			]);

			await exporter.getMetrics();

			expect(mockCounter.inc).not.toHaveBeenCalled();
		});

		it('should handle updown_counter type in getMetrics', async () => {
			const descriptor = {
				name: 'test_updown',
				type: 'updown_counter' as const,
				help: 'Test updown counter',
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
	});

	describe('shutdown', () => {
		it('should clear the registry', async () => {
			await exporter.shutdown();

			expect(mockRegistry.clear).toHaveBeenCalled();
		});

		it('should clear all internal state', async () => {
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

			await exporter.shutdown();

			expect(exporter['instruments'].size).toBe(0);
			expect(exporter['pending'].size).toBe(0);
		});
	});

	describe('updown_counter accumulation across scrapes', () => {
		it('should accumulate updown_counter values across multiple scrapes', async () => {
			const descriptor = {
				name: 'test_updown',
				type: 'updown_counter' as const,
				help: 'Test updown counter',
				labelNames: ['request_id'],
			};

			exporter.onDescriptorRegistered(descriptor);

			// First batch: record +10
			exporter.onMetricRecorded({
				descriptor,
				value: 10,
				labels: { request_id: 'req1' },
				timestamp: Date.now(),
			});

			// First flush
			await exporter.getMetrics();
			expect(mockGauge.set).toHaveBeenLastCalledWith({ request_id: 'req1' }, 10);

			mockGauge.set.mockClear();

			// Second batch: record +5 (should accumulate to 15)
			exporter.onMetricRecorded({
				descriptor,
				value: 5,
				labels: { request_id: 'req1' },
				timestamp: Date.now(),
			});

			// Second flush
			await exporter.getMetrics();
			expect(mockGauge.set).toHaveBeenLastCalledWith({ request_id: 'req1' }, 15);
		});

		it('should handle negative values in updown_counter', async () => {
			const descriptor = {
				name: 'test_updown_neg',
				type: 'updown_counter' as const,
				help: 'Test updown counter with negatives',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);

			// First: +20
			exporter.onMetricRecorded({
				descriptor,
				value: 20,
				labels: {},
				timestamp: Date.now(),
			});

			await exporter.getMetrics();
			expect(mockGauge.set).toHaveBeenLastCalledWith({}, 20);

			mockGauge.set.mockClear();

			// Second: -5 (should give 15)
			exporter.onMetricRecorded({
				descriptor,
				value: -5,
				labels: {},
				timestamp: Date.now(),
			});

			await exporter.getMetrics();
			expect(mockGauge.set).toHaveBeenLastCalledWith({}, 15);
		});
	});

	describe('label ordering consistency', () => {
		it('should treat labels with same key-value pairs as same regardless of insertion order', async () => {
			const descriptor = {
				name: 'test_order',
				type: 'updown_counter' as const,
				help: 'Test label ordering',
				labelNames: ['a', 'b'],
			};

			exporter.onDescriptorRegistered(descriptor);

			// First metric: {a: '1', b: '2'}
			exporter.onMetricRecorded({
				descriptor,
				value: 10,
				labels: { a: '1', b: '2' },
				timestamp: Date.now(),
			});

			await exporter.getMetrics();
			expect(mockGauge.set).toHaveBeenLastCalledWith({ a: '1', b: '2' }, 10);

			mockGauge.set.mockClear();

			// Second metric: {b: '2', a: '1'} (different order, same labels)
			exporter.onMetricRecorded({
				descriptor,
				value: 5,
				labels: { b: '2', a: '1' },
				timestamp: Date.now(),
			});

			await exporter.getMetrics();
			// Should accumulate with first batch, giving 15
			expect(mockGauge.set).toHaveBeenLastCalledWith({ b: '2', a: '1' }, 15);
		});
	});
});
