/**
 * Unit Tests for Tracing Helpers
 *
 * Tests getTracer, setTracerNamespace, and other tracing utility functions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeOpenTelemetry, shutdownOpenTelemetry, isInitialized } from '../helpers/otel-setup.js';
import type { OpenTelemetryConfig } from '../helpers/otel-setup.js';
import { getTracer, setTracerNamespace, resetTracerNamespace, createSpan, withSpan, addAttributes } from '../../lib/tracing.js';

describe('Tracing Helpers', () => {
	let testConfig: OpenTelemetryConfig;

	beforeAll(async () => {
		testConfig = {
			serviceName: 'tracing-helpers-test',
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
			console.debug('OpenTelemetry initialization skipped for tests:', error instanceof Error ? error.message : String(error));
		}
	});

	afterAll(async () => {
		if (isInitialized()) {
			try {
				await shutdownOpenTelemetry();
			} catch {
				console.log('Skipping OpenTelemetry shutdown - collector not available');
			}
		}
	});

	describe('getTracer', () => {
		it('should get a tracer with default namespace', () => {
			const tracer = getTracer('user-service');
			expect(tracer).toBeDefined();
			// Tracer name should be prefixed with namespace
			expect(tracer).toBeTruthy();
		});

		it('should get a tracer with custom version', () => {
			const tracer = getTracer('order-service', '1.2.3');
			expect(tracer).toBeDefined();
		});
	});

	describe('setTracerNamespace and resetTracerNamespace', () => {
		it('should set a custom namespace for tracer names', () => {
			// First, set a custom namespace
			setTracerNamespace('custom-namespace');

			// Get a tracer - it should use the custom namespace
			const tracer = getTracer('service-name');
			expect(tracer).toBeDefined();

			// Reset back to default
			resetTracerNamespace();
		});

		it('should reset tracer namespace to default', () => {
			setTracerNamespace('temporary-namespace');
			// Namespace is set to 'temporary-namespace'

			resetTracerNamespace();
			// After reset, subsequent tracers should use default namespace

			const tracer = getTracer('service-name');
			expect(tracer).toBeDefined();
		});

		it('should allow empty namespace', () => {
			setTracerNamespace('');

			const tracer = getTracer('service-name');
			expect(tracer).toBeDefined();

			resetTracerNamespace();
		});
	});

	describe('createSpan', () => {
		it('should create a span with the given name', () => {
			const tracer = getTracer('test-service');
			const { span, ctx } = createSpan(tracer, 'test-span');

			expect(span).toBeDefined();
			expect(ctx).toBeDefined();
			span.end();
		});

		it('should create a span with custom options', () => {
			const tracer = getTracer('test-service');
			const { span, ctx } = createSpan(tracer, 'test-span', {
				attributes: { 'test.key': 'test.value' },
			});

			expect(span).toBeDefined();
			expect(ctx).toBeDefined();
			span.end();
		});

		it('should create a span without making it active', () => {
			const tracer = getTracer('test-service');
			const { span, ctx } = createSpan(tracer, 'test-span', undefined, false);

			expect(span).toBeDefined();
			expect(ctx).toBeDefined();
			span.end();
		});
	});

	describe('withSpan', () => {
		it('should execute a sync function within a span', async () => {
			const tracer = getTracer('test-service');

			const result = await withSpan(tracer, 'test-operation', () => 'sync-result');
			expect(result).toBe('sync-result');
		});

		it('should execute an async function within a span', async () => {
			const tracer = getTracer('test-service');

			const result = await withSpan(tracer, 'test-operation', async () => {
				await new Promise(resolve => setTimeout(resolve, 5));
				return 'async-result';
			});
			expect(result).toBe('async-result');
		});

		it('should handle errors in sync functions', async () => {
			const tracer = getTracer('test-service');

			await expect(
				withSpan(tracer, 'test-operation', () => {
					throw new Error('Test error');
				}),
			).rejects.toThrow('Test error');
		});

		it('should handle errors in async functions', async () => {
			const tracer = getTracer('test-service');

			await expect(
				withSpan(tracer, 'test-operation', async () => {
					throw new Error('Test async error');
				}),
			).rejects.toThrow('Test async error');
		});

		it('should execute function with span options', async () => {
			const tracer = getTracer('test-service');

			const result = await withSpan(
				tracer,
				'test-operation',
				() => 'result-with-options',
				{
					attributes: { 'test.attribute': 'value' },
				},
			);
			expect(result).toBe('result-with-options');
		});
	});

	describe('addAttributes', () => {
		it('should add attributes to the active span', () => {
			// This test verifies that addAttributes doesn't throw
			// when called without an active span (graceful degradation)
			expect(() => {
				addAttributes({
					'test.key': 'value',
					'test.number': 42,
					'test.boolean': true,
				});
			}).not.toThrow();
		});

		it('should handle empty attributes object', () => {
			expect(() => {
				addAttributes({});
			}).not.toThrow();
		});

		it('should handle mixed attribute types', () => {
			expect(() => {
				addAttributes({
					'string.attr': 'test-value',
					'number.attr': 123,
					'bool.attr': false,
					'negative.number': -42,
					'large.number': 999999999,
				});
			}).not.toThrow();
		});
	});

	describe('integration tests', () => {
		it('should execute nested spans correctly', async () => {
			const tracer = getTracer('nested-test');

			const result = await withSpan(tracer, 'outer-span', async () => {
				const innerResult = await withSpan(tracer, 'inner-span', async () => {
					return 'nested-result';
				});
				return innerResult;
			});

			expect(result).toBe('nested-result');
		});

		it('should handle namespace changes correctly', async () => {
			const originalTracer = getTracer('service-before');
			expect(originalTracer).toBeDefined();

			setTracerNamespace('custom');
			const customTracer = getTracer('service-custom');
			expect(customTracer).toBeDefined();

			resetTracerNamespace();
			const restoredTracer = getTracer('service-after');
			expect(restoredTracer).toBeDefined();
		});
	});
});
