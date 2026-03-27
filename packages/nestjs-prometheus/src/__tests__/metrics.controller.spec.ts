import { describe, it, expect, vi, beforeEach } from 'vitest';

// Setup mocks before importing
const mockExporter = {
	getMetrics: vi.fn().mockResolvedValue('# HELP test Test\n# TYPE test gauge'),
};

vi.mock('prom-client', () => ({
	Registry: class {
		metrics = vi.fn().mockResolvedValue('# HELP test Test\n# TYPE test gauge');
		clear = vi.fn();
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

import { MetricsController } from '../controllers/metrics.controller.js';

describe('MetricsController', () => {
	let controller: MetricsController;
	let mockResponse: any;

	beforeEach(() => {
		vi.clearAllMocks();
		mockExporter.getMetrics.mockResolvedValue('# HELP test Test\n# TYPE test gauge');
		controller = new MetricsController(mockExporter as any);
		mockResponse = {
			send: vi.fn(),
		};
	});

	describe('getMetrics', () => {
		it('should call exporter.getMetrics', async () => {
			await controller.getMetrics(mockResponse);

			expect(mockExporter.getMetrics).toHaveBeenCalled();
		});

		it('should send metrics in response', async () => {
			const expectedMetrics = '# HELP test Test\n# TYPE test gauge';
			mockExporter.getMetrics.mockResolvedValue(expectedMetrics);

			await controller.getMetrics(mockResponse);

			expect(mockResponse.send).toHaveBeenCalledWith(expectedMetrics);
		});

		it('should return void', async () => {
			const result = await controller.getMetrics(mockResponse);

			expect(result).toBeUndefined();
		});
	});
});
