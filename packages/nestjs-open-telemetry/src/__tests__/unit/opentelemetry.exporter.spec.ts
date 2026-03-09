import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Setup mocks before importing the module
const mockCounter = { add: vi.fn() };
const mockHistogram = { record: vi.fn() };
const mockUpDownCounter = { add: vi.fn() };
const mockMeter = {
	createCounter: vi.fn(() => mockCounter),
	createHistogram: vi.fn(() => mockHistogram),
	createUpDownCounter: vi.fn(() => mockUpDownCounter),
};

vi.mock('@opentelemetry/api', () => ({
	metrics: {
		getMeterProvider: vi.fn(() => ({
			getMeter: vi.fn(() => mockMeter),
		})),
	},
}));

import { OpenTelemetryExporter } from '../../exporters/opentelemetry.exporter.js';

describe('OpenTelemetryExporter', () => {
	let exporter: OpenTelemetryExporter;

	beforeEach(() => {
		vi.clearAllMocks();
		exporter = new OpenTelemetryExporter();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('onDescriptorRegistered', () => {
		it('should create counter instrument for counter type', () => {
			const descriptor = {
				name: 'test_counter',
				type: 'counter' as const,
				help: 'Test counter',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);

			expect(mockMeter.createCounter).toHaveBeenCalledWith(
				'test_counter',
				expect.objectContaining({
					description: 'Test counter',
				}),
			);
		});

		it('should create histogram instrument for histogram type', () => {
			const descriptor = {
				name: 'test_histogram',
				type: 'histogram' as const,
				help: 'Test histogram',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);

			expect(mockMeter.createHistogram).toHaveBeenCalledWith(
				'test_histogram',
				expect.objectContaining({
					description: 'Test histogram',
				}),
			);
		});

		it('should create updown_counter for gauge type', () => {
			const descriptor = {
				name: 'test_gauge',
				type: 'gauge' as const,
				help: 'Test gauge',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);

			expect(mockMeter.createUpDownCounter).toHaveBeenCalledWith(
				'test_gauge',
				expect.objectContaining({
					description: 'Test gauge',
				}),
			);
		});

		it('should create updown_counter for updown_counter type', () => {
			const descriptor = {
				name: 'test_updown',
				type: 'updown_counter' as const,
				help: 'Test updown counter',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);

			expect(mockMeter.createUpDownCounter).toHaveBeenCalledWith(
				'test_updown',
				expect.objectContaining({
					description: 'Test updown counter',
				}),
			);
		});

		it('should not recreate instrument if already cached', () => {
			const descriptor = {
				name: 'test_counter',
				type: 'counter' as const,
				help: 'Test counter',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);
			mockMeter.createCounter.mockClear();

			exporter.onDescriptorRegistered(descriptor);

			expect(mockMeter.createCounter).not.toHaveBeenCalled();
		});
	});

	describe('onMetricRecorded', () => {
		it('should call .add() for counter with correct value and labels', () => {
			const descriptor = {
				name: 'test_counter',
				type: 'counter' as const,
				help: 'Test counter',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);
			exporter.onMetricRecorded({
				descriptor,
				value: 5,
				labels: { method: 'GET', status: '200' },
				timestamp: Date.now(),
			});

			expect(mockCounter.add).toHaveBeenCalledWith(5, {
				method: 'GET',
				status: '200',
			});
		});

		it('should call .record() for histogram with correct value', () => {
			const descriptor = {
				name: 'test_histogram',
				type: 'histogram' as const,
				help: 'Test histogram',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);
			exporter.onMetricRecorded({
				descriptor,
				value: 0.25,
				labels: {},
				timestamp: Date.now(),
			});

			expect(mockHistogram.record).toHaveBeenCalledWith(0.25, {});
		});

		it('should do nothing if descriptor not registered', () => {
			const descriptor = {
				name: 'unregistered_metric',
				type: 'counter' as const,
				help: 'Unregistered metric',
				labelNames: [],
			};

			exporter.onMetricRecorded({
				descriptor,
				value: 5,
				labels: {},
				timestamp: Date.now(),
			});

			expect(mockCounter.add).not.toHaveBeenCalled();
			expect(mockHistogram.record).not.toHaveBeenCalled();
			expect(mockUpDownCounter.add).not.toHaveBeenCalled();
		});

		it('should call .add() for updown_counter with correct value', () => {
			const descriptor = {
				name: 'test_updown',
				type: 'updown_counter' as const,
				help: 'Test updown',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);
			exporter.onMetricRecorded({
				descriptor,
				value: 3,
				labels: {},
				timestamp: Date.now(),
			});

			expect(mockUpDownCounter.add).toHaveBeenCalledWith(3, {});
		});
	});

	describe('shutdown', () => {
		it('should clear instruments map', () => {
			const descriptor = {
				name: 'test_counter',
				type: 'counter' as const,
				help: 'Test counter',
				labelNames: [],
			};

			exporter.onDescriptorRegistered(descriptor);
			exporter.shutdown();

			// After shutdown, attempting to record should do nothing
			exporter.onMetricRecorded({
				descriptor,
				value: 5,
				labels: {},
				timestamp: Date.now(),
			});

			expect(mockCounter.add).not.toHaveBeenCalled();
		});
	});
});
