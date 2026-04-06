import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Instrument, IInstrumentOptions, InstrumentationRegistryHolder } from '../instrument.decorator.js';
import type { InstrumentationRegistry } from '../../registry/instrumentation-registry.js';

/**
 * Test suite for @Instrument() method decorator
 */
describe('Instrument Decorator', () => {
	let mockRegistry: Partial<InstrumentationRegistry>;

	beforeEach(() => {
		// Create a mock registry
		mockRegistry = {
			RegisterDescriptor: vi.fn(),
			RecordMetric: vi.fn(),
		};

		// Set the mock registry in the holder
		InstrumentationRegistryHolder.SetInstance(mockRegistry as InstrumentationRegistry);
	});

	afterEach(() => {
		// Clear the registry after each test
		InstrumentationRegistryHolder.SetInstance(null as any);
	});

	describe('basic functionality', () => {
		it('should record timing for synchronous method', () => {
			class TestService {
				@Instrument({ timing: 'test_method_duration_seconds' })
				testMethod(): string {
					return 'result';
				}
			}

			const service = new TestService();
			const result = service.testMethod();

			expect(result).toBe('result');
			expect(mockRegistry.RegisterDescriptor).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'test_method_duration_seconds',
					type: 'histogram',
					unit: 'seconds',
				}),
			);
			expect(mockRegistry.RecordMetric).toHaveBeenCalledWith(
				'test_method_duration_seconds',
				expect.any(Number),
				{},
			);
		});

		it('should record timing for async method', async () => {
			class TestService {
				@Instrument({ timing: 'test_async_method_duration_seconds' })
				async testAsyncMethod(): Promise<string> {
					const result = await Promise.resolve('result');
					return result;
				}
			}

			const service = new TestService();
			const result = await service.testAsyncMethod();

			expect(result).toBe('result');
			expect(mockRegistry.RegisterDescriptor).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'test_async_method_duration_seconds',
					type: 'histogram',
					unit: 'seconds',
				}),
			);
			expect(mockRegistry.RecordMetric).toHaveBeenCalledWith(
				'test_async_method_duration_seconds',
				expect.any(Number),
				{},
			);
		});

		it('should record success counters', () => {
			class TestService {
				@Instrument({ counters: ['test_method_success'] })
				testMethod(): string {
					return 'result';
				}
			}

			const service = new TestService();
			service.testMethod();

			expect(mockRegistry.RegisterDescriptor).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'test_method_success',
					type: 'counter',
				}),
			);
			expect(mockRegistry.RecordMetric).toHaveBeenCalledWith('test_method_success', 1, {});
		});

		it('should record error counters on exception', () => {
			class TestService {
				@Instrument({ errorCounters: ['test_method_errors'] })
				testMethod(): void {
					throw new Error('Test error');
				}
			}

			const service = new TestService();

			expect(() => service.testMethod()).toThrow('Test error');
			expect(mockRegistry.RegisterDescriptor).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'test_method_errors',
					type: 'counter',
				}),
			);
			expect(mockRegistry.RecordMetric).toHaveBeenCalledWith('test_method_errors', 1, {});
		});

		it('should record error counters on promise rejection', async () => {
			class TestService {
				@Instrument({ errorCounters: ['test_async_method_errors'] })
				async testAsyncMethod(): Promise<void> {
					await Promise.reject(new Error('Test error'));
				}
			}

			const service = new TestService();

			try {
				await service.testAsyncMethod();
				// Should not reach here
				expect.fail('Should have thrown');
			} catch (error) {
				expect((error as Error).message).toBe('Test error');
			}

			expect(mockRegistry.RegisterDescriptor).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'test_async_method_errors',
					type: 'counter',
				}),
			);
			expect(mockRegistry.RecordMetric).toHaveBeenCalledWith('test_async_method_errors', 1, {});
		});
	});

	describe('label handling', () => {
		it('should use static labels', () => {
			class TestService {
				@Instrument({
					timing: 'test_method_duration_seconds',
					Labels: { service: 'test', version: '1' },
				})
				testMethod(): string {
					return 'result';
				}
			}

			const service = new TestService();
			service.testMethod();

			expect(mockRegistry.RecordMetric).toHaveBeenCalledWith(
				'test_method_duration_seconds',
				expect.any(Number),
				{ service: 'test', version: '1' },
			);
		});

		it('should compute labels from function', () => {
			class TestService {
				@Instrument({
					timing: 'test_method_duration_seconds',
					Labels: (...args: unknown[]) => ({ userId: String(args[0]) }),
				})
				testMethod(id: string): string {
					return id;
				}
			}

			const service = new TestService();
			service.testMethod('user-123');

			expect(mockRegistry.RecordMetric).toHaveBeenCalledWith(
				'test_method_duration_seconds',
				expect.any(Number),
				{ userId: 'user-123' },
			);
		});

		it('should register descriptor with label names', () => {
			class TestService {
				@Instrument({
					timing: 'test_method_duration_seconds',
					Labels: { service: 'test', version: '1' },
				})
				testMethod(): string {
					return 'result';
				}
			}

			const service = new TestService();
			service.testMethod();

			expect(mockRegistry.RegisterDescriptor).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'test_method_duration_seconds',
					labelNames: expect.arrayContaining(['service', 'version']),
				}),
			);
		});
	});

	describe('multiple metrics', () => {
		it('should record multiple success counters', () => {
			class TestService {
				@Instrument({ counters: ['counter1', 'counter2', 'counter3'] })
				testMethod(): string {
					return 'result';
				}
			}

			const service = new TestService();
			service.testMethod();

			expect(mockRegistry.RecordMetric).toHaveBeenCalledWith('counter1', 1, {});
			expect(mockRegistry.RecordMetric).toHaveBeenCalledWith('counter2', 1, {});
			expect(mockRegistry.RecordMetric).toHaveBeenCalledWith('counter3', 1, {});
		});

		it('should record timing and success counters together', () => {
			const options: IInstrumentOptions = {
				timing: 'test_duration_seconds',
				counters: ['test_success'],
			};

			class TestService {
				@Instrument(options)
				testMethod(): string {
					return 'result';
				}
			}

			const service = new TestService();
			service.testMethod();

			expect(mockRegistry.RecordMetric).toHaveBeenCalledWith(
				'test_duration_seconds',
				expect.any(Number),
				{},
			);
			expect(mockRegistry.RecordMetric).toHaveBeenCalledWith('test_success', 1, {});
		});

		it('should handle success and error counters separately', () => {
			const options: IInstrumentOptions = {
				counters: ['test_success'],
				errorCounters: ['test_error'],
			};

			class TestService {
				@Instrument(options)
				testMethodSuccess(): string {
					return 'result';
				}

				@Instrument(options)
				testMethodError(): void {
					throw new Error('Test error');
				}
			}

			const service = new TestService();

			service.testMethodSuccess();
			expect(mockRegistry.RecordMetric).toHaveBeenCalledWith('test_success', 1, {});

			try {
				service.testMethodError();
			} catch {
				// Expected
			}
			expect(mockRegistry.RecordMetric).toHaveBeenCalledWith('test_error', 1, {});
		});
	});

	describe('registry availability', () => {
		it('should gracefully handle when registry is not set', () => {
			InstrumentationRegistryHolder.SetInstance(null as any);

			class TestService {
				@Instrument({ timing: 'test_method_duration_seconds' })
				testMethod(): string {
					return 'result';
				}
			}

			const service = new TestService();
			const result = service.testMethod();

			expect(result).toBe('result');
		});

		it('should use registry when it becomes available', () => {
			InstrumentationRegistryHolder.SetInstance(null as any);

			class TestService {
				@Instrument({ timing: 'test_method_duration_seconds' })
				testMethod(): string {
					return 'result';
				}
			}

			const service = new TestService();

			// First call without registry
			service.testMethod();

			// Now set the registry
			InstrumentationRegistryHolder.SetInstance(mockRegistry as InstrumentationRegistry);

			// Second call with registry
			service.testMethod();

			expect(mockRegistry.RecordMetric).toHaveBeenCalled();
		});
	});

	describe('error propagation', () => {
		it('should re-throw synchronous errors', () => {
			class TestService {
				@Instrument({ timing: 'test_method_duration_seconds' })
				testMethod(): void {
					throw new Error('Original error');
				}
			}

			const service = new TestService();

			expect(() => service.testMethod()).toThrow('Original error');
		});

		it('should re-throw async errors', async () => {
			class TestService {
				@Instrument({ timing: 'test_method_duration_seconds' })
				async testMethod(): Promise<void> {
					await Promise.reject(new Error('Original error'));
				}
			}

			const service = new TestService();

			try {
				await service.testMethod();
				expect.fail('Should have thrown');
			} catch (error) {
				expect((error as Error).message).toBe('Original error');
			}
		});
	});

	describe('timing precision', () => {
		it('should record timing in seconds', () => {
			class TestService {
				@Instrument({ timing: 'test_method_duration_seconds' })
				testMethod(): void {
					// Simulate some work
					const start = performance.now();
					while (performance.now() - start < 1) {
						// Busy wait for ~1ms
					}
				}
			}

			const service = new TestService();
			service.testMethod();

			const [[, recordedDuration]] = (mockRegistry.RecordMetric as any).mock.calls;

			// Should be a small positive number in seconds
			expect(typeof recordedDuration).toBe('number');
			expect(recordedDuration).toBeGreaterThan(0);
			expect(recordedDuration).toBeLessThan(1); // Should be less than 1 second
		});
	});

	describe('descriptor auto-registration', () => {
		it('should auto-register histogram descriptor', () => {
			class TestService {
				@Instrument({ timing: 'test_duration_seconds' })
				testMethod(): string {
					return 'result';
				}
			}

			const service = new TestService();
			service.testMethod();

			expect(mockRegistry.RegisterDescriptor).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'test_duration_seconds',
					type: 'histogram',
					help: expect.stringContaining('testMethod'),
					unit: 'seconds',
				}),
			);
		});

		it('should auto-register counter descriptors', () => {
			class TestService {
				@Instrument({ counters: ['test_counter'] })
				testMethod(): string {
					return 'result';
				}
			}

			const service = new TestService();
			service.testMethod();

			expect(mockRegistry.RegisterDescriptor).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'test_counter',
					type: 'counter',
					help: expect.stringContaining('testMethod'),
				}),
			);
		});

		it('should auto-register error counter descriptors', () => {
			class TestService {
				@Instrument({ errorCounters: ['test_error_counter'] })
				testMethod(): void {
					throw new Error('Test error');
				}
			}

			const service = new TestService();

			try {
				service.testMethod();
			} catch {
				// Expected
			}

			expect(mockRegistry.RegisterDescriptor).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'test_error_counter',
					type: 'counter',
					help: expect.stringContaining('error'),
				}),
			);
		});

		it('should include label names in descriptor', () => {
			class TestService {
				@Instrument({
					timing: 'test_duration_seconds',
					Labels: { service: 'test', method: 'get' },
				})
				testMethod(): string {
					return 'result';
				}
			}

			const service = new TestService();
			service.testMethod();

			const { calls } = (mockRegistry.RegisterDescriptor as any).mock;
			const histogramCall = calls.find((call: any) => call[0].name === 'test_duration_seconds');

			expect(histogramCall[0].labelNames).toEqual(expect.arrayContaining(['service', 'method']));
		});
	});
});
