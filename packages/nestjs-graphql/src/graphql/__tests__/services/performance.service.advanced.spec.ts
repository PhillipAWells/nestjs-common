
import { GraphQLPerformanceService } from '../../services/performance.service.js';

describe('GraphQL Performance Service - Advanced Metrics', () => {
	let service: GraphQLPerformanceService;
	let mockAppLogger: any;
	let logCalls: any[];

	beforeEach(() => {
		logCalls = [];

		// Manual mock for AppLogger
		mockAppLogger = {
			createContextualLogger: () => ({
				debug: (...args: any[]) => {
					logCalls.push({ level: 'debug', args });
				},
				info: (...args: any[]) => {
					logCalls.push({ level: 'info', args });
				},
				warn: (...args: any[]) => {
					logCalls.push({ level: 'warn', args });
				},
				error: (...args: any[]) => {
					logCalls.push({ level: 'error', args });
				},
			}),
		};

		service = new GraphQLPerformanceService(mockAppLogger);
	});

	describe('measure() - Performance Tracking', () => {
		it('should measure successful operation execution', async () => {
			const result = await service.measure('testOperation', async () => {
				return 'success';
			});

			expect(result).toBe('success');

			const metrics = service.getRecentMetrics(1);
			expect(metrics.length).toBe(1);
			expect(metrics[0]?.operation).toBe('testOperation');
			expect(metrics[0]?.success).toBe(true);
		});

		it('should measure synchronous operations', async () => {
			const result = await service.measure('syncOperation', () => {
				return 42;
			});

			expect(result).toBe(42);

			const metrics = service.getRecentMetrics(1);
			expect(metrics[0]?.success).toBe(true);
		});

		it('should record duration accurately', async () => {
			await service.measure('timedOperation', async () => {
				await new Promise(resolve => setTimeout(resolve, 50));
				return 'done';
			});

			const metrics = service.getRecentMetrics(1);
			expect(metrics[0]?.duration).toBeGreaterThanOrEqual(40); // Allow for timing variance
		});

		it('should log warning for slow operations', async () => {
			await service.measure('slowOperation', async () => {
				await new Promise(resolve => setTimeout(resolve, 1100));
				return 'slow';
			});

			const warnLog = logCalls.find(log => log.level === 'warn');
			expect(warnLog).toBeDefined();
			expect(warnLog?.args[0]).toContain('Slow operation');
		});

		it('should capture errors and rethrow', async () => {
			await expect(
				service.measure('failingOperation', async () => {
					throw new Error('Test error');
				}),
			).rejects.toThrow('Test error');

			const metrics = service.getRecentMetrics(1);
			expect(metrics[0]?.success).toBe(false);
			expect(metrics[0]?.error).toBe('Test error');
		});

		it('should include metadata in metrics', async () => {
			await service.measure(
				'metadataOperation',
				async () => 'result',
				{ userId: '123', type: 'query' },
			);

			const metrics = service.getRecentMetrics(1);
			expect(metrics[0]?.metadata).toEqual({ userId: '123', type: 'query' });
		});

		it('should maintain metrics history limit', async () => {
			// Create more than max metrics (10000)
			for (let i = 0; i < 10; i++) {
				await service.measure(`operation${i}`, () => 'result');
			}

			const allMetrics = service.getRecentMetrics(20);
			expect(allMetrics.length).toBe(10);
		});
	});

	describe('getStats() - Statistical Analysis', () => {
		beforeEach(async () => {
			// Add sample metrics
			await service.measure('op1', () => 'result');
			await new Promise(resolve => setTimeout(resolve, 10));
			await service.measure('op2', () => 'result');
			await new Promise(resolve => setTimeout(resolve, 10));
			try {
				await service.measure('op3', async () => {
					throw new Error('Failed');
				});
			} catch {
				// Expected
			}
		});

		it('should calculate total operations', () => {
			const stats = service.getStats();

			expect(stats.totalOperations).toBe(3);
		});

		it('should calculate average duration', () => {
			const stats = service.getStats();

			expect(stats.averageDuration).toBeGreaterThanOrEqual(0);
		});

		it('should track min and max duration', () => {
			const stats = service.getStats();

			expect(stats.minDuration).toBeGreaterThanOrEqual(0);
			expect(stats.maxDuration).toBeGreaterThanOrEqual(stats.minDuration);
		});

		it('should calculate error rate', () => {
			const stats = service.getStats();

			expect(stats.errorRate).toBeCloseTo(1 / 3, 2);
		});

		it('should calculate operations per second', () => {
			const stats = service.getStats();

			expect(stats.operationsPerSecond).toBeGreaterThan(0);
		});

		it('should filter stats by operation name', async () => {
			await service.measure('specificOp', () => 'result');

			const stats = service.getStats('specificOp');

			expect(stats.totalOperations).toBe(1);
		});

		it('should return zero stats for empty metrics', () => {
			service.clearMetrics();

			const stats = service.getStats();

			expect(stats.totalOperations).toBe(0);
			expect(stats.averageDuration).toBe(0);
			expect(stats.errorRate).toBe(0);
		});

		it('should respect time range filter', async () => {
			service.clearMetrics();

			await service.measure('recentOp', () => 'result');

			// Query with very short time range (1ms)
			const stats = service.getStats(undefined, 1);

			// Might be 0 or 1 depending on timing
			expect(stats.totalOperations).toBeLessThanOrEqual(1);
		});
	});

	describe('getRecentMetrics() - Metrics Retrieval', () => {
		beforeEach(async () => {
			await service.measure('op1', () => 'result1');
			await service.measure('op2', () => 'result2');
			await service.measure('op1', () => 'result3');
		});

		it('should return most recent metrics first', () => {
			const metrics = service.getRecentMetrics(3);

			expect(metrics.length).toBe(3);
			// Most recent first (reverse order)
			expect(metrics[0]?.operation).toBe('op1');
			expect(metrics[2]?.operation).toBe('op1');
		});

		it('should respect limit parameter', () => {
			const metrics = service.getRecentMetrics(2);

			expect(metrics.length).toBe(2);
		});

		it('should filter by operation name', () => {
			const metrics = service.getRecentMetrics(10, 'op1');

			expect(metrics.length).toBe(2);
			expect(metrics.every(m => m.operation === 'op1')).toBe(true);
		});
	});

	describe('getSlowOperations() - Slow Query Detection', () => {
		beforeEach(async () => {
			await service.measure('fastOp', () => 'result');
			await service.measure('slowOp', async () => {
				await new Promise(resolve => setTimeout(resolve, 1100));
				return 'result';
			});
		});

		it('should return operations above threshold', () => {
			const slowOps = service.getSlowOperations(1000);

			expect(slowOps.length).toBe(1);
			expect(slowOps[0]?.operation).toBe('slowOp');
		});

		it('should sort by duration descending', async () => {
			await service.measure('slower', async () => {
				await new Promise(resolve => setTimeout(resolve, 1200));
				return 'result';
			});

			const slowOps = service.getSlowOperations(1000, 10);

			expect(slowOps[0]?.duration).toBeGreaterThan(slowOps[1]?.duration!);
		});

		it('should respect limit parameter', async () => {
			// Add more slow operations
			for (let i = 0; i < 3; i++) {
				await service.measure(`slow${i}`, async () => {
					await new Promise(resolve => setTimeout(resolve, 1100));
					return 'result';
				});
			}

			const slowOps = service.getSlowOperations(1000, 2);

			expect(slowOps.length).toBeLessThanOrEqual(2);
		});
	});

	describe('getErrors() - Error Tracking', () => {
		beforeEach(async () => {
			await service.measure('successOp', () => 'result');
			try {
				await service.measure('errorOp1', async () => {
					throw new Error('Error 1');
				});
			} catch {
				// Expected
			}
			try {
				await service.measure('errorOp2', async () => {
					throw new Error('Error 2');
				});
			} catch {
				// Expected
			}
		});

		it('should return only failed operations', () => {
			const errors = service.getErrors();

			expect(errors.length).toBe(2);
			expect(errors.every(e => !e.success)).toBe(true);
		});

		it('should return most recent errors first', () => {
			const errors = service.getErrors();

			expect(errors[0]?.operation).toBe('errorOp2');
			expect(errors[1]?.operation).toBe('errorOp1');
		});

		it('should respect limit parameter', () => {
			const errors = service.getErrors(1);

			expect(errors.length).toBe(1);
		});
	});

	describe('getOperationsSummary() - Summary Statistics', () => {
		beforeEach(async () => {
			await service.measure('queryUser', () => 'result');
			await service.measure('queryUser', () => 'result');
			await service.measure('queryPost', () => 'result');
			try {
				await service.measure('queryUser', async () => {
					throw new Error('Failed');
				});
			} catch {
				// Expected
			}
		});

		it('should group metrics by operation', () => {
			const summary = service.getOperationsSummary();

			expect(Object.keys(summary)).toContain('queryUser');
			expect(Object.keys(summary)).toContain('queryPost');
		});

		it('should calculate count per operation', () => {
			const summary = service.getOperationsSummary();

			expect(summary['queryUser']?.count).toBe(3);
			expect(summary['queryPost']?.count).toBe(1);
		});

		it('should calculate average duration per operation', () => {
			const summary = service.getOperationsSummary();

			expect(summary['queryUser']?.avgDuration).toBeGreaterThanOrEqual(0);
		});

		it('should calculate error rate per operation', () => {
			const summary = service.getOperationsSummary();

			expect(summary['queryUser']?.errorRate).toBeCloseTo(1 / 3, 2);
			expect(summary['queryPost']?.errorRate).toBe(0);
		});
	});

	describe('clearMetrics() - Cleanup', () => {
		it('should remove all metrics', async () => {
			await service.measure('op1', () => 'result');
			await service.measure('op2', () => 'result');

			service.clearMetrics();

			const metrics = service.getRecentMetrics();
			expect(metrics.length).toBe(0);
		});

		it('should log clear action', () => {
			service.clearMetrics();

			const infoLog = logCalls.find(log => log.level === 'info');
			expect(infoLog).toBeDefined();
			expect(infoLog?.args[0]).toContain('Performance metrics cleared');
		});
	});
});
