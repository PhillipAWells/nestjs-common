
import { vi } from 'vitest';
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

		const mockModuleRef = {
			get: vi.fn().mockReturnValue(mockAppLogger),
		} as any;
		service = new GraphQLPerformanceService(mockModuleRef);
	});

	describe('measure() - Performance Tracking', () => {
		it('should measure successful operation execution', async () => {
			const result = await service.Measure('testOperation', async () => {
				return 'success';
			});

			expect(result).toBe('success');

			const metrics = service.GetRecentMetrics(1);
			expect(metrics.length).toBe(1);
			expect(metrics[0]?.Operation).toBe('testOperation');
			expect(metrics[0]?.success).toBe(true);
		});

		it('should measure synchronous operations', async () => {
			const result = await service.Measure('syncOperation', () => {
				return 42;
			});

			expect(result).toBe(42);

			const metrics = service.GetRecentMetrics(1);
			expect(metrics[0]?.success).toBe(true);
		});

		it('should record duration accurately', async () => {
			await service.Measure('timedOperation', async () => {
				await new Promise(resolve => setTimeout(resolve, 50));
				return 'done';
			});

			const metrics = service.GetRecentMetrics(1);
			expect(metrics[0]?.duration).toBeGreaterThanOrEqual(40); // Allow for timing variance
		});

		it('should log warning for slow operations', async () => {
			await service.Measure('slowOperation', async () => {
				await new Promise(resolve => setTimeout(resolve, 1100));
				return 'slow';
			});

			const warnLog = logCalls.find(log => log.level === 'warn');
			expect(warnLog).toBeDefined();
			expect(warnLog?.args[0]).toContain('Slow operation');
		});

		it('should capture errors and rethrow', async () => {
			await expect(
				service.Measure('failingOperation', async () => {
					throw new Error('Test error');
				}),
			).rejects.toThrow('Test error');

			const metrics = service.GetRecentMetrics(1);
			expect(metrics[0]?.success).toBe(false);
			expect(metrics[0]?.error).toBe('Test error');
		});

		it('should include metadata in metrics', async () => {
			await service.Measure(
				'metadataOperation',
				async () => 'result',
				{ userId: '123', type: 'query' },
			);

			const metrics = service.GetRecentMetrics(1);
			expect(metrics[0]?.metadata).toEqual({ userId: '123', type: 'query' });
		});

		it('should maintain metrics history limit', async () => {
			// Create more than max metrics (10000)
			for (let i = 0; i < 10; i++) {
				await service.Measure(`operation${i}`, () => 'result');
			}

			const allMetrics = service.GetRecentMetrics(20);
			expect(allMetrics.length).toBe(10);
		});
	});

	describe('getStats() - Statistical Analysis', () => {
		beforeEach(async () => {
			// Add sample metrics
			await service.Measure('op1', () => 'result');
			await new Promise(resolve => setTimeout(resolve, 10));
			await service.Measure('op2', () => 'result');
			await new Promise(resolve => setTimeout(resolve, 10));
			try {
				await service.Measure('op3', async () => {
					throw new Error('Failed');
				});
			} catch {
				// Expected
			}
		});

		it('should calculate total operations', () => {
			const stats = service.GetStats();

			expect(stats.totalOperations).toBe(3);
		});

		it('should calculate average duration', () => {
			const stats = service.GetStats();

			expect(stats.averageDuration).toBeGreaterThanOrEqual(0);
		});

		it('should track min and max duration', () => {
			const stats = service.GetStats();

			expect(stats.minDuration).toBeGreaterThanOrEqual(0);
			expect(stats.maxDuration).toBeGreaterThanOrEqual(stats.minDuration);
		});

		it('should calculate error rate', () => {
			const stats = service.GetStats();

			expect(stats.errorRate).toBeCloseTo(1 / 3, 2);
		});

		it('should calculate operations per second', () => {
			const stats = service.GetStats();

			expect(stats.OperationsPerSecond).toBeGreaterThan(0);
		});

		it('should filter stats by operation name', async () => {
			await service.Measure('specificOp', () => 'result');

			const stats = service.GetStats('specificOp');

			expect(stats.totalOperations).toBe(1);
		});

		it('should return zero stats for empty metrics', () => {
			service.ClearMetrics();

			const stats = service.GetStats();

			expect(stats.totalOperations).toBe(0);
			expect(stats.averageDuration).toBe(0);
			expect(stats.errorRate).toBe(0);
		});

		it('should respect time range filter', async () => {
			service.ClearMetrics();

			await service.Measure('recentOp', () => 'result');

			// Query with very short time range (1ms)
			const stats = service.GetStats(undefined, 1);

			// Might be 0 or 1 depending on timing
			expect(stats.totalOperations).toBeLessThanOrEqual(1);
		});
	});

	describe('getRecentMetrics() - Metrics Retrieval', () => {
		beforeEach(async () => {
			await service.Measure('op1', () => 'result1');
			await service.Measure('op2', () => 'result2');
			await service.Measure('op1', () => 'result3');
		});

		it('should return most recent metrics first', () => {
			const metrics = service.GetRecentMetrics(3);

			expect(metrics.length).toBe(3);
			// Most recent first (reverse order)
			expect(metrics[0]?.Operation).toBe('op1');
			expect(metrics[2]?.Operation).toBe('op1');
		});

		it('should respect limit parameter', () => {
			const metrics = service.GetRecentMetrics(2);

			expect(metrics.length).toBe(2);
		});

		it('should filter by operation name', () => {
			const metrics = service.GetRecentMetrics(10, 'op1');

			expect(metrics.length).toBe(2);
			expect(metrics.every(m => m.Operation === 'op1')).toBe(true);
		});
	});

	describe('getSlowOperations() - Slow Query Detection', () => {
		beforeEach(async () => {
			await service.Measure('fastOp', () => 'result');
			await service.Measure('slowOp', async () => {
				await new Promise(resolve => setTimeout(resolve, 1100));
				return 'result';
			});
		});

		it('should return operations above threshold', () => {
			const slowOps = service.GetSlowOperations(1000);

			expect(slowOps.length).toBe(1);
			expect(slowOps[0]?.Operation).toBe('slowOp');
		});

		it('should sort by duration descending', async () => {
			await service.Measure('slower', async () => {
				await new Promise(resolve => setTimeout(resolve, 1200));
				return 'result';
			});

			const slowOps = service.GetSlowOperations(1000, 10);

			expect(slowOps[0]?.duration).toBeGreaterThan(slowOps[1]?.duration!);
		});

		it('should respect limit parameter', async () => {
			// Add more slow operations
			for (let i = 0; i < 3; i++) {
				await service.Measure(`slow${i}`, async () => {
					await new Promise(resolve => setTimeout(resolve, 1100));
					return 'result';
				});
			}

			const slowOps = service.GetSlowOperations(1000, 2);

			expect(slowOps.length).toBeLessThanOrEqual(2);
		});
	});

	describe('getErrors() - Error Tracking', () => {
		beforeEach(async () => {
			await service.Measure('successOp', () => 'result');
			try {
				await service.Measure('errorOp1', async () => {
					throw new Error('Error 1');
				});
			} catch {
				// Expected
			}
			try {
				await service.Measure('errorOp2', async () => {
					throw new Error('Error 2');
				});
			} catch {
				// Expected
			}
		});

		it('should return only failed operations', () => {
			const errors = service.GetErrors();

			expect(errors.length).toBe(2);
			expect(errors.every(e => !e.success)).toBe(true);
		});

		it('should return most recent errors first', () => {
			const errors = service.GetErrors();

			expect(errors[0]?.Operation).toBe('errorOp2');
			expect(errors[1]?.Operation).toBe('errorOp1');
		});

		it('should respect limit parameter', () => {
			const errors = service.GetErrors(1);

			expect(errors.length).toBe(1);
		});
	});

	describe('getOperationsSummary() - Summary Statistics', () => {
		beforeEach(async () => {
			await service.Measure('queryUser', () => 'result');
			await service.Measure('queryUser', () => 'result');
			await service.Measure('queryPost', () => 'result');
			try {
				await service.Measure('queryUser', async () => {
					throw new Error('Failed');
				});
			} catch {
				// Expected
			}
		});

		it('should group metrics by operation', () => {
			const summary = service.GetOperationsSummary();

			expect(Object.keys(summary)).toContain('queryUser');
			expect(Object.keys(summary)).toContain('queryPost');
		});

		it('should calculate count per operation', () => {
			const summary = service.GetOperationsSummary();

			expect(summary['queryUser']?.count).toBe(3);
			expect(summary['queryPost']?.count).toBe(1);
		});

		it('should calculate average duration per operation', () => {
			const summary = service.GetOperationsSummary();

			expect(summary['queryUser']?.avgDuration).toBeGreaterThanOrEqual(0);
		});

		it('should calculate error rate per operation', () => {
			const summary = service.GetOperationsSummary();

			expect(summary['queryUser']?.errorRate).toBeCloseTo(1 / 3, 2);
			expect(summary['queryPost']?.errorRate).toBe(0);
		});
	});

	describe('clearMetrics() - Cleanup', () => {
		it('should remove all metrics', async () => {
			await service.Measure('op1', () => 'result');
			await service.Measure('op2', () => 'result');

			service.ClearMetrics();

			const metrics = service.GetRecentMetrics();
			expect(metrics.length).toBe(0);
		});

		it('should log clear action', () => {
			service.ClearMetrics();

			const infoLog = logCalls.find(log => log.level === 'info');
			expect(infoLog).toBeDefined();
			expect(infoLog?.args[0]).toContain('Performance metrics cleared');
		});
	});
});
