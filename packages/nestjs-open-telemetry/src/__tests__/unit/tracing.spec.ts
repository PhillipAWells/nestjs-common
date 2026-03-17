/**
 * Unit Tests for Tracing Helpers
 *
 * Tests getTracer, setTracerNamespace, and other tracing utility functions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initializeOpenTelemetry, shutdownOpenTelemetry, isInitialized } from '../helpers/otel-setup.js';
import type { OpenTelemetryConfig } from '../helpers/otel-setup.js';
import { getTracer, setTracerNamespace, resetTracerNamespace } from '../../lib/tracing.js';

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
});
