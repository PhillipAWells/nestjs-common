import { describe, it, expect, vi, beforeEach } from 'vitest';

// Setup mocks before importing
const mockRegistry = {
	metrics: vi.fn().mockResolvedValue('# HELP test Test\n# TYPE test gauge'),
	clear: vi.fn(),
};

vi.mock('prom-client', () => ({
	Registry: class {
		metrics = mockRegistry.metrics;
		clear = mockRegistry.clear;
	},
	Counter: class {
		inc = vi.fn();
	},
	Histogram: class {
		observe = vi.fn();
	},
	Gauge: class {
		set = vi.fn();
	},
	collectDefaultMetrics: vi.fn(),
}));

vi.mock('@pawells/nestjs-shared', () => ({
	InstrumentationRegistry: class {
		registerExporter = vi.fn();
	},
	MetricsGuard: class {
		canActivate = vi.fn().mockReturnValue(true);
	},
}));

import { PrometheusModule } from '../prometheus.module.js';
import { PrometheusExporter } from '../prometheus.exporter.js';
import { InstrumentationRegistry } from '@pawells/nestjs-shared';

describe('PrometheusModule', () => {
	let module: PrometheusModule;
	let exporter: PrometheusExporter;
	let mockRegistry2: any;

	beforeEach(() => {
		vi.clearAllMocks();
		mockRegistry2 = new (InstrumentationRegistry as any)();
		exporter = new PrometheusExporter();
		module = new PrometheusModule(exporter, mockRegistry2);
	});

	describe('forRoot', () => {
		it('should return a module config', () => {
			const config = PrometheusModule.forRoot();

			expect(config).toBeDefined();
			expect(config.module).toBe(PrometheusModule);
			expect(config.global).toBe(true);
		});
	});

	describe('onModuleInit', () => {
		it('should register exporter with the registry on onModuleInit', () => {
			module.onModuleInit();

			expect(mockRegistry2.registerExporter).toHaveBeenCalledWith(exporter);
		});
	});
});
