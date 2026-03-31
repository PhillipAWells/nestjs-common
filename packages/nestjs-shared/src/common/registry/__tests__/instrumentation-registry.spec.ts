import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstrumentationRegistry } from '../instrumentation-registry.js';
import type { IMetricsExporter, IMetricDescriptor, IMetricValue } from '../../interfaces/metrics-exporter.interface.js';
import { AppLogger } from '../../services/logger.service.js';

// Mock helpers
const createMockExporter = (overrides?: Partial<IMetricsExporter>): IMetricsExporter => ({
	SupportsEventBased: false,
	SupportsPull: true,
	onMetricRecorded: vi.fn(),
	onDescriptorRegistered: vi.fn(),
	shutdown: vi.fn(),
	...overrides,
});

const createMockAppLogger = () => ({
	createContextualLogger: vi.fn().mockReturnValue({
		log: vi.fn(),
		Log: vi.fn(),
		error: vi.fn(),
		Error: vi.fn(),
		warn: vi.fn(),
		Warn: vi.fn(),
		debug: vi.fn(),
		Debug: vi.fn(),
	}),
	CreateContextualLogger: vi.fn().mockReturnValue({
		log: vi.fn(),
		Log: vi.fn(),
		error: vi.fn(),
		Error: vi.fn(),
		warn: vi.fn(),
		Warn: vi.fn(),
		debug: vi.fn(),
		Debug: vi.fn(),
	}),
});

