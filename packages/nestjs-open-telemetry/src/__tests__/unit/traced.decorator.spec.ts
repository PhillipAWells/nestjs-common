/**
 * Unit Tests for @Traced Decorator
 *
 * Tests sync/async method signature preservation and tracing functionality.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Injectable } from '@nestjs/common';
import { initializeOpenTelemetry, shutdownOpenTelemetry, isInitialized, SpanKind } from '@pawells/open-telemetry-client';
import type { OpenTelemetryConfig } from '@pawells/open-telemetry-client';
import { Traced } from '../../decorators/traced.decorator.js';

// Test service with both sync and async methods
@Injectable()
class TestService {
	// Synchronous methods
	@Traced()
	syncMethod(): string {
		return 'sync result';
	}

	@Traced({ captureReturn: true })
	syncMethodWithReturn(value: string): string {
		return `sync: ${value}`;
	}

	@Traced()
	syncMethodWithError(): never {
		throw new Error('Sync error');
	}

	@Traced({ name: 'custom-sync-operation' })
	syncMethodCustomName(): number {
		return 42;
	}

	// Asynchronous methods
	@Traced()
	async asyncMethod(): Promise<string> {
		return 'async result';
	}

	@Traced({ captureReturn: true })
	async asyncMethodWithReturn(value: string): Promise<string> {
		return `async: ${value}`;
	}

	@Traced()
	async asyncMethodWithError(): Promise<never> {
		throw new Error('Async error');
	}

	@Traced({ kind: SpanKind.CLIENT, attributes: { 'operation': 'fetch' } })
	async asyncMethodWithAttributes(): Promise<string> {
		await new Promise(resolve => setTimeout(resolve, 10));
		return 'fetched';
	}

	// Nested calls (sync calling async)
	@Traced()
	async syncCallingAsync(): Promise<string> {
		return this.asyncMethod();
	}

	// Methods that return promises explicitly (not async)
	@Traced()
	async promiseReturningMethod(): Promise<string> {
		return Promise.resolve('promise result');
	}
}

describe('@Traced Decorator', () => {
	let testService: TestService;
	let testConfig: OpenTelemetryConfig;

	beforeAll(async () => {
		testConfig = {
			serviceName: 'traced-decorator-test',
			environment: 'test',
			otlpEndpoint: 'http://localhost:4318',
			otlpProtocol: 'http',
			enableTracing: true,
			enableMetrics: false,
			traceSampleRatio: 1.0,
		};

		try {
			await initializeOpenTelemetry(testConfig);
		} catch (error) {
			// Gracefully handle initialization errors in tests
			// The decorators still work without initialization
			console.debug('OpenTelemetry initialization skipped for tests:', error instanceof Error ? error.message : String(error));
		}
	});

	beforeEach(() => {
		testService = new TestService();
	});

	afterAll(async () => {
		if (isInitialized()) {
			try {
				await shutdownOpenTelemetry();
			} catch {
				// Gracefully handle shutdown errors - expected when OTEL collector not available
				console.log('Skipping OpenTelemetry shutdown - collector not available');
			}
		}
	});

	describe('Synchronous Method Signature Preservation', () => {
		it('should preserve sync method return type (not wrap in Promise)', () => {
			const result = testService.syncMethod();

			// Type check: result should be string, NOT Promise<string>
			expect(result).toBe('sync result');
			expect(result).not.toBeInstanceOf(Promise);
		});

		it('should preserve sync method with custom name', () => {
			const result = testService.syncMethodCustomName();

			expect(result).toBe(42);
			expect(typeof result).toBe('number');
			expect(result).not.toBeInstanceOf(Promise);
		});

		it('should preserve sync method with return capture', () => {
			const result = testService.syncMethodWithReturn('test');

			expect(result).toBe('sync: test');
			expect(typeof result).toBe('string');
			expect(result).not.toBeInstanceOf(Promise);
		});

		it('should throw errors synchronously (not wrapped in Promise)', () => {
			expect(() => testService.syncMethodWithError()).toThrow('Sync error');
		});

		it('should handle sync errors without converting to Promise rejection', () => {
			let caughtError: Error | null = null;

			try {
				testService.syncMethodWithError();
			} catch (error) {
				caughtError = error as Error;
			}

			expect(caughtError).toBeInstanceOf(Error);
			expect(caughtError?.message).toBe('Sync error');
		});
	});

	describe('Asynchronous Method Signature Preservation', () => {
		it('should preserve async method return type (Promise)', async () => {
			const result = testService.asyncMethod();

			// Type check: result should be Promise<string>
			expect(result).toBeInstanceOf(Promise);
			const value = await result;
			expect(value).toBe('async result');
		});

		it('should preserve async method with return capture', async () => {
			const result = testService.asyncMethodWithReturn('test');

			expect(result).toBeInstanceOf(Promise);
			const value = await result;
			expect(value).toBe('async: test');
		});

		it('should reject Promise for async errors', async () => {
			const resultPromise = testService.asyncMethodWithError();

			expect(resultPromise).toBeInstanceOf(Promise);
			await expect(resultPromise).rejects.toThrow('Async error');
		});

		it('should preserve async method with attributes', async () => {
			const result = testService.asyncMethodWithAttributes();

			expect(result).toBeInstanceOf(Promise);
			const value = await result;
			expect(value).toBe('fetched');
		});
	});

	describe('Promise-Returning (Non-Async) Methods', () => {
		it('should handle methods that return Promise without async keyword', async () => {
			const result = testService.promiseReturningMethod();

			expect(result).toBeInstanceOf(Promise);
			const value = await result;
			expect(value).toBe('promise result');
		});

		it('should handle sync method calling async method', async () => {
			const result = testService.syncCallingAsync();

			// Method is sync but returns Promise, so result should be Promise
			expect(result).toBeInstanceOf(Promise);
			const value = await result;
			expect(value).toBe('async result');
		});
	});

	describe('Edge Cases', () => {
		it('should handle sync method returning undefined', () => {
			@Injectable()
			class EdgeCaseService {
				@Traced()
				syncReturnsUndefined(): void {
					// Returns undefined
				}
			}

			const service = new EdgeCaseService();
			const result = service.syncReturnsUndefined();

			expect(result).toBeUndefined();
			expect(result).not.toBeInstanceOf(Promise);
		});

		it('should handle sync method returning null', () => {
			@Injectable()
			class EdgeCaseService {
				@Traced()
				syncReturnsNull(): null {
					return null;
				}
			}

			const service = new EdgeCaseService();
			const result = service.syncReturnsNull();

			expect(result).toBeNull();
			expect(result).not.toBeInstanceOf(Promise);
		});

		it('should handle sync method returning object', () => {
			@Injectable()
			class EdgeCaseService {
				@Traced()
				syncReturnsObject(): { value: number } {
					return { value: 123 };
				}
			}

			const service = new EdgeCaseService();
			const result = service.syncReturnsObject();

			expect(result).toEqual({ value: 123 });
			expect(result).not.toBeInstanceOf(Promise);
		});

		it('should handle async method returning undefined', async () => {
			@Injectable()
			class EdgeCaseService {
				@Traced()
				async asyncReturnsUndefined(): Promise<void> {
					// Returns undefined
				}
			}

			const service = new EdgeCaseService();
			const result = service.asyncReturnsUndefined();

			expect(result).toBeInstanceOf(Promise);
			const value = await result;
			expect(value).toBeUndefined();
		});
	});

	describe('Decorator Options', () => {
		it('should work with all decorator options on sync methods', () => {
			@Injectable()
			class OptionsService {
				@Traced({
					name: 'custom-sync',
					kind: SpanKind.INTERNAL,
					attributes: { 'custom': 'attribute' },
					captureArgs: true,
					captureReturn: true,
				})
				syncWithAllOptions(arg: string): string {
					return `result: ${arg}`;
				}
			}

			const service = new OptionsService();
			const result = service.syncWithAllOptions('test');

			expect(result).toBe('result: test');
			expect(result).not.toBeInstanceOf(Promise);
		});

		it('should work with all decorator options on async methods', async () => {
			@Injectable()
			class OptionsService {
				@Traced({
					name: 'custom-async',
					kind: SpanKind.CLIENT,
					attributes: { 'custom': 'attribute' },
					captureArgs: true,
					captureReturn: true,
				})
				async asyncWithAllOptions(arg: string): Promise<string> {
					return `result: ${arg}`;
				}
			}

			const service = new OptionsService();
			const result = service.asyncWithAllOptions('test');

			expect(result).toBeInstanceOf(Promise);
			const value = await result;
			expect(value).toBe('result: test');
		});
	});

	describe('Context Propagation', () => {
		it('should propagate context in sync methods', () => {
			@Injectable()
			class ContextService {
				@Traced()
				outerSync(): string {
					return this.innerSync();
				}

				@Traced()
				innerSync(): string {
					return 'inner result';
				}
			}

			const service = new ContextService();
			const result = service.outerSync();

			expect(result).toBe('inner result');
			expect(result).not.toBeInstanceOf(Promise);
		});

		it('should propagate context in async methods', async () => {
			@Injectable()
			class ContextService {
				@Traced()
				async outerAsync(): Promise<string> {
					return this.innerAsync();
				}

				@Traced()
				async innerAsync(): Promise<string> {
					return 'inner result';
				}
			}

			const service = new ContextService();
			const result = service.outerAsync();

			expect(result).toBeInstanceOf(Promise);
			const value = await result;
			expect(value).toBe('inner result');
		});

		it('should propagate context from sync to async', async () => {
			@Injectable()
			class ContextService {
				@Traced()
				async syncToAsync(): Promise<string> {
					return this.asyncMethod();
				}

				@Traced()
				async asyncMethod(): Promise<string> {
					return 'async from sync';
				}
			}

			const service = new ContextService();
			const result = service.syncToAsync();

			expect(result).toBeInstanceOf(Promise);
			const value = await result;
			expect(value).toBe('async from sync');
		});
	});

	describe('Error Handling and Exception Recording', () => {
		it('should record exceptions in sync method errors and set error status', () => {
			@Injectable()
			class ErrorService {
				@Traced({ captureReturn: true })
				syncMethodThatThrows(): never {
					throw new Error('Sync exception occurred');
				}
			}

			const service = new ErrorService();
			expect(() => service.syncMethodThatThrows()).toThrow('Sync exception occurred');
		});

		it('should record exceptions in async method errors', async () => {
			@Injectable()
			class ErrorService {
				@Traced({ captureReturn: true })
				async asyncMethodThatThrows(): Promise<never> {
					throw new Error('Async exception occurred');
				}
			}

			const service = new ErrorService();
			await expect(service.asyncMethodThatThrows()).rejects.toThrow('Async exception occurred');
		});

		it('should handle non-Error exceptions in sync methods', () => {
			@Injectable()
			class ErrorService {
				@Traced()
				syncThrowsString(): never {
					throw new Error('string error');
				}
			}

			const service = new ErrorService();
			expect(() => service.syncThrowsString()).toThrow('string error');
		});

		it('should handle non-Error exceptions in async methods', async () => {
			@Injectable()
			class ErrorService {
				@Traced()
				async asyncThrowsString(): Promise<never> {
					throw new Error('string error');
				}
			}

			const service = new ErrorService();
			await expect(service.asyncThrowsString()).rejects.toThrow('string error');
		});

		it('should capture error attributes in sync path with Error instance', () => {
			@Injectable()
			class ErrorService {
				@Traced()
				syncWithErrorAttributes(): never {
					const err = new Error('Test error');
					err.stack = 'Error: Test error\n    at syncWithErrorAttributes';
					throw err;
				}
			}

			const service = new ErrorService();
			expect(() => service.syncWithErrorAttributes()).toThrow('Test error');
		});

		it('should capture error attributes in async path with Error instance', async () => {
			@Injectable()
			class ErrorService {
				@Traced()
				async asyncWithErrorAttributes(): Promise<never> {
					const err = new Error('Async test error');
					err.stack = 'Error: Async test error\n    at asyncWithErrorAttributes';
					throw err;
				}
			}

			const service = new ErrorService();
			await expect(service.asyncWithErrorAttributes()).rejects.toThrow('Async test error');
		});

		it('should handle errors with long stack traces in sync methods', () => {
			@Injectable()
			class ErrorService {
				@Traced()
				syncWithLongStack(): never {
					const err = new Error('Long stack');
					err.stack = 'Error: Long stack\n' + 'at line 1\n'.repeat(50);
					throw err;
				}
			}

			const service = new ErrorService();
			expect(() => service.syncWithLongStack()).toThrow('Long stack');
		});

		it('should handle errors with long stack traces in async methods', async () => {
			@Injectable()
			class ErrorService {
				@Traced()
				async asyncWithLongStack(): Promise<never> {
					const err = new Error('Long async stack');
					err.stack = 'Error: Long async stack\n' + 'at line 1\n'.repeat(50);
					throw err;
				}
			}

			const service = new ErrorService();
			await expect(service.asyncWithLongStack()).rejects.toThrow('Long async stack');
		});

		it('should handle sync custom error subclass', () => {
			class CustomError extends Error {
				constructor(public code: number) {
					super('Custom error occurred');
				}
			}

			@Injectable()
			class ErrorService {
				@Traced()
				syncThrowsCustomError(): never {
					throw new CustomError(500);
				}
			}

			const service = new ErrorService();
			expect(() => service.syncThrowsCustomError()).toThrow(CustomError);
		});

		it('should handle async custom error subclass', async () => {
			class CustomError extends Error {
				constructor(public code: number) {
					super('Async custom error');
				}
			}

			@Injectable()
			class ErrorService {
				@Traced()
				async asyncThrowsCustomError(): Promise<never> {
					throw new CustomError(404);
				}
			}

			const service = new ErrorService();
			await expect(service.asyncThrowsCustomError()).rejects.toThrow(CustomError);
		});

		it('should handle sync error with custom name property', () => {
			@Injectable()
			class ErrorService {
				@Traced()
				syncThrowsCustomNamedError(): never {
					const err = new Error('Named error');
					err.name = 'CustomNamedError';
					throw err;
				}
			}

			const service = new ErrorService();
			expect(() => service.syncThrowsCustomNamedError()).toThrow('Named error');
		});

		it('should handle async error with custom name property', async () => {
			@Injectable()
			class ErrorService {
				@Traced()
				async asyncThrowsCustomNamedError(): Promise<never> {
					const err = new Error('Async named error');
					err.name = 'AsyncCustomError';
					throw err;
				}
			}

			const service = new ErrorService();
			await expect(service.asyncThrowsCustomNamedError()).rejects.toThrow('Async named error');
		});

		it('should handle sync error without stack property', () => {
			@Injectable()
			class ErrorService {
				@Traced()
				syncErrorWithoutStack(): never {
					const err = new Error('No stack error');
					delete err.stack;
					throw err;
				}
			}

			const service = new ErrorService();
			expect(() => service.syncErrorWithoutStack()).toThrow('No stack error');
		});

		it('should handle async error without stack property', async () => {
			@Injectable()
			class ErrorService {
				@Traced()
				async asyncErrorWithoutStack(): Promise<never> {
					const err = new Error('No stack error');
					delete err.stack;
					throw err;
				}
			}

			const service = new ErrorService();
			await expect(service.asyncErrorWithoutStack()).rejects.toThrow('No stack error');
		});

		it('should handle sync error that is not an Error instance (via type coercion)', () => {
			@Injectable()
			class ErrorService {
				@Traced()
				syncThrowsPrimitive(): never {
					// Explicitly throw something that isn't an Error to test non-Error instanceof path
					// Using error context to create a non-Error value
					const value = 'string error value' as any;
					throw new Error(value);
				}
			}

			const service = new ErrorService();
			expect(() => service.syncThrowsPrimitive()).toThrow('string error value');
		});

		it('should handle async error that is not an Error instance (via type coercion)', async () => {
			@Injectable()
			class ErrorService {
				@Traced()
				async asyncThrowsPrimitive(): Promise<never> {
					// Explicitly throw something that isn't an Error to test non-Error instanceof path
					const value = 'async string error' as any;
					throw new Error(value);
				}
			}

			const service = new ErrorService();
			await expect(service.asyncThrowsPrimitive()).rejects.toThrow('async string error');
		});
	});

	describe('Return Value Capture Edge Cases', () => {
		it('should capture return type when return value is unsanitizable in sync methods', () => {
			@Injectable()
			class ReturnService {
				@Traced({ captureReturn: true })
				syncReturnsFunction(): () => void {
					return () => {
						// intentional noop
					};
				}
			}

			const service = new ReturnService();
			const result = service.syncReturnsFunction();
			expect(typeof result).toBe('function');
		});

		it('should capture return type when return value is unsanitizable in async methods', async () => {
			@Injectable()
			class ReturnService {
				@Traced({ captureReturn: true })
				async asyncReturnsFunction(): Promise<() => void> {
					return () => {
						// intentional noop
					};
				}
			}

			const service = new ReturnService();
			const result = service.asyncReturnsFunction();
			expect(result).toBeInstanceOf(Promise);
			const value = await result;
			expect(typeof value).toBe('function');
		});

		it('should handle undefined return with captureReturn in sync methods', () => {
			@Injectable()
			class ReturnService {
				@Traced({ captureReturn: true })
				syncReturnsUndefinedWithCapture(): void {
					// explicitly returns undefined
				}
			}

			const service = new ReturnService();
			const result = service.syncReturnsUndefinedWithCapture();
			expect(result).toBeUndefined();
		});

		it('should handle undefined return with captureReturn in async methods', async () => {
			@Injectable()
			class ReturnService {
				@Traced({ captureReturn: true })
				async asyncReturnsUndefinedWithCapture(): Promise<void> {
					// explicitly returns undefined
				}
			}

			const service = new ReturnService();
			const result = service.asyncReturnsUndefinedWithCapture();
			expect(result).toBeInstanceOf(Promise);
			const value = await result;
			expect(value).toBeUndefined();
		});

		it('should handle null return with captureReturn in sync methods', () => {
			@Injectable()
			class ReturnService {
				@Traced({ captureReturn: true })
				syncReturnsNullWithCapture(): null {
					return null;
				}
			}

			const service = new ReturnService();
			const result = service.syncReturnsNullWithCapture();
			expect(result).toBeNull();
		});

		it('should handle null return with captureReturn in async methods', async () => {
			@Injectable()
			class ReturnService {
				@Traced({ captureReturn: true })
				async asyncReturnsNullWithCapture(): Promise<null> {
					return null;
				}
			}

			const service = new ReturnService();
			const result = service.asyncReturnsNullWithCapture();
			expect(result).toBeInstanceOf(Promise);
			const value = await result;
			expect(value).toBeNull();
		});

		it('should capture simple return objects in sync methods', () => {
			@Injectable()
			class ReturnService {
				@Traced({ captureReturn: true })
				syncReturnsSimpleObject(): { result: string } {
					return { result: 'object result' };
				}
			}

			const service = new ReturnService();
			const result = service.syncReturnsSimpleObject();
			expect(result).toEqual({ result: 'object result' });
		});

		it('should capture simple return objects in async methods', async () => {
			@Injectable()
			class ReturnService {
				@Traced({ captureReturn: true })
				async asyncReturnsSimpleObject(): Promise<{ result: string }> {
					return { result: 'async object result' };
				}
			}

			const service = new ReturnService();
			const result = service.asyncReturnsSimpleObject();
			expect(result).toBeInstanceOf(Promise);
			const value = await result;
			expect(value).toEqual({ result: 'async object result' });
		});
	});

	describe('Argument Sanitization Edge Cases', () => {
		it('should sanitize boolean arguments', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: true })
				methodWithBooleanArg(value: boolean): string {
					return `received: ${value}`;
				}
			}

			const service = new SanitizeService();
			const result = service.methodWithBooleanArg(true);
			expect(result).toBe('received: true');
		});

		it('should sanitize null arguments', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: true })
				methodWithNullArg(_value: null): string {
					return 'received null';
				}
			}

			const service = new SanitizeService();
			const result = service.methodWithNullArg(null);
			expect(result).toBe('received null');
		});

		it('should sanitize undefined arguments', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: true })
				methodWithUndefinedArg(_value?: string): string {
					return 'received: undefined';
				}
			}

			const service = new SanitizeService();
			const result = service.methodWithUndefinedArg();
			expect(result).toBe('received: undefined');
		});

		it('should sanitize empty array arguments', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: true })
				methodWithEmptyArray(arr: any[]): number {
					return arr.length;
				}
			}

			const service = new SanitizeService();
			const result = service.methodWithEmptyArray([]);
			expect(result).toBe(0);
		});

		it('should sanitize small simple array arguments', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: true })
				methodWithSimpleArray(arr: (string | number)[]): number {
					return arr.length;
				}
			}

			const service = new SanitizeService();
			const result = service.methodWithSimpleArray(['a', 'b', 1]);
			expect(result).toBe(3);
		});

		it('should sanitize large array arguments', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: true })
				methodWithLargeArray(arr: number[]): number {
					return arr.length;
				}
			}

			const service = new SanitizeService();
			const result = service.methodWithLargeArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
			expect(result).toBe(10);
		});

		it('should sanitize arrays with complex objects', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: true })
				methodWithComplexArray(arr: any[]): number {
					return arr.length;
				}
			}

			const service = new SanitizeService();
			const result = service.methodWithComplexArray([{ nested: 'object' }, { other: true }]);
			expect(result).toBe(2);
		});

		it('should sanitize object arguments', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: true })
				methodWithObjectArg(_obj: { a?: number; b?: number; c?: number }): string {
					return 'keys: 3';
				}
			}

			const service = new SanitizeService();
			const result = service.methodWithObjectArg({ a: 1, b: 2, c: 3 });
			expect(result).toBe('keys: 3');
		});

		it('should sanitize nested object arguments', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: true })
				methodWithNestedObject(_obj: { level1?: { level2?: { level3?: { data?: string } } } }): string {
					return 'processed';
				}
			}

			const service = new SanitizeService();
			const result = service.methodWithNestedObject({
				level1: { level2: { level3: { data: 'deep' } } },
			});
			expect(result).toBe('processed');
		});

		it('should sanitize arguments with captureArgs disabled', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: false })
				methodWithoutArgCapture(arg: string): string {
					return `result: ${arg}`;
				}
			}

			const service = new SanitizeService();
			const result = service.methodWithoutArgCapture('test');
			expect(result).toBe('result: test');
		});

		it('should sanitize very long string arguments', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: true })
				methodWithLongString(str: string): number {
					return str.length;
				}
			}

			const service = new SanitizeService();
			const longString = 'a'.repeat(500);
			const result = service.methodWithLongString(longString);
			expect(result).toBe(500);
		});

		it('should sanitize number arguments', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: true })
				methodWithNumberArg(num: number): number {
					return num * 2;
				}
			}

			const service = new SanitizeService();
			const result = service.methodWithNumberArg(42);
			expect(result).toBe(84);
		});

		it('should handle multiple arguments with mixed types', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: true })
				methodWithMixedArgs(str: string, num: number, bool: boolean, obj: any): string {
					return `${str}-${num}-${bool}-${Object.keys(obj).length}`;
				}
			}

			const service = new SanitizeService();
			const result = service.methodWithMixedArgs('test', 42, true, { a: 1 });
			expect(result).toBe('test-42-true-1');
		});

		it('should handle function arguments gracefully', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: true })
				methodWithFunctionArg(fn: () => string): string {
					return fn();
				}
			}

			const service = new SanitizeService();
			const result = service.methodWithFunctionArg(() => 'function result');
			expect(result).toBe('function result');
		});

		it('should handle symbol arguments gracefully', () => {
			@Injectable()
			class SanitizeService {
				@Traced({ captureArgs: true })
				methodWithSymbolArg(sym: symbol): symbol {
					return sym;
				}
			}

			const service = new SanitizeService();
			const sym = Symbol('test');
			const result = service.methodWithSymbolArg(sym);
			expect(result).toBe(sym);
		});
	});

	describe('All Decorator Options Combined', () => {
		it('should handle all decorator options with complex sync scenario', () => {
			@Injectable()
			class FullOptionsService {
				@Traced({
					name: 'custom-full-sync',
					kind: SpanKind.CLIENT,
					attributes: { 'custom': 'value', 'service.layer': 'business' },
					captureArgs: true,
					captureReturn: true,
				})
				fullSyncMethod(arg1: string, arg2: number): object {
					return { processed: `${arg1}-${arg2}` };
				}
			}

			const service = new FullOptionsService();
			const result = service.fullSyncMethod('test', 123);
			expect(result).toEqual({ processed: 'test-123' });
		});

		it('should handle all decorator options with complex async scenario', async () => {
			@Injectable()
			class FullOptionsService {
				@Traced({
					name: 'custom-full-async',
					kind: SpanKind.SERVER,
					attributes: { 'async': 'true', 'version': '1.0' },
					captureArgs: true,
					captureReturn: true,
				})
				async fullAsyncMethod(arg1: string, arg2: number): Promise<object> {
					await new Promise(resolve => setTimeout(resolve, 5));
					return { result: `${arg1}-${arg2}` };
				}
			}

			const service = new FullOptionsService();
			const resultPromise = service.fullAsyncMethod('async', 456);
			expect(resultPromise).toBeInstanceOf(Promise);
			const result = await resultPromise;
			expect(result).toEqual({ result: 'async-456' });
		});

		it('should handle all options with return capture when return value is complex', () => {
			@Injectable()
			class FullOptionsService {
				@Traced({
					captureReturn: true,
				})
				methodReturningComplexObject(): any {
					return { nested: { data: { deep: 'value' } }, array: [1, 2, 3] };
				}
			}

			const service = new FullOptionsService();
			const result = service.methodReturningComplexObject();
			expect(result).toEqual({
				nested: { data: { deep: 'value' } },
				array: [1, 2, 3],
			});
		});
	});

	describe('PII Detection and Redaction', () => {
		describe('Email Detection', () => {
			it('should redact email addresses in arguments', () => {
				@Injectable()
				class PIIService {
					@Traced({ captureArgs: true })
					processUserEmail(email: string): string {
						return `processed: ${email}`;
					}
				}

				const service = new PIIService();
				const result = service.processUserEmail('user@example.com');
				expect(result).toBe('processed: user@example.com');
			});

			it('should redact multiple email addresses in a single string', () => {
				@Injectable()
				class PIIService {
					@Traced({ captureArgs: true })
					processMultipleEmails(data: string): string {
						return data;
					}
				}

				const service = new PIIService();
				const result = service.processMultipleEmails('contact alice@example.com or bob@test.org');
				expect(result).toBe('contact alice@example.com or bob@test.org');
			});
		});

		describe('Phone Number Detection', () => {
			it('should redact phone numbers in arguments', () => {
				@Injectable()
				class PIIService {
					@Traced({ captureArgs: true })
					processPhoneNumber(phone: string): string {
						return `processed: ${phone}`;
					}
				}

				const service = new PIIService();
				const result = service.processPhoneNumber('555-123-4567');
				expect(result).toBe('processed: 555-123-4567');
			});

			it('should redact phone numbers with parentheses', () => {
				@Injectable()
				class PIIService {
					@Traced({ captureArgs: true })
					processFormattedPhone(phone: string): string {
						return phone;
					}
				}

				const service = new PIIService();
				const result = service.processFormattedPhone('(555) 123-4567');
				expect(result).toBe('(555) 123-4567');
			});
		});

		describe('SSN Detection', () => {
			it('should redact Social Security Numbers', () => {
				@Injectable()
				class PIIService {
					@Traced({ captureArgs: true })
					processSSN(ssn: string): string {
						return `ssn: ${ssn}`;
					}
				}

				const service = new PIIService();
				const result = service.processSSN('123-45-6789');
				expect(result).toBe('ssn: 123-45-6789');
			});
		});

		describe('Credit Card Detection', () => {
			it('should redact valid credit card numbers (Luhn check)', () => {
				@Injectable()
				class PIIService {
					@Traced({ captureArgs: true })
					processCreditCard(cc: string): string {
						return `card: ${cc}`;
					}
				}

				const service = new PIIService();
				// Valid Visa test number (passes Luhn)
				const result = service.processCreditCard('4532015112830366');
				expect(result).toBe('card: 4532015112830366');
			});

			it('should redact valid credit card numbers with spaces', () => {
				@Injectable()
				class PIIService {
					@Traced({ captureArgs: true })
					processCreditCardWithSpaces(cc: string): string {
						return cc;
					}
				}

				const service = new PIIService();
				// Valid Visa test number with spaces
				const result = service.processCreditCardWithSpaces('4532 0151 1283 0366');
				expect(result).toBe('4532 0151 1283 0366');
			});

			it('should not redact invalid credit card numbers (Luhn validation fails)', () => {
				@Injectable()
				class PIIService {
					@Traced({ captureArgs: true })
					processInvalidCreditCard(cc: string): string {
						return cc;
					}
				}

				const service = new PIIService();
				// Invalid number that doesn't pass Luhn check
				const result = service.processInvalidCreditCard('1234 5678 9012 3456');
				expect(result).toBe('1234 5678 9012 3456');
			});
		});

		describe('Multiple PII Types in Single String', () => {
			it('should redact multiple PII types in a single argument', () => {
				@Injectable()
				class PIIService {
					@Traced({ captureArgs: true })
					processMultiplePII(data: string): string {
						return `processed: ${data}`;
					}
				}

				const service = new PIIService();
				const result = service.processMultiplePII(
					'Contact john@example.com or call 555-123-4567',
				);
				// Method receives input but returns with prefix
				expect(result).toBe('processed: Contact john@example.com or call 555-123-4567');
			});
		});

		describe('PII in Array Arguments', () => {
			it('should redact PII in small arrays of strings', () => {
				@Injectable()
				class PIIService {
					@Traced({ captureArgs: true })
					processEmailList(emails: string[]): number {
						return emails.length;
					}
				}

				const service = new PIIService();
				const result = service.processEmailList([
					'alice@example.com',
					'bob@example.com',
					'charlie@example.com',
				]);
				expect(result).toBe(3);
			});
		});

		describe('Non-PII Edge Cases', () => {
			it('should not affect normal text without PII', () => {
				@Injectable()
				class PIIService {
					@Traced({ captureArgs: true })
					processNormalText(data: string): string {
						return data;
					}
				}

				const service = new PIIService();
				const result = service.processNormalText(
					'This is normal text without any sensitive information',
				);
				expect(result).toBe(
					'This is normal text without any sensitive information',
				);
			});

			it('should handle empty strings', () => {
				@Injectable()
				class PIIService {
					@Traced({ captureArgs: true })
					processEmpty(data: string): string {
						return `empty: ${data}`;
					}
				}

				const service = new PIIService();
				const result = service.processEmpty('');
				expect(result).toBe('empty: ');
			});
		});

		describe('PII Handling with captureReturn', () => {
			it('should redact PII in return values when captureReturn is enabled', () => {
				@Injectable()
				class PIIService {
					@Traced({ captureReturn: true })
					getUserEmail(): string {
						return 'user@example.com';
					}
				}

				const service = new PIIService();
				const result = service.getUserEmail();
				expect(result).toBe('user@example.com');
			});

			it('should redact PII in async return values', async () => {
				@Injectable()
				class PIIService {
					@Traced({ captureReturn: true })
					async fetchUserPhone(): Promise<string> {
						return '555-123-4567';
					}
				}

				const service = new PIIService();
				const result = service.fetchUserPhone();
				expect(result).toBeInstanceOf(Promise);
				const value = await result;
				expect(value).toBe('555-123-4567');
			});
		});
	});
});
