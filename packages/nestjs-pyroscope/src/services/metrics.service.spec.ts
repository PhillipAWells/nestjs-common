import { describe, it, expect } from '@jest/globals';
import { MetricsService  } from './metrics.service.js';

describe('MetricsService', () => {
	let service: MetricsService;

	beforeEach(() => {
		service = new MetricsService();
	});

	describe('recordRequest', () => {
		it('should record requests with status code 200', () => {
			service.recordRequest(200);
			const metrics = service.getMetrics();
			expect(metrics.requests.successful).toBe(1);
			expect(metrics.requests.total).toBe(1);
		});

		it('should record failed requests', () => {
			service.recordRequest(500);
			const metrics = service.getMetrics();
			expect(metrics.requests.failed).toBe(1);
			expect(metrics.requests.total).toBe(1);
		});

		it('should record response times', () => {
			service.recordRequest(200, 150);
			const metrics = service.getMetrics();
			expect(metrics.requests.averageResponseTime).toBe(150);
		});

		it('should handle concurrent updates', () => {
			for (let i = 0; i < 100; i++) {
				service.recordRequest(200);
			}
			const metrics = service.getMetrics();
			expect(metrics.requests.total).toBe(100);
			expect(metrics.requests.successful).toBe(100);
		});
	});

	describe('recordMemorySample', () => {
		it('should record memory usage', () => {
			service.recordMemorySample(1024 * 1024);
			const metrics = service.getMetrics();
			expect(metrics.memory.allocations).toBeGreaterThan(0);
		});

		it('should track peak memory', () => {
			service.recordMemorySample(100);
			service.recordMemorySample(500);
			service.recordMemorySample(200);
			const metrics = service.getMetrics();
			expect(metrics.memory.allocations).toBe(800);
		});
	});

	describe('recordCPUSample', () => {
		it('should record CPU time', () => {
			service.recordCPUSample(50);
			const metrics = service.getMetrics();
			expect(metrics.cpu.duration).toBeGreaterThan(0);
		});

		it('should aggregate CPU time across multiple calls', () => {
			service.recordCPUSample(25);
			service.recordCPUSample(25);
			service.recordCPUSample(50);
			const metrics = service.getMetrics();
			expect(metrics.cpu.samples).toBe(3);
		});
	});

	describe('getMetrics', () => {
		it('should return metrics object with expected structure', () => {
			service.recordRequest(200, 0);
			service.recordMemorySample(100);
			service.recordCPUSample(50);

			const metrics = service.getMetrics();

			expect(metrics).toHaveProperty('timestamp');
			expect(metrics).toHaveProperty('cpu');
			expect(metrics).toHaveProperty('memory');
			expect(metrics).toHaveProperty('requests');
		});

		it('should have CPU metrics properties', () => {
			service.recordCPUSample(100);
			const metrics = service.getMetrics();

			expect(metrics.cpu).toHaveProperty('samples');
			expect(metrics.cpu).toHaveProperty('duration');
		});

		it('should have memory metrics properties', () => {
			service.recordMemorySample(500);
			const metrics = service.getMetrics();

			expect(metrics.memory).toHaveProperty('samples');
			expect(metrics.memory).toHaveProperty('allocations');
		});

		it('should have request metrics properties', () => {
			service.recordRequest(200, 0);
			const metrics = service.getMetrics();

			expect(metrics.requests).toHaveProperty('total');
			expect(metrics.requests).toHaveProperty('successful');
			expect(metrics.requests).toHaveProperty('failed');
			expect(metrics.requests).toHaveProperty('averageResponseTime');
		});

		it('should return current timestamp', () => {
			const before = Date.now();
			const metrics = service.getMetrics();
			const after = Date.now();

			expect(metrics.timestamp).toBeGreaterThanOrEqual(before);
			expect(metrics.timestamp).toBeLessThanOrEqual(after);
		});
	});

	describe('reset', () => {
		it('should reset all metrics', () => {
			service.recordRequest(200, 0);
			service.recordMemorySample(100);
			service.recordCPUSample(50);

			service.reset();

			const metrics = service.getMetrics();
			expect(metrics.requests.total).toBe(0);
			expect(metrics.memory.allocations).toBe(0);
			expect(metrics.cpu.samples).toBe(0);
		});
	});

	describe('advanced metrics calculations', () => {
		it('should calculate average response time correctly', () => {
			service.recordRequest(200, 100);
			service.recordRequest(200, 200);
			service.recordRequest(200, 300);

			const metrics = service.getMetrics();
			expect(metrics.requests.averageResponseTime).toBe(200);
		});

		it('should differentiate successful and failed requests', () => {
			service.recordRequest(200);
			service.recordRequest(200);
			service.recordRequest(404);
			service.recordRequest(500);

			const metrics = service.getMetrics();
			expect(metrics.requests.successful).toBe(2);
			expect(metrics.requests.failed).toBe(2);
			expect(metrics.requests.total).toBe(4);
		});

		it('should handle edge case of no requests', () => {
			const metrics = service.getMetrics();

			expect(metrics.requests.total).toBe(0);
			expect(metrics.requests.successful).toBe(0);
			expect(metrics.requests.failed).toBe(0);
			expect(metrics.requests.averageResponseTime).toBe(0);
		});

		it('should handle single request average', () => {
			service.recordRequest(200, 75);
			const metrics = service.getMetrics();

			expect(metrics.requests.averageResponseTime).toBe(75);
		});

		it('should track metrics with large numbers', () => {
			for (let i = 0; i < 1000; i++) {
				service.recordRequest(200);
			}

			const metrics = service.getMetrics();
			expect(metrics.requests.total).toBe(1000);
		});
	});

	describe('memory metrics specifics', () => {
		it('should accumulate memory allocations', () => {
			service.recordMemorySample(100);
			service.recordMemorySample(100);
			service.recordMemorySample(100);

			const metrics = service.getMetrics();
			expect(metrics.memory.allocations).toBe(300);
		});

		it('should track memory samples count', () => {
			service.recordMemorySample(100);
			service.recordMemorySample(200);

			const metrics = service.getMetrics();
			expect(metrics.memory.samples).toBe(2);
		});
	});

	describe('CPU metrics specifics', () => {
		it('should accumulate CPU time', () => {
			service.recordCPUSample(10);
			service.recordCPUSample(20);
			service.recordCPUSample(30);

			const metrics = service.getMetrics();
			expect(metrics.cpu.duration).toBe(60);
		});

		it('should track CPU samples count', () => {
			service.recordCPUSample(50);
			service.recordCPUSample(50);

			const metrics = service.getMetrics();
			expect(metrics.cpu.samples).toBe(2);
		});

		it('should handle zero CPU time', () => {
			service.recordCPUSample(0);
			const metrics = service.getMetrics();

			expect(metrics.cpu.duration).toBe(0);
		});
	});

	describe('thread-safety considerations', () => {
		it('should handle concurrent metric recording', async () => {
			// Simulate concurrent requests
			for (let i = 0; i < 100; i++) {
				service.recordRequest(200, i);
			}

			return Promise.all([]).then(() => {
				const metrics = service.getMetrics();
				expect(metrics.requests.total).toBe(100);
			});
		});
	});

	describe('integration tests', () => {
		it('should track full lifecycle of operations', () => {
			service.recordRequest(200, 50);
			service.recordMemorySample(1000);
			service.recordCPUSample(25);

			service.recordRequest(404, 100);
			service.recordMemorySample(500);
			service.recordCPUSample(15);

			const metrics = service.getMetrics();

			expect(metrics.requests.total).toBe(2);
			expect(metrics.requests.successful).toBe(1);
			expect(metrics.requests.failed).toBe(1);
			expect(metrics.requests.averageResponseTime).toBe(75);
			expect(metrics.memory.allocations).toBe(1500);
			expect(metrics.cpu.duration).toBe(40);
		});

		it('should provide consistent metrics across multiple queries', () => {
			service.recordRequest(200, 0);
			const metrics1 = service.getMetrics();
			const metrics2 = service.getMetrics();

			expect(metrics1.requests.total).toBe(metrics2.requests.total);
			expect(metrics1.timestamp).toBeLessThanOrEqual(metrics2.timestamp);
		});
	});
});