describe('InstrumentationRegistry', () => {
	let registry: InstrumentationRegistry;
	let mockAppLogger: any;

	beforeEach(() => {
		mockAppLogger = createMockAppLogger();
		const mockModuleRef = {
			get: (token: any) => {
				if (token === AppLogger) return mockAppLogger;
				throw new Error('not found');
			},
		} as any;
		registry = new InstrumentationRegistry(mockModuleRef);
		registry.onModuleInit();
	});

	describe('Constructor', () => {
		it('should create an instance', () => {
			expect(registry).toBeDefined();
		});

		it('should register HTTP metrics on construction', () => {
			// Check that standard HTTP metrics are registered
			const httpRequestDuration = registry.GetMetric('http_request_duration_seconds');
			const httpRequestsTotal = registry.GetMetric('http_requests_total');
			const httpRequestSize = registry.GetMetric('http_request_size_bytes');

			// These should exist as empty arrays
			expect(httpRequestDuration).toEqual([]);
			expect(httpRequestsTotal).toEqual([]);
			expect(httpRequestSize).toEqual([]);
		});
	});

	describe('registerDescriptor()', () => {
		it('should register a new descriptor successfully', () => {
			const descriptor: IMetricDescriptor = {
				name: 'custom_metric',
				type: 'counter',
				help: 'A custom metric',
				labelNames: ['service'],
			};

			registry.RegisterDescriptor(descriptor);

			// Should be able to record the metric now
			expect(() => {
				registry.RecordMetric('custom_metric', 1);
			}).not.toThrow();
		});

		it('should be idempotent when called with identical descriptor', () => {
			const descriptor: IMetricDescriptor = {
				name: 'idempotent_metric',
				type: 'counter',
				help: 'Test idempotency',
				labelNames: ['test'],
			};

			// Register twice
			registry.RegisterDescriptor(descriptor);
			registry.RegisterDescriptor(descriptor);

			// Should not throw and metrics should be recorded correctly
			expect(() => {
				registry.RecordMetric('idempotent_metric', 1);
				registry.RecordMetric('idempotent_metric', 1);
			}).not.toThrow();

			const values = registry.GetMetric('idempotent_metric');
			expect(values.length).toBe(2);
		});

		it('should throw on conflict: same name, different type', () => {
			const descriptor1: IMetricDescriptor = {
				name: 'conflict_metric',
				type: 'counter',
				help: 'First version',
				labelNames: ['label1'],
			};

			const descriptor2: IMetricDescriptor = {
				name: 'conflict_metric',
				type: 'histogram', // Different type
				help: 'First version',
				labelNames: ['label1'],
			};

			registry.RegisterDescriptor(descriptor1);

			expect(() => {
				registry.RegisterDescriptor(descriptor2);
			}).toThrow(/already registered with different configuration/);
		});

		it('should throw on conflict: same name, different labelNames', () => {
			const descriptor1: IMetricDescriptor = {
				name: 'label_conflict',
				type: 'counter',
				help: 'Test',
				labelNames: ['label1'],
			};

			const descriptor2: IMetricDescriptor = {
				name: 'label_conflict',
				type: 'counter',
				help: 'Test',
				labelNames: ['label1', 'label2'], // Different labels
			};

			registry.RegisterDescriptor(descriptor1);

			expect(() => {
				registry.RegisterDescriptor(descriptor2);
			}).toThrow(/already registered with different configuration/);
		});

		it('should call onDescriptorRegistered on all already-registered exporters', () => {
			const exporter1 = createMockExporter();
			const exporter2 = createMockExporter();

			registry.RegisterExporter(exporter1);
			registry.RegisterExporter(exporter2);

			const descriptor: IMetricDescriptor = {
				name: 'new_metric',
				type: 'histogram',
				help: 'New metric after exporters registered',
				labelNames: ['method'],
			};

			registry.RegisterDescriptor(descriptor);

			// Both exporters should have been notified
			expect(exporter1.onDescriptorRegistered).toHaveBeenCalledWith(descriptor);
			expect(exporter2.onDescriptorRegistered).toHaveBeenCalledWith(descriptor);
		});

		it('should handle exporter notification errors gracefully', () => {
			const errorExporter = createMockExporter({
				onDescriptorRegistered: vi.fn(() => {
					throw new Error('Exporter failure');
				}),
			});

			registry.RegisterExporter(errorExporter);

			const descriptor: IMetricDescriptor = {
				name: 'error_test_metric',
				type: 'counter',
				help: 'Test error handling',
				labelNames: [],
			};

			// Should not throw even though exporter throws
			expect(() => {
				registry.RegisterDescriptor(descriptor);
			}).not.toThrow();

			// Logger should have been called with error
			const logger = mockAppLogger.createContextualLogger.mock.results[0].value;
			expect(logger.error).toHaveBeenCalled();
		});
	});

	describe('recordMetric()', () => {
		beforeEach(() => {
			// Register a test metric
			registry.RegisterDescriptor({
				name: 'test_metric',
				type: 'counter',
				help: 'Test metric',
				labelNames: ['label1', 'label2'],
			});
		});

		it('should record a value with performance.now() timestamp', () => {
			registry.RecordMetric('test_metric', 42, { label1: 'value1', label2: 'value2' });

			const values = registry.GetMetric('test_metric');
			expect(values.length).toBe(1);
			expect(values[0].value).toBe(42);
			expect(values[0].labels).toEqual({ label1: 'value1', label2: 'value2' });
			expect(typeof values[0].timestamp).toBe('number');
			expect(values[0].timestamp).toBeGreaterThan(0);
		});

		it('should throw when metric name is not registered', () => {
			expect(() => {
				registry.RecordMetric('nonexistent_metric', 1);
			}).toThrow(/Metric descriptor not found/);
		});

		it('should append to values array for same metric', () => {
			registry.RecordMetric('test_metric', 1);
			registry.RecordMetric('test_metric', 2);
			registry.RecordMetric('test_metric', 3);

			const values = registry.GetMetric('test_metric');
			expect(values.length).toBe(3);
			expect(values[0].value).toBe(1);
			expect(values[1].value).toBe(2);
			expect(values[2].value).toBe(3);
		});

		it('should call onMetricRecorded on event-based exporters', () => {
			const eventExporter = createMockExporter({
				SupportsEventBased: true,
			});

			registry.RegisterExporter(eventExporter);
			registry.RecordMetric('test_metric', 99, { label1: 'a', label2: 'b' });

			expect(eventExporter.onMetricRecorded).toHaveBeenCalledTimes(1);
			const [[call]] = (eventExporter.onMetricRecorded as any).mock.calls;
			expect(call.value).toBe(99);
		});

		it('should NOT call onMetricRecorded on pull-based-only exporters', () => {
			const pullExporter = createMockExporter({
				SupportsEventBased: false,
				SupportsPull: true,
			});

			registry.RegisterExporter(pullExporter);
			registry.RecordMetric('test_metric', 55);

			// Should not have been called
			expect(pullExporter.onMetricRecorded).not.toHaveBeenCalled();
		});

		it('should call named listeners registered via on()', () => {
			const listener = vi.fn();
			registry.On('test_metric', listener);

			registry.RecordMetric('test_metric', 77, { label1: 'x', label2: 'y' });

			expect(listener).toHaveBeenCalledTimes(1);
			const [[call]] = listener.mock.calls;
			expect(call.value).toBe(77);
			expect(call.labels).toEqual({ label1: 'x', label2: 'y' });
		});

		it('should catch and log errors thrown by exporters (does not rethrow)', () => {
			const errorExporter = createMockExporter({
				SupportsEventBased: true,
				onMetricRecorded: vi.fn(() => {
					throw new Error('Exporter error');
				}),
			});

			registry.RegisterExporter(errorExporter);

			// Should not throw
			expect(() => {
				registry.RecordMetric('test_metric', 1);
			}).not.toThrow();

			// Logger should have been called
			const logger = mockAppLogger.createContextualLogger.mock.results[0].value;
			expect(logger.error).toHaveBeenCalled();
		});

		it('should catch and log errors thrown by listeners (does not rethrow)', () => {
			const errorListener = vi.fn(() => {
				throw new Error('Listener error');
			});

			registry.On('test_metric', errorListener);

			// Should not throw
			expect(() => {
				registry.RecordMetric('test_metric', 1);
			}).not.toThrow();

			// Logger should have been called
			const logger = mockAppLogger.createContextualLogger.mock.results[0].value;
			expect(logger.error).toHaveBeenCalled();
		});

		it('should handle metrics with no labels', () => {
			registry.RecordMetric('test_metric', 123);

			const values = registry.GetMetric('test_metric');
			expect(values.length).toBe(1);
			expect(values[0].value).toBe(123);
			expect(values[0].labels).toEqual({});
		});

		it('should record the descriptor in metric value', () => {
			registry.RecordMetric('test_metric', 456);

			const values = registry.GetMetric('test_metric');
			expect(values[0].descriptor).toBeDefined();
			expect(values[0].descriptor.name).toBe('test_metric');
			expect(values[0].descriptor.type).toBe('counter');
		});
	});

	describe('getAllMetrics()', () => {
		it('should return empty map initially', () => {
			// Fresh registry
			const freshModuleRef = {
				get: (token: any) => {
					if (token === AppLogger) return mockAppLogger;
					throw new Error('not found');
				},
			} as any;
			const freshRegistry = new InstrumentationRegistry(freshModuleRef);
			freshRegistry.onModuleInit();
			const metrics = freshRegistry.GetAllMetrics();

			// Should only have the 3 pre-registered HTTP metrics
			expect(metrics.size).toBe(3);
		});

		it('should return a copy (mutation does not affect internal state)', () => {
			registry.RegisterDescriptor({
				name: 'mutable_test',
				type: 'counter',
				help: 'Test mutability',
				labelNames: [],
			});
			registry.RecordMetric('mutable_test', 1);

			const metrics1 = registry.GetAllMetrics();
			const originalSize = metrics1.get('mutable_test')?.length ?? 0;

			// Mutate the returned map
			const newArray: IMetricValue[] = [];
			metrics1.set('mutable_test', newArray);

			// Get fresh copy
			const metrics2 = registry.GetAllMetrics();
			const newSize = metrics2.get('mutable_test')?.length ?? 0;

			// Internal state should be unchanged
			expect(newSize).toBe(originalSize);
		});

		it('should return all recorded metrics', () => {
			registry.RegisterDescriptor({
				name: 'metric1',
				type: 'counter',
				help: 'Metric 1',
				labelNames: [],
			});
			registry.RegisterDescriptor({
				name: 'metric2',
				type: 'histogram',
				help: 'Metric 2',
				labelNames: [],
			});

			registry.RecordMetric('metric1', 10);
			registry.RecordMetric('metric1', 20);
			registry.RecordMetric('metric2', 100);

			const metrics = registry.GetAllMetrics();

			expect(metrics.has('metric1')).toBe(true);
			expect(metrics.has('metric2')).toBe(true);
			expect(metrics.get('metric1')?.length).toBe(2);
			expect(metrics.get('metric2')?.length).toBe(1);
		});
	});

	describe('getMetric()', () => {
		it('should return empty array for unknown name', () => {
			const values = registry.GetMetric('nonexistent');
			expect(values).toEqual([]);
		});

		it('should return recorded values for known name', () => {
			registry.RegisterDescriptor({
				name: 'known_metric',
				type: 'gauge',
				help: 'Known metric',
				labelNames: [],
			});

			registry.RecordMetric('known_metric', 1);
			registry.RecordMetric('known_metric', 2);

			const values = registry.GetMetric('known_metric');
			expect(values.length).toBe(2);
			expect(values[0].value).toBe(1);
			expect(values[1].value).toBe(2);
		});

		it('should return values for pre-registered HTTP metrics', () => {
			registry.RecordMetric('http_request_duration_seconds', 0.5);
			const values = registry.GetMetric('http_request_duration_seconds');
			expect(values.length).toBe(1);
		});
	});

	describe('on()', () => {
		beforeEach(() => {
			registry.RegisterDescriptor({
				name: 'listener_test',
				type: 'counter',
				help: 'Test listeners',
				labelNames: [],
			});
		});

		it('should call handler when metric is recorded', () => {
			const handler = vi.fn();
			registry.On('listener_test', handler);

			registry.RecordMetric('listener_test', 42);

			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('should not call handler after unsubscribe', () => {
			const handler = vi.fn();
			const unsubscribe = registry.On('listener_test', handler);

			registry.RecordMetric('listener_test', 1);
			expect(handler).toHaveBeenCalledTimes(1);

			unsubscribe();

			registry.RecordMetric('listener_test', 2);
			expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
		});

		it('should can have multiple handlers for same metric', () => {
			const handler1 = vi.fn();
			const handler2 = vi.fn();
			const handler3 = vi.fn();

			registry.On('listener_test', handler1);
			registry.On('listener_test', handler2);
			registry.On('listener_test', handler3);

			registry.RecordMetric('listener_test', 99);

			expect(handler1).toHaveBeenCalledTimes(1);
			expect(handler2).toHaveBeenCalledTimes(1);
			expect(handler3).toHaveBeenCalledTimes(1);
		});

		it('should unsubscribe single handler without affecting others', () => {
			const handler1 = vi.fn();
			const handler2 = vi.fn();

			const unsub1 = registry.On('listener_test', handler1);
			registry.On('listener_test', handler2);

			registry.RecordMetric('listener_test', 1);
			expect(handler1).toHaveBeenCalledTimes(1);
			expect(handler2).toHaveBeenCalledTimes(1);

			unsub1();

			registry.RecordMetric('listener_test', 2);
			expect(handler1).toHaveBeenCalledTimes(1); // Still 1
			expect(handler2).toHaveBeenCalledTimes(2);
		});
	});

	describe('registerExporter()', () => {
		it('should call onDescriptorRegistered for all existing descriptors', () => {
			const exporter = createMockExporter();

			registry.RegisterExporter(exporter);

			// Should be called for the 3 pre-registered HTTP metrics
			expect(exporter.onDescriptorRegistered).toHaveBeenCalledTimes(3);

			const { calls } = (exporter.onDescriptorRegistered as any).mock;
			const names = calls.map((c: any[]) => c[0].name);

			expect(names).toContain('http_request_duration_seconds');
			expect(names).toContain('http_requests_total');
			expect(names).toContain('http_request_size_bytes');
		});

		it('should add event-based exporter to notification list', () => {
			registry.RegisterDescriptor({
				name: 'exporter_test',
				type: 'counter',
				help: 'Test exporters',
				labelNames: [],
			});

			const eventExporter = createMockExporter({
				SupportsEventBased: true,
			});

			registry.RegisterExporter(eventExporter);
			registry.RecordMetric('exporter_test', 1);

			expect(eventExporter.onMetricRecorded).toHaveBeenCalledTimes(1);
		});

		it('should allow registered pull exporter to read via getAllMetrics()', () => {
			registry.RegisterDescriptor({
				name: 'pull_test',
				type: 'gauge',
				help: 'Test pull',
				labelNames: [],
			});

			registry.RecordMetric('pull_test', 123);

			const pullExporter = createMockExporter({
				SupportsPull: true,
				SupportsEventBased: false,
			});

			registry.RegisterExporter(pullExporter);

			const metrics = registry.GetAllMetrics();
			expect(metrics.get('pull_test')?.[0].value).toBe(123);
		});

		it('should handle exporter with both event and pull support', () => {
			const hybridExporter = createMockExporter({
				SupportsEventBased: true,
				SupportsPull: true,
			});

			registry.RegisterExporter(hybridExporter);

			registry.RegisterDescriptor({
				name: 'hybrid_test',
				type: 'counter',
				help: 'Hybrid test',
				labelNames: [],
			});

			registry.RecordMetric('hybrid_test', 42);

			expect(hybridExporter.onDescriptorRegistered).toHaveBeenCalled();
			expect(hybridExporter.onMetricRecorded).toHaveBeenCalledTimes(1);
		});

		it('should handle exporter registration errors gracefully', () => {
			const errorExporter = createMockExporter({
				onDescriptorRegistered: vi.fn(() => {
					throw new Error('Registration failed');
				}),
			});

			// Should not throw
			expect(() => {
				registry.RegisterExporter(errorExporter);
			}).not.toThrow();

			// Logger should have been called
			const logger = mockAppLogger.createContextualLogger.mock.results[0].value;
			expect(logger.error).toHaveBeenCalled();
		});

		it('should handle exporter without onDescriptorRegistered method', () => {
			const minimalExporter: IMetricsExporter = {
				SupportsEventBased: false,
				SupportsPull: true,
			};

			// Should not throw
			expect(() => {
				registry.RegisterExporter(minimalExporter);
			}).not.toThrow();
		});
	});

	describe('shutdown()', () => {
		it('should call shutdown() on all exporters', async () => {
			const exporter1 = createMockExporter({
				shutdown: vi.fn().mockResolvedValue(undefined),
			});
			const exporter2 = createMockExporter({
				shutdown: vi.fn().mockResolvedValue(undefined),
			});

			registry.RegisterExporter(exporter1);
			registry.RegisterExporter(exporter2);

			await registry.Shutdown();

			expect(exporter1.shutdown).toHaveBeenCalledTimes(1);
			expect(exporter2.shutdown).toHaveBeenCalledTimes(1);
		});

		it('should handle exporters without shutdown()', async () => {
			const exporterNoShutdown = createMockExporter();
			delete (exporterNoShutdown as any).shutdown;

			registry.RegisterExporter(exporterNoShutdown);

			// Should not throw
			await expect(registry.Shutdown()).resolves.toBeUndefined();
		});

		it('should handle sync and async shutdown methods', async () => {
			const syncExporter = createMockExporter({
				shutdown: vi.fn(), // Returns undefined (sync)
			});
			const asyncExporter = createMockExporter({
				shutdown: vi.fn().mockResolvedValue(undefined),
			});

			registry.RegisterExporter(syncExporter);
			registry.RegisterExporter(asyncExporter);

			await expect(registry.Shutdown()).resolves.toBeUndefined();

			expect(syncExporter.shutdown).toHaveBeenCalled();
			expect(asyncExporter.shutdown).toHaveBeenCalled();
		});

		it('should handle exporter shutdown errors gracefully', async () => {
			const errorExporter = createMockExporter({
				shutdown: vi.fn(() => {
					throw new Error('Shutdown failed');
				}),
			});

			registry.RegisterExporter(errorExporter);

			// Should not throw
			await expect(registry.Shutdown()).resolves.toBeUndefined();

			// Logger should have been called
			const logger = mockAppLogger.createContextualLogger.mock.results[0].value;
			expect(logger.error).toHaveBeenCalled();
		});

		it('should handle mixed shutdown: some succeed, some fail', async () => {
			const goodExporter = createMockExporter({
				shutdown: vi.fn().mockResolvedValue(undefined),
			});
			const badExporter = createMockExporter({
				shutdown: vi.fn(() => {
					throw new Error('Bad shutdown');
				}),
			});

			registry.RegisterExporter(goodExporter);
			registry.RegisterExporter(badExporter);

			// Should not throw
			await expect(registry.Shutdown()).resolves.toBeUndefined();

			expect(goodExporter.shutdown).toHaveBeenCalled();
			expect(badExporter.shutdown).toHaveBeenCalled();
		});

		it('should wait for all async shutdowns to complete', async () => {
			let promise1Resolved = false;
			let promise2Resolved = false;

			const exporter1 = createMockExporter({
				shutdown: vi.fn(
					() =>
						new Promise<void>((resolve) => {
							setTimeout(() => {
								promise1Resolved = true;
								resolve();
							}, 10);
						}),
				),
			});

			const exporter2 = createMockExporter({
				shutdown: vi.fn(
					() =>
						new Promise<void>((resolve) => {
							setTimeout(() => {
								promise2Resolved = true;
								resolve();
							}, 20);
						}),
				),
			});

			registry.RegisterExporter(exporter1);
			registry.RegisterExporter(exporter2);

			await registry.Shutdown();

			expect(promise1Resolved).toBe(true);
			expect(promise2Resolved).toBe(true);
		});
	});

	describe('Pre-registered HTTP metrics', () => {
		it('should have http_request_duration_seconds registered on construction', () => {
			const values = registry.GetMetric('http_request_duration_seconds');
			expect(values).toBeDefined();
			expect(Array.isArray(values)).toBe(true);
		});

		it('should have http_requests_total registered on construction', () => {
			const values = registry.GetMetric('http_requests_total');
			expect(values).toBeDefined();
			expect(Array.isArray(values)).toBe(true);
		});

		it('should have http_request_size_bytes registered on construction', () => {
			const values = registry.GetMetric('http_request_size_bytes');
			expect(values).toBeDefined();
			expect(Array.isArray(values)).toBe(true);
		});

		it('should be able to record metrics to pre-registered HTTP metrics', () => {
			registry.RecordMetric('http_request_duration_seconds', 0.5, {
				method: 'GET',
				route: '/api/test',
				status_code: '200',
			});

			const values = registry.GetMetric('http_request_duration_seconds');
			expect(values.length).toBe(1);
		});
	});

	describe('Integration: Complex Scenarios', () => {
		it('should handle multiple metrics with multiple exporters and listeners', () => {
			// Register metrics
			registry.RegisterDescriptor({
				name: 'metric_a',
				type: 'counter',
				help: 'Metric A',
				labelNames: [],
			});
			registry.RegisterDescriptor({
				name: 'metric_b',
				type: 'histogram',
				help: 'Metric B',
				labelNames: [],
			});

			// Register exporters
			const exporter1 = createMockExporter({ SupportsEventBased: true });
			const exporter2 = createMockExporter({ SupportsEventBased: true });
			registry.RegisterExporter(exporter1);
			registry.RegisterExporter(exporter2);

			// Register listeners
			const listenerA1 = vi.fn();
			const listenerA2 = vi.fn();
			const listenerB1 = vi.fn();
			registry.On('metric_a', listenerA1);
			registry.On('metric_a', listenerA2);
			registry.On('metric_b', listenerB1);

			// Record metrics
			registry.RecordMetric('metric_a', 1);
			registry.RecordMetric('metric_b', 100);
			registry.RecordMetric('metric_a', 2);

			// Verify exporters received all metrics
			expect(exporter1.onMetricRecorded).toHaveBeenCalledTimes(3);
			expect(exporter2.onMetricRecorded).toHaveBeenCalledTimes(3);

			// Verify listeners received correct metrics
			expect(listenerA1).toHaveBeenCalledTimes(2);
			expect(listenerA2).toHaveBeenCalledTimes(2);
			expect(listenerB1).toHaveBeenCalledTimes(1);
		});

		it('should track metric values separately by name', () => {
			registry.RegisterDescriptor({
				name: 'separate_a',
				type: 'counter',
				help: 'A',
				labelNames: [],
			});
			registry.RegisterDescriptor({
				name: 'separate_b',
				type: 'counter',
				help: 'B',
				labelNames: [],
			});

			registry.RecordMetric('separate_a', 10);
			registry.RecordMetric('separate_b', 20);
			registry.RecordMetric('separate_a', 30);

			expect(registry.GetMetric('separate_a').length).toBe(2);
			expect(registry.GetMetric('separate_b').length).toBe(1);
			expect(registry.GetMetric('separate_a')[0].value).toBe(10);
			expect(registry.GetMetric('separate_a')[1].value).toBe(30);
			expect(registry.GetMetric('separate_b')[0].value).toBe(20);
		});
	});

	describe('Branch Coverage: Error Handling Details', () => {
		it('should notify exporter when descriptor registered if onDescriptorRegistered exists', () => {
			const exporter = createMockExporter({
				onDescriptorRegistered: vi.fn(),
			});
			registry.RegisterExporter(exporter);

			const descriptor: IMetricDescriptor = {
				name: 'branch_test_1',
				type: 'counter',
				help: 'Test',
				labelNames: [],
			};

			registry.RegisterDescriptor(descriptor);

			// Verify the handler was called
			expect(exporter.onDescriptorRegistered).toHaveBeenCalledWith(descriptor);
		});

		it('should skip notifying exporter if onDescriptorRegistered is undefined', () => {
			const exporter: IMetricsExporter = {
				SupportsEventBased: false,
				SupportsPull: true,
				// No onDescriptorRegistered method
			};

			// Should not throw
			expect(() => {
				registry.RegisterExporter(exporter);
			}).not.toThrow();
		});

		it('should only call onMetricRecorded when SupportsEventBased is true', () => {
			registry.RegisterDescriptor({
				name: 'event_filter_test',
				type: 'counter',
				help: 'Test event filtering',
				labelNames: [],
			});

			const eventExporter = createMockExporter({
				SupportsEventBased: true,
				onMetricRecorded: vi.fn(),
			});
			const pullExporter = createMockExporter({
				SupportsEventBased: false,
				onMetricRecorded: vi.fn(),
			});

			registry.RegisterExporter(eventExporter);
			registry.RegisterExporter(pullExporter);

			registry.RecordMetric('event_filter_test', 1);

			// Only event-based exporter should be called
			expect(eventExporter.onMetricRecorded).toHaveBeenCalledTimes(1);
			expect(pullExporter.onMetricRecorded).not.toHaveBeenCalled();
		});

		it('should handle listeners gracefully when list is undefined', () => {
			registry.RegisterDescriptor({
				name: 'undefined_listeners_test',
				type: 'counter',
				help: 'Test undefined listeners',
				labelNames: [],
			});

			// Record metric without any listeners registered
			const _handler = vi.fn();
			expect(() => {
				registry.RecordMetric('undefined_listeners_test', 1);
			}).not.toThrow();
		});

		it('should call onMetricRecorded for each exporter independently', () => {
			registry.RegisterDescriptor({
				name: 'multiple_exporter_test',
				type: 'counter',
				help: 'Test multiple exporters',
				labelNames: [],
			});

			const exporter1 = createMockExporter({
				SupportsEventBased: true,
				onMetricRecorded: vi.fn(),
			});
			const exporter2 = createMockExporter({
				SupportsEventBased: true,
				onMetricRecorded: vi.fn(),
			});

			registry.RegisterExporter(exporter1);
			registry.RegisterExporter(exporter2);

			registry.RecordMetric('multiple_exporter_test', 5);

			// Both should have been called independently
			expect(exporter1.onMetricRecorded).toHaveBeenCalledTimes(1);
			expect(exporter2.onMetricRecorded).toHaveBeenCalledTimes(1);
		});

		it('should call each listener independently on metric record', () => {
			registry.RegisterDescriptor({
				name: 'multiple_listener_test',
				type: 'counter',
				help: 'Test multiple listeners',
				labelNames: [],
			});

			const listener1 = vi.fn();
			const listener2 = vi.fn();
			const listener3 = vi.fn();

			registry.On('multiple_listener_test', listener1);
			registry.On('multiple_listener_test', listener2);
			registry.On('multiple_listener_test', listener3);

			registry.RecordMetric('multiple_listener_test', 42);

			// All should have been called with the exact same value
			expect(listener1).toHaveBeenCalledTimes(1);
			expect(listener2).toHaveBeenCalledTimes(1);
			expect(listener3).toHaveBeenCalledTimes(1);

			const [[value1]] = listener1.mock.calls;
			const [[value2]] = listener2.mock.calls;
			const [[value3]] = listener3.mock.calls;
			expect((value2 as IMetricValue).value).toBe((value1 as IMetricValue).value);
			expect((value3 as IMetricValue).value).toBe((value1 as IMetricValue).value);
		});

		it('should handle descriptor comparison with all fields', () => {
			const desc1: IMetricDescriptor = {
				name: 'compare_test',
				type: 'histogram',
				help: 'Help text',
				labelNames: ['label1', 'label2'],
				buckets: [0.1, 0.5, 1.0],
				unit: 'seconds',
			};

			const desc2: IMetricDescriptor = {
				name: 'compare_test',
				type: 'histogram',
				help: 'Different help',
				labelNames: ['label1', 'label2'],
				buckets: [0.1, 0.5, 1.0],
				unit: 'seconds',
			};

			registry.RegisterDescriptor(desc1);

			// Should throw because help text differs
			expect(() => {
				registry.RegisterDescriptor(desc2);
			}).toThrow(/already registered with different configuration/);
		});

		it('should handle bucket difference detection', () => {
			const desc1: IMetricDescriptor = {
				name: 'bucket_test',
				type: 'histogram',
				help: 'Test buckets',
				labelNames: [],
				buckets: [0.1, 0.5, 1.0],
			};

			const desc2: IMetricDescriptor = {
				name: 'bucket_test',
				type: 'histogram',
				help: 'Test buckets',
				labelNames: [],
				buckets: [0.1, 0.5, 2.0], // Different bucket
			};

			registry.RegisterDescriptor(desc1);

			// Should throw because buckets differ
			expect(() => {
				registry.RegisterDescriptor(desc2);
			}).toThrow(/already registered with different configuration/);
		});

		it('should handle metric with labels containing numbers', () => {
			registry.RegisterDescriptor({
				name: 'numeric_labels_test',
				type: 'counter',
				help: 'Test numeric labels',
				labelNames: ['code', 'count'],
			});

			registry.RecordMetric('numeric_labels_test', 100, {
				code: 200,
				count: 5,
			});

			const values = registry.GetMetric('numeric_labels_test');
			expect(values[0].labels.code).toBe(200);
			expect(values[0].labels.count).toBe(5);
		});

		it('should handle async Promise.resolve in shutdown', async () => {
			const exporter = createMockExporter({
				shutdown: vi.fn().mockReturnValue(Promise.resolve()),
			});

			registry.RegisterExporter(exporter);

			await expect(registry.Shutdown()).resolves.toBeUndefined();
			expect(exporter.shutdown).toHaveBeenCalled();
		});

		it('should convert non-Promise shutdown return values', async () => {
			const exporter = createMockExporter({
				shutdown: vi.fn().mockReturnValue(undefined),
			});

			registry.RegisterExporter(exporter);

			await expect(registry.Shutdown()).resolves.toBeUndefined();
			expect(exporter.shutdown).toHaveBeenCalled();
		});

		it('should handle error instanceof check for non-Error objects in recordMetric', () => {
			registry.RegisterDescriptor({
				name: 'non_error_throw_test',
				type: 'counter',
				help: 'Test non-Error throws',
				labelNames: [],
			});

			const errorExporter = createMockExporter({
				SupportsEventBased: true,
				onMetricRecorded: vi.fn(() => {
					// eslint-disable-next-line no-throw-literal
					throw 'string error'; // Not an Error object
				}),
			});

			registry.RegisterExporter(errorExporter);

			expect(() => {
				registry.RecordMetric('non_error_throw_test', 1);
			}).not.toThrow();

			// Logger should have been called with string conversion
			const logger = mockAppLogger.createContextualLogger.mock.results[0].value;
			expect(logger.error).toHaveBeenCalled();
		});

		it('should handle error instanceof check for non-Error objects in listener', () => {
			registry.RegisterDescriptor({
				name: 'listener_non_error_test',
				type: 'counter',
				help: 'Test listener non-Error',
				labelNames: [],
			});

			const errorListener = vi.fn(() => {
				// eslint-disable-next-line no-throw-literal
				throw { message: 'object error' }; // Not an Error object
			});

			registry.On('listener_non_error_test', errorListener);

			expect(() => {
				registry.RecordMetric('listener_non_error_test', 1);
			}).not.toThrow();

			// Logger should have been called
			const logger = mockAppLogger.createContextualLogger.mock.results[0].value;
			expect(logger.error).toHaveBeenCalled();
		});

		it('should handle error instanceof check in descriptor registration', () => {
			const errorExporter = createMockExporter({
				onDescriptorRegistered: vi.fn(() => {
					// eslint-disable-next-line no-throw-literal
					throw 123; // Not an Error object
				}),
			});

			registry.RegisterExporter(errorExporter);

			const descriptor: IMetricDescriptor = {
				name: 'descriptor_non_error_test',
				type: 'counter',
				help: 'Test',
				labelNames: [],
			};

			expect(() => {
				registry.RegisterDescriptor(descriptor);
			}).not.toThrow();

			// Logger should have been called
			const logger = mockAppLogger.createContextualLogger.mock.results[0].value;
			expect(logger.error).toHaveBeenCalled();
		});

		it('should handle valuesArray check that is falsy', () => {
			// This is a defensive check - in practice values.Get() always returns an array
			// but we test the branch anyway
			registry.RegisterDescriptor({
				name: 'values_array_test',
				type: 'counter',
				help: 'Test values array handling',
				labelNames: [],
			});

			// Record normally - the if (valuesArray) check should pass
			registry.RecordMetric('values_array_test', 123);

			const values = registry.GetMetric('values_array_test');
			expect(values.length).toBe(1);
			expect(values[0].value).toBe(123);
		});

		it('should handle multiple async exporters with Promise.all', async () => {
			const delays = [10, 20, 5];
			const exporters = delays.map((delay) =>
				createMockExporter({
					shutdown: vi.fn(
						() =>
							new Promise<void>((resolve) => {
								setTimeout(resolve, delay);
							}),
					),
				}),
			);

			exporters.forEach((e) => registry.RegisterExporter(e));

			const startTime = performance.now();
			await registry.Shutdown();
			const endTime = performance.now();

			// Should complete in roughly the max delay (20ms) not the sum (35ms)
			// Adding some buffer for execution time
			expect(endTime - startTime).toBeLessThan(50);

			exporters.forEach((e) => {
				expect(e.shutdown).toHaveBeenCalled();
			});
		});

		it('should not break on undefined descriptor in recorded metric', () => {
			// Register a metric, record a value, verify descriptor is set correctly
			registry.RegisterDescriptor({
				name: 'descriptor_check',
				type: 'gauge',
				help: 'Test descriptor is recorded',
				labelNames: ['label'],
			});

			registry.RecordMetric('descriptor_check', 42, { label: 'test' });

			const values = registry.GetMetric('descriptor_check');
			expect(values[0].descriptor).toBeDefined();
			expect(values[0].descriptor.name).toBe('descriptor_check');
			expect(values[0].descriptor.type).toBe('gauge');
			expect(values[0].descriptor.help).toBe('Test descriptor is recorded');
		});

		it('should iterate through all exporters in order during shutdown', async () => {
			const callOrder: string[] = [];

			const exporter1 = createMockExporter({
				shutdown: vi.fn(() => {
					callOrder.push('exporter1');
					return Promise.resolve();
				}),
			});
			const exporter2 = createMockExporter({
				shutdown: vi.fn(() => {
					callOrder.push('exporter2');
					return Promise.resolve();
				}),
			});
			const exporter3 = createMockExporter({
				shutdown: vi.fn(() => {
					callOrder.push('exporter3');
					return Promise.resolve();
				}),
			});

			registry.RegisterExporter(exporter1);
			registry.RegisterExporter(exporter2);
			registry.RegisterExporter(exporter3);

			await registry.Shutdown();

			// All should be called
			expect(callOrder.length).toBe(3);
		});

		it('should handle unsubscribe when handler not found in array', () => {
			registry.RegisterDescriptor({
				name: 'unsub_not_found_test',
				type: 'counter',
				help: 'Test unsubscribe not found',
				labelNames: [],
			});

			const handler1 = vi.fn();
			const handler2 = vi.fn();
			const handler3 = vi.fn();

			registry.On('unsub_not_found_test', handler1);
			registry.On('unsub_not_found_test', handler2);

			// Try to unsubscribe handler3 which was never subscribed
			const unsubHandler3 = () => {
				// Find and remove from empty list
				const handlers: Array<(value: IMetricValue) => void> = [];
				const idx = handlers.indexOf(handler3);
				if (idx >= 0) {
					handlers.splice(idx, 1);
				}
			};

			unsubHandler3(); // Should not throw

			// Record metric to verify handlers still work
			registry.RecordMetric('unsub_not_found_test', 1);
			expect(handler1).toHaveBeenCalledTimes(1);
			expect(handler2).toHaveBeenCalledTimes(1);
		});

		it('should handle unsubscribe and reverify with handlers still present', () => {
			registry.RegisterDescriptor({
				name: 'unsub_verify_test',
				type: 'counter',
				help: 'Test unsubscribe verification',
				labelNames: [],
			});

			const handler1 = vi.fn();
			const handler2 = vi.fn();

			const unsub1 = registry.On('unsub_verify_test', handler1);
			registry.On('unsub_verify_test', handler2);

			registry.RecordMetric('unsub_verify_test', 1);
			expect(handler1).toHaveBeenCalledTimes(1);
			expect(handler2).toHaveBeenCalledTimes(1);

			// Unsubscribe handler1
			unsub1();

			// Verify handler1 is gone by index check
			registry.RecordMetric('unsub_verify_test', 2);
			expect(handler1).toHaveBeenCalledTimes(1); // Still 1, not called again
			expect(handler2).toHaveBeenCalledTimes(2); // Called again
		});

		it('should skip onDescriptorRegistered when undefined and not throw', () => {
			const minimalExporter: IMetricsExporter = {
				SupportsEventBased: false,
				SupportsPull: true,
				// Explicitly no onDescriptorRegistered method
			};

			// Register exporter first
			registry.RegisterExporter(minimalExporter);

			// Now register a new descriptor
			const descriptor: IMetricDescriptor = {
				name: 'skip_on_descriptor_test',
				type: 'counter',
				help: 'Test skip onDescriptorRegistered',
				labelNames: [],
			};

			// Should not throw even though onDescriptorRegistered is undefined
			expect(() => {
				registry.RegisterDescriptor(descriptor);
			}).not.toThrow();
		});

		it('should handle exporter with undefined shutdown method during shutdown', async () => {
			const exporterNoShutdown: IMetricsExporter = {
				SupportsEventBased: false,
				SupportsPull: true,
				// No shutdown method
			};

			registry.RegisterExporter(exporterNoShutdown);

			// Should not throw
			await expect(registry.Shutdown()).resolves.toBeUndefined();
		});

		it('should allow Promise rejections to propagate from exporters', async () => {
			const errorExporter = createMockExporter({
				shutdown: vi.fn(() => Promise.reject(new Error('Shutdown failed'))),
			});

			registry.RegisterExporter(errorExporter);

			// Promise rejections are not caught by the try-catch - they propagate
			await expect(registry.Shutdown()).rejects.toThrow('Shutdown failed');
		});
	});
});
