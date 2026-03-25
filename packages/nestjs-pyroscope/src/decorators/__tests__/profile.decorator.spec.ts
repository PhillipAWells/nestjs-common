import { vi } from 'vitest';
import { Profile, ProfileMethod, ProfileAsync } from '../profile.decorator.js';

describe('Profile Decorators', () => {
	let mockPyroscopeService: { isEnabled: ReturnType<typeof vi.fn>; startProfiling: ReturnType<typeof vi.fn>; stopProfiling: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		mockPyroscopeService = {
			isEnabled: vi.fn().mockReturnValue(true),
			startProfiling: vi.fn(),
			stopProfiling: vi.fn().mockReturnValue({
				cpuTime: 0,
				memoryUsage: 0,
				duration: 10,
				timestamp: Date.now(),
			}),
		} as any;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('@Profile (class decorator)', () => {
		it('should wrap all methods in profiling', () => {
			@Profile()
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				public testMethod(): string {
					return 'result';
				}

				public anotherMethod(): string {
					return 'another result';
				}
			}

			const instance = new TestClass();

			instance.testMethod();
			expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					functionName: 'TestClass.testMethod',
					className: 'TestClass',
					methodName: 'testMethod',
				}),
			);
			expect(mockPyroscopeService.stopProfiling).toHaveBeenCalled();

			vi.clearAllMocks();

			instance.anotherMethod();
			expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					functionName: 'TestClass.anotherMethod',
					className: 'TestClass',
					methodName: 'anotherMethod',
				}),
			);
		});

		it('should not wrap constructor', () => {
			@Profile()
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				public testMethod(): string {
					return 'result';
				}
			}

			new TestClass();

			// Constructor should not trigger profiling
			expect(mockPyroscopeService.startProfiling).not.toHaveBeenCalled();
		});

		it('should apply custom tags to all methods', () => {
			const customTags = { service: 'test', version: '1.0' };

			@Profile({ tags: customTags })
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				public testMethod(): string {
					return 'result';
				}
			}

			const instance = new TestClass();
			instance.testMethod();

			expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					tags: customTags,
				}),
			);
		});

		it('should not profile when service is not available', () => {
			@Profile()
			class TestClass {
				// No pyroscopeService property

				public testMethod(): string {
					return 'result';
				}
			}

			const instance = new TestClass();
			const result = instance.testMethod();

			expect(result).toBe('result');
			expect(mockPyroscopeService.startProfiling).not.toHaveBeenCalled();
		});

		it('should not profile when service is disabled', () => {
			mockPyroscopeService.isEnabled.mockReturnValue(false);

			@Profile()
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				public testMethod(): string {
					return 'result';
				}
			}

			const instance = new TestClass();
			const result = instance.testMethod();

			expect(result).toBe('result');
			expect(mockPyroscopeService.startProfiling).not.toHaveBeenCalled();
		});

		it('should handle errors and still stop profiling', () => {
			const error = new Error('Test error');

			@Profile()
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				public testMethod(): string {
					throw error;
				}
			}

			const instance = new TestClass();

			expect(() => instance.testMethod()).toThrow(error);
			expect(mockPyroscopeService.startProfiling).toHaveBeenCalled();
			expect(mockPyroscopeService.stopProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					error,
				}),
			);
		});

		it('should preserve method return values', () => {
			@Profile()
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				public testMethod(): string {
					return 'expected result';
				}
			}

			const instance = new TestClass();
			const result = instance.testMethod();

			expect(result).toBe('expected result');
		});

		it('should preserve method arguments', () => {
			@Profile()
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				public testMethod(arg1: string, arg2: number): string {
					return `${arg1}-${arg2}`;
				}
			}

			const instance = new TestClass();
			const result = instance.testMethod('test', 123);

			expect(result).toBe('test-123');
		});
	});

	describe('@ProfileMethod (method decorator)', () => {
		it('should profile decorated method', () => {
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileMethod()
				public testMethod(): string {
					return 'result';
				}
			}

			const instance = new TestClass();
			instance.testMethod();

			expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					functionName: 'TestClass.testMethod',
					className: 'TestClass',
					methodName: 'testMethod',
				}),
			);
			expect(mockPyroscopeService.stopProfiling).toHaveBeenCalled();
		});

		it('should use custom name when provided', () => {
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileMethod({ name: 'CustomProfileName' })
				public testMethod(): string {
					return 'result';
				}
			}

			const instance = new TestClass();
			instance.testMethod();

			expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					functionName: 'CustomProfileName',
				}),
			);
		});

		it('should apply custom tags', () => {
			const customTags = { operation: 'create', entity: 'user' };

			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileMethod({ tags: customTags })
				public testMethod(): string {
					return 'result';
				}
			}

			const instance = new TestClass();
			instance.testMethod();

			expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					tags: customTags,
				}),
			);
		});

		it('should not profile when service is disabled', () => {
			mockPyroscopeService.isEnabled.mockReturnValue(false);

			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileMethod()
				public testMethod(): string {
					return 'result';
				}
			}

			const instance = new TestClass();
			const result = instance.testMethod();

			expect(result).toBe('result');
			expect(mockPyroscopeService.startProfiling).not.toHaveBeenCalled();
		});

		it('should handle errors and still stop profiling', () => {
			const error = new Error('Method error');

			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileMethod()
				public testMethod(): string {
					throw error;
				}
			}

			const instance = new TestClass();

			expect(() => instance.testMethod()).toThrow(error);
			expect(mockPyroscopeService.startProfiling).toHaveBeenCalled();
			expect(mockPyroscopeService.stopProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					error,
				}),
			);
		});

		it('should preserve method return values', () => {
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileMethod()
				public testMethod(): { data: string } {
					return { data: 'complex object' };
				}
			}

			const instance = new TestClass();
			const result = instance.testMethod();

			expect(result).toEqual({ data: 'complex object' });
		});

		it('should work with methods that take arguments', () => {
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileMethod()
				public testMethod(a: number, b: number): number {
					return a + b;
				}
			}

			const instance = new TestClass();
			const result = instance.testMethod(5, 3);

			expect(result).toBe(8);
		});
	});

	describe('@ProfileAsync (async method decorator)', () => {
		it('should profile async method', async () => {
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileAsync()
				public async testMethod(): Promise<string> {
					await new Promise(resolve => setTimeout(resolve, 10));
					return 'async result';
				}
			}

			const instance = new TestClass();
			const result = await instance.testMethod();

			expect(result).toBe('async result');
			expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					functionName: 'TestClass.testMethod',
					className: 'TestClass',
					methodName: 'testMethod',
				}),
			);
			expect(mockPyroscopeService.stopProfiling).toHaveBeenCalled();
		});

		it('should use custom name when provided', async () => {
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileAsync({ name: 'CustomAsyncProfile' })
				public async testMethod(): Promise<string> {
					return 'result';
				}
			}

			const instance = new TestClass();
			await instance.testMethod();

			expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					functionName: 'CustomAsyncProfile',
				}),
			);
		});

		it('should apply custom tags', async () => {
			const customTags = { async: 'true', operation: 'fetch' };

			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileAsync({ tags: customTags })
				public async testMethod(): Promise<string> {
					return 'result';
				}
			}

			const instance = new TestClass();
			await instance.testMethod();

			expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					tags: customTags,
				}),
			);
		});

		it('should not profile when service is disabled', async () => {
			mockPyroscopeService.isEnabled.mockReturnValue(false);

			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileAsync()
				public async testMethod(): Promise<string> {
					return 'result';
				}
			}

			const instance = new TestClass();
			const result = await instance.testMethod();

			expect(result).toBe('result');
			expect(mockPyroscopeService.startProfiling).not.toHaveBeenCalled();
		});

		it('should handle async errors and still stop profiling', async () => {
			const error = new Error('Async error');

			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileAsync()
				public async testMethod(): Promise<string> {
					throw error;
				}
			}

			const instance = new TestClass();

			await expect(instance.testMethod()).rejects.toThrow(error);
			expect(mockPyroscopeService.startProfiling).toHaveBeenCalled();
			expect(mockPyroscopeService.stopProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					error,
				}),
			);
		});

		it('should preserve async method return values', async () => {
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileAsync()
				public async testMethod(): Promise<{ data: string; success: boolean }> {
					return { data: 'async data', success: true };
				}
			}

			const instance = new TestClass();
			const result = await instance.testMethod();

			expect(result).toEqual({ data: 'async data', success: true });
		});

		it('should work with async methods that take arguments', async () => {
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileAsync()
				public async testMethod(value: string): Promise<string> {
					await new Promise(resolve => setTimeout(resolve, 5));
					return `processed: ${value}`;
				}
			}

			const instance = new TestClass();
			const result = await instance.testMethod('test');

			expect(result).toBe('processed: test');
		});

		it('should handle promise rejection', async () => {
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileAsync()
				public async testMethod(): Promise<string> {
					return Promise.reject(new Error('Promise rejected'));
				}
			}

			const instance = new TestClass();

			await expect(instance.testMethod()).rejects.toThrow('Promise rejected');
			expect(mockPyroscopeService.stopProfiling).toHaveBeenCalled();
		});
	});

	describe('Inheritance scenarios', () => {
		it('should profile inherited methods with @Profile', () => {
			@Profile()
			class BaseClass {
				public pyroscopeService = mockPyroscopeService;

				public baseMethod(): string {
					return 'base result';
				}
			}

			class DerivedClass extends BaseClass {
				public derivedMethod(): string {
					return 'derived result';
				}
			}

			const instance = new DerivedClass();

			instance.baseMethod();
			expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					functionName: 'BaseClass.baseMethod',
				}),
			);
		});

		it('should allow combining @Profile with @ProfileMethod', () => {
			@Profile()
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileMethod({ name: 'CustomName' })
				public method1(): string {
					return 'result1';
				}

				public method2(): string {
					return 'result2';
				}
			}

			const instance = new TestClass();

			vi.clearAllMocks();
			instance.method1();

			expect(mockPyroscopeService.startProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					functionName: 'CustomName',
				}),
			);
		});

		it('should handle multiple profiled methods in inheritance chain', () => {
			@Profile()
			class BaseClass {
				public pyroscopeService = mockPyroscopeService;

				public method1(): string {
					return 'base1';
				}

				public method2(): string {
					return 'base2';
				}
			}

			@Profile()
			class DerivedClass extends BaseClass {
				public method3(): string {
					return 'derived3';
				}
			}

			const instance = new DerivedClass();

			instance.method1();
			instance.method2();
			instance.method3();

			expect(mockPyroscopeService.startProfiling).toHaveBeenCalledTimes(3);
		});
	});

	describe('Complex scenarios', () => {
		it('should handle deeply nested error handling', () => {
			const error = new Error('Nested error');

			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileMethod()
				public method(): never {
					try {
						throw error;
					} catch {
						throw new Error('Wrapped error');
					}
				}
			}

			const instance = new TestClass();

			expect(() => instance.method()).toThrow('Wrapped error');
			expect(mockPyroscopeService.stopProfiling).toHaveBeenCalledWith(
				expect.objectContaining({
					error: expect.any(Error),
				}),
			);
		});

		it('should preserve this context in profiled methods', () => {
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				public prop = 'test value';

				@ProfileMethod()
				public method(): string {
					return this.prop;
				}
			}

			const instance = new TestClass();
			const result = instance.method();

			expect(result).toBe('test value');
		});

		it('should handle methods with various return types', () => {
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileMethod()
				public returnString(): string {
					return 'string';
				}

				@ProfileMethod()
				public returnNumber(): number {
					return 42;
				}

				@ProfileMethod()
				public returnObject(): { key: string } {
					return { key: 'value' };
				}

				@ProfileMethod()
				public returnArray(): number[] {
					return [1, 2, 3];
				}

				@ProfileMethod()
				public returnNull(): null {
					return null;
				}

				@ProfileMethod()
				public returnUndefined(): undefined {
					// implicitly returns undefined
				}
			}

			const instance = new TestClass();

			expect(instance.returnString()).toBe('string');
			expect(instance.returnNumber()).toBe(42);
			expect(instance.returnObject()).toEqual({ key: 'value' });
			expect(instance.returnArray()).toEqual([1, 2, 3]);
			expect(instance.returnNull()).toBeNull();
			expect(instance.returnUndefined()).toBeUndefined();
		});

		it('should handle ProfileAsync with various async patterns', async () => {
			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileAsync()
				public async resolvedPromise(): Promise<string> {
					return Promise.resolve('resolved');
				}

				@ProfileAsync()
				public async resolvedValue(): Promise<string> {
					return 'direct value';
				}

				@ProfileAsync()
				public async withAwait(): Promise<string> {
					return Promise.resolve('awaited');
				}
			}

			const instance = new TestClass();

			const result1 = await instance.resolvedPromise();
			const result2 = await instance.resolvedValue();
			const result3 = await instance.withAwait();

			expect(result1).toBe('resolved');
			expect(result2).toBe('direct value');
			expect(result3).toBe('awaited');
			expect(mockPyroscopeService.startProfiling).toHaveBeenCalledTimes(3);
		});

		it('should measure correct timing across multiple calls', () => {
			const startTimes: number[] = [];

			mockPyroscopeService.startProfiling.mockImplementation((context) => {
				startTimes.push(context.startTime);
			});

			class TestClass {
				public pyroscopeService = mockPyroscopeService;

				@ProfileMethod()
				public method(): string {
					return 'result';
				}
			}

			const instance = new TestClass();

			instance.method();
			instance.method();

			expect(startTimes.length).toBe(2);
			expect(startTimes[1]).toBeGreaterThanOrEqual(startTimes[0]);
		});
	});
});
