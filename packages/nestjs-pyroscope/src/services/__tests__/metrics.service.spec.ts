import { MetricsService  } from '../metrics.service.js';

describe('MetricsService', () => {
	let service: MetricsService;

	beforeEach(() => {
		service = new MetricsService();
	});

	describe('recordRequest', () => {
		it('should record requests with status code 200', () => {
			service.RecordRequest(200, 0);
			const metrics = service.GetMetrics();
			expect(metrics.requests.successful).toBe(1);
			expect(metrics.requests.total).toBe(1);
		});

		it('should record failed requests', () => {
			service.RecordRequest(500, 0);
			const metrics = service.GetMetrics();
			expect(metrics.requests.failed).toBe(1);
			expect(metrics.requests.total).toBe(1);
		});

		it('should record response times', () => {
			service.RecordRequest(200, 150);
			const metrics = service.GetMetrics();
			expect(metrics.requests.averageResponseTime).toBe(150);
		});

		it('should handle concurrent updates', () => {
			for (let i = 0; i < 100; i++) {
				service.RecordRequest(200, 0);
			}
			const metrics = service.GetMetrics();
			expect(metrics.requests.total).toBe(100);
			expect(metrics.requests.successful).toBe(100);
		});
	});

	describe('recordMemorySample', () => {
		it('should record memory usage', () => {
			service.RecordMemorySample(1024 * 1024);
			const metrics = service.GetMetrics();
			expect(metrics.memory.allocations).toBeGreaterThan(0);
		});

		it('should track peak memory', () => {
			service.RecordMemorySample(100);
			service.RecordMemorySample(500);
			service.RecordMemorySample(200);
			const metrics = service.GetMetrics();
			expect(metrics.memory.allocations).toBe(800);
		});
	});

	describe('recordCPUSample', () => {
		it('should record CPU time', () => {
			service.RecordCPUSample(50);
			const metrics = service.GetMetrics();
			expect(metrics.cpu.duration).toBeGreaterThan(0);
		});

		it('should aggregate CPU time across multiple calls', () => {
			service.RecordCPUSample(25);
			service.RecordCPUSample(25);
			service.RecordCPUSample(50);
			const metrics = service.GetMetrics();
			expect(metrics.cpu.samples).toBe(3);
		});
	});

	describe('getMetrics', () => {
		it('should return metrics object with expected structure', () => {
			service.RecordRequest(200, 0);
			service.RecordMemorySample(100);
			service.RecordCPUSample(50);

			const metrics = service.GetMetrics();

			expect(metrics).toHaveProperty('timestamp');
			expect(metrics).toHaveProperty('cpu');
			expect(metrics).toHaveProperty('memory');
			expect(metrics).toHaveProperty('requests');
		});

		it('should have CPU metrics properties', () => {
			service.RecordCPUSample(100);
			const metrics = service.GetMetrics();

			expect(metrics.cpu).toHaveProperty('samples');
			expect(metrics.cpu).toHaveProperty('duration');
		});

		it('should have memory metrics properties', () => {
			service.RecordMemorySample(500);
			const metrics = service.GetMetrics();

			expect(metrics.memory).toHaveProperty('samples');
			expect(metrics.memory).toHaveProperty('allocations');
		});

		it('should have request metrics properties', () => {
			service.RecordRequest(200, 0);
			const metrics = service.GetMetrics();

			expect(metrics.requests).toHaveProperty('total');
			expect(metrics.requests).toHaveProperty('successful');
			expect(metrics.requests).toHaveProperty('failed');
			expect(metrics.requests).toHaveProperty('averageResponseTime');
		});

		it('should return current timestamp', () => {
			const before = Date.now();
			const metrics = service.GetMetrics();
			const after = Date.now();

			expect(metrics.timestamp).toBeGreaterThanOrEqual(before);
			expect(metrics.timestamp).toBeLessThanOrEqual(after);
		});
	});

	describe('reset', () => {
		it('should reset all metrics', () => {
			service.RecordRequest(200, 0);
			service.RecordMemorySample(100);
			service.RecordCPUSample(50);

			service.Reset();

			const metrics = service.GetMetrics();
			expect(metrics.requests.total).toBe(0);
			expect(metrics.memory.allocations).toBe(0);
			expect(metrics.cpu.samples).toBe(0);
		});
	});

	describe('advanced metrics calculations', () => {
		it('should calculate average response time correctly', () => {
			service.RecordRequest(200, 100);
			service.RecordRequest(200, 200);
			service.RecordRequest(200, 300);

			const metrics = service.GetMetrics();
			expect(metrics.requests.averageResponseTime).toBe(200);
		});

		it('should differentiate successful and failed requests', () => {
			service.RecordRequest(200, 0);
			service.RecordRequest(200, 0);
			service.RecordRequest(404, 0);
			service.RecordRequest(500, 0);

			const metrics = service.GetMetrics();
			expect(metrics.requests.successful).toBe(2);
			expect(metrics.requests.failed).toBe(2);
			expect(metrics.requests.total).toBe(4);
		});

		it('should classify redirects as successful requests', () => {
			service.RecordRequest(200, 0);
			service.RecordRequest(301, 0);
			service.RecordRequest(302, 0);
			service.RecordRequest(307, 0);
			service.RecordRequest(404, 0);

			const metrics = service.GetMetrics();
			expect(metrics.requests.successful).toBe(4);
			expect(metrics.requests.failed).toBe(1);
			expect(metrics.requests.total).toBe(5);
		});

		it('should handle edge case of no requests', () => {
			const metrics = service.GetMetrics();

			expect(metrics.requests.total).toBe(0);
			expect(metrics.requests.successful).toBe(0);
			expect(metrics.requests.failed).toBe(0);
			expect(metrics.requests.averageResponseTime).toBe(0);
		});

		it('should handle single request average', () => {
			service.RecordRequest(200, 75);
			const metrics = service.GetMetrics();

			expect(metrics.requests.averageResponseTime).toBe(75);
		});

		it('should track metrics with large numbers', () => {
			for (let i = 0; i < 1000; i++) {
				service.RecordRequest(200, 0);
			}

			const metrics = service.GetMetrics();
			expect(metrics.requests.total).toBe(1000);
		});
	});

	describe('memory metrics specifics', () => {
		it('should accumulate memory allocations', () => {
			service.RecordMemorySample(100);
			service.RecordMemorySample(100);
			service.RecordMemorySample(100);

			const metrics = service.GetMetrics();
			expect(metrics.memory.allocations).toBe(300);
		});

		it('should track memory samples count', () => {
			service.RecordMemorySample(100);
			service.RecordMemorySample(200);

			const metrics = service.GetMetrics();
			expect(metrics.memory.samples).toBe(2);
		});
	});

	describe('CPU metrics specifics', () => {
		it('should accumulate CPU time', () => {
			service.RecordCPUSample(10);
			service.RecordCPUSample(20);
			service.RecordCPUSample(30);

			const metrics = service.GetMetrics();
			expect(metrics.cpu.duration).toBe(60);
		});

		it('should track CPU samples count', () => {
			service.RecordCPUSample(50);
			service.RecordCPUSample(50);

			const metrics = service.GetMetrics();
			expect(metrics.cpu.samples).toBe(2);
		});

		it('should handle zero CPU time', () => {
			service.RecordCPUSample(0);
			const metrics = service.GetMetrics();

			expect(metrics.cpu.duration).toBe(0);
		});
	});

	describe('thread-safety considerations', () => {
		it('should handle concurrent metric recording', async () => {
			// Simulate concurrent requests
			for (let i = 0; i < 100; i++) {
				service.RecordRequest(200, i);
			}

			return Promise.all([]).then(() => {
				const metrics = service.GetMetrics();
				expect(metrics.requests.total).toBe(100);
			});
		});
	});

	describe('integration tests', () => {
		it('should track full lifecycle of operations', () => {
			service.RecordRequest(200, 50);
			service.RecordMemorySample(1000);
			service.RecordCPUSample(25);

			service.RecordRequest(404, 100);
			service.RecordMemorySample(500);
			service.RecordCPUSample(15);

			const metrics = service.GetMetrics();

			expect(metrics.requests.total).toBe(2);
			expect(metrics.requests.successful).toBe(1);
			expect(metrics.requests.failed).toBe(1);
			expect(metrics.requests.averageResponseTime).toBe(75);
			expect(metrics.memory.allocations).toBe(1500);
			expect(metrics.cpu.duration).toBe(40);
		});

		it('should provide consistent metrics across multiple queries', () => {
			service.RecordRequest(200, 0);
			const metrics1 = service.GetMetrics();
			const metrics2 = service.GetMetrics();

			expect(metrics1.requests.total).toBe(metrics2.requests.total);
			expect(metrics1.timestamp).toBeLessThanOrEqual(metrics2.timestamp);
		});
	});
});
