
import { ResilienceService } from '../../subscriptions/resilience.service.js';

function createService(config: any): ResilienceService {
	const mockModuleRef = {
		get: () => config,
	} as any;
	return new ResilienceService(mockModuleRef);
}

describe('Resilience Service - Advanced Connection Management', () => {
	let service: ResilienceService;
	let mockConfig: any;

	beforeEach(() => {
		// Manual mock for ISubscriptionConfig
		mockConfig = {
			resilience: {
				keepalive: {
					enabled: true,
					interval: 30000,
				},
				reconnection: {
					enabled: true,
					attempts: 3,
					delay: 1000,
					backoff: 'exponential' as const,
				},
				errorRecovery: {
					enabled: true,
					maxRetries: 3,
					retryDelay: 1000,
				},
				shutdown: {
					timeout: 5000,
				},
			},
		};

		service = createService(mockConfig);
	});

	afterEach(async () => {
		await service.onModuleDestroy();
	});

	describe('startKeepalive() - Keepalive Management', () => {
		it('should start keepalive timer when enabled', () => {
			let _callbackCount = 0;
			const callback = () => {
				_callbackCount++;
			};

			service.startKeepalive('conn-1', callback);

			const stats = service.getStats();
			expect(stats.activeKeepalives).toBe(1);
		});

		it('should not start keepalive when disabled', () => {
			mockConfig.resilience.keepalive.enabled = false;
			const newService = createService(mockConfig);

			newService.startKeepalive('conn-1', () => {});

			const stats = newService.getStats();
			expect(stats.activeKeepalives).toBe(0);
		});

		it('should execute keepalive callback at intervals', async () => {
			mockConfig.resilience.keepalive.interval = 100;
			const newService = createService(mockConfig);

			let callbackCount = 0;
			const callback = () => {
				callbackCount++;
			};

			newService.startKeepalive('conn-1', callback);

			await new Promise(resolve => setTimeout(resolve, 250));

			expect(callbackCount).toBeGreaterThanOrEqual(2);

			await newService.onModuleDestroy();
		});

		it('should handle callback errors gracefully', async () => {
			mockConfig.resilience.keepalive.interval = 50;
			const newService = createService(mockConfig);

			const failingCallback = () => {
				throw new Error('Callback failed');
			};

			// Should not throw
			expect(() => {
				newService.startKeepalive('conn-1', failingCallback);
			}).not.toThrow();

			await new Promise(resolve => setTimeout(resolve, 100));

			await newService.onModuleDestroy();
		});

		it('should track multiple keepalive connections', () => {
			service.startKeepalive('conn-1', () => {});
			service.startKeepalive('conn-2', () => {});
			service.startKeepalive('conn-3', () => {});

			const stats = service.getStats();
			expect(stats.activeKeepalives).toBe(3);
		});
	});

	describe('stopKeepalive() - Cleanup', () => {
		it('should stop keepalive timer', () => {
			service.startKeepalive('conn-1', () => {});

			service.stopKeepalive('conn-1');

			const stats = service.getStats();
			expect(stats.activeKeepalives).toBe(0);
		});

		it('should handle stopping non-existent keepalive', () => {
			expect(() => {
				service.stopKeepalive('non-existent');
			}).not.toThrow();
		});

		it('should only stop specified connection', () => {
			service.startKeepalive('conn-1', () => {});
			service.startKeepalive('conn-2', () => {});

			service.stopKeepalive('conn-1');

			const stats = service.getStats();
			expect(stats.activeKeepalives).toBe(1);
		});
	});

	describe('scheduleReconnection() - Reconnection Logic', () => {
		it('should schedule reconnection when enabled', () => {
			service.scheduleReconnection('conn-1', async () => {});

			const stats = service.getStats();
			expect(stats.pendingReconnections).toBe(1);
		});

		it('should not schedule when disabled', () => {
			mockConfig.resilience.reconnection.enabled = false;
			const newService = createService(mockConfig);

			newService.scheduleReconnection('conn-1', async () => {});

			const stats = newService.getStats();
			expect(stats.pendingReconnections).toBe(0);
		});

		it('should execute callback after delay', async () => {
			mockConfig.resilience.reconnection.delay = 100;
			const newService = createService(mockConfig);

			let callbackExecuted = false;
			const callback = async () => {
				callbackExecuted = true;
			};

			newService.scheduleReconnection('conn-1', callback);

			await new Promise(resolve => setTimeout(resolve, 150));

			expect(callbackExecuted).toBe(true);

			await newService.onModuleDestroy();
		});

		it('should retry on failure up to max attempts', async () => {
			mockConfig.resilience.reconnection.delay = 50;
			mockConfig.resilience.reconnection.attempts = 2;
			const newService = createService(mockConfig);

			let attemptCount = 0;
			const callback = async () => {
				attemptCount++;
				throw new Error('Connection failed');
			};

			newService.scheduleReconnection('conn-1', callback);

			await new Promise(resolve => setTimeout(resolve, 500));

			expect(attemptCount).toBeGreaterThanOrEqual(2);

			await newService.onModuleDestroy();
		});

		it('should stop retrying after max attempts', async () => {
			mockConfig.resilience.reconnection.delay = 50;
			mockConfig.resilience.reconnection.attempts = 2;
			const newService = createService(mockConfig);

			let attemptCount = 0;
			const callback = async () => {
				attemptCount++;
				throw new Error('Connection failed');
			};

			newService.scheduleReconnection('conn-1', callback);

			await new Promise(resolve => setTimeout(resolve, 400));

			expect(attemptCount).toBe(2);

			await newService.onModuleDestroy();
		});

		it('should use exponential backoff for delays', async () => {
			mockConfig.resilience.reconnection.delay = 100;
			mockConfig.resilience.reconnection.backoff = 'exponential';
			const newService = createService(mockConfig);

			const timestamps: number[] = [];
			const callback = async () => {
				timestamps.push(Date.now());
				if (timestamps.length < 3) {
					throw new Error('Still failing');
				}
			};

			newService.scheduleReconnection('conn-1', callback, 1);

			await new Promise(resolve => setTimeout(resolve, 1000));

			if (timestamps.length >= 2) {
				const delay1 = timestamps[1]! - timestamps[0]!;
				const delay2 = timestamps[2]! - timestamps[1]!;
				// Second delay should be roughly double the first (with some tolerance)
				expect(delay2).toBeGreaterThan(delay1 * 1.5);
			}

			await newService.onModuleDestroy();
		});
	});

	describe('cancelReconnection() - Cancel Pending', () => {
		it('should cancel pending reconnection', () => {
			service.scheduleReconnection('conn-1', async () => {});

			service.cancelReconnection('conn-1');

			const stats = service.getStats();
			expect(stats.pendingReconnections).toBe(0);
		});

		it('should handle cancelling non-existent reconnection', () => {
			expect(() => {
				service.cancelReconnection('non-existent');
			}).not.toThrow();
		});
	});

	describe('handleConnectionError() - Error Recovery', () => {
		it('should execute recovery callback', async () => {
			let recoveryExecuted = false;
			const recoveryCallback = async () => {
				recoveryExecuted = true;
			};

			await service.handleConnectionError('conn-1', new Error('Test error'), recoveryCallback);

			expect(recoveryExecuted).toBe(true);
		});

		it('should stop keepalive on error', async () => {
			service.startKeepalive('conn-1', () => {});

			await service.handleConnectionError('conn-1', new Error('Test error'), async () => {});

			// Keepalive should be stopped but stats check happens after recovery
			const stats = service.getStats();
			expect(stats.activeKeepalives).toBe(0);
		});

		it('should retry recovery on failure', async () => {
			mockConfig.resilience.errorRecovery.maxRetries = 2;
			mockConfig.resilience.errorRecovery.retryDelay = 50;
			const newService = createService(mockConfig);

			let attemptCount = 0;
			const recoveryCallback = async () => {
				attemptCount++;
				if (attemptCount < 2) {
					throw new Error('Recovery failed');
				}
			};

			await newService.handleConnectionError('conn-1', new Error('Test error'), recoveryCallback);

			expect(attemptCount).toBe(2);
		});

		it('should not retry when error recovery disabled', async () => {
			mockConfig.resilience.errorRecovery.enabled = false;
			const newService = createService(mockConfig);

			let recoveryExecuted = false;
			const recoveryCallback = async () => {
				recoveryExecuted = true;
			};

			await newService.handleConnectionError('conn-1', new Error('Test error'), recoveryCallback);

			expect(recoveryExecuted).toBe(false);
		});
	});

	describe('gracefulShutdown() - Shutdown Handling', () => {
		it('should execute shutdown callback', async () => {
			let shutdownExecuted = false;
			const shutdownCallback = async () => {
				shutdownExecuted = true;
			};

			await service.gracefulShutdown(shutdownCallback);

			expect(shutdownExecuted).toBe(true);
		});

		it('should handle shutdown errors', async () => {
			const shutdownCallback = async () => {
				throw new Error('Shutdown error');
			};

			// Should not throw
			await expect(
				service.gracefulShutdown(shutdownCallback),
			).resolves.not.toThrow();
		});

		it('should complete shutdown without timing out', async () => {
			let shutdownCompleted = false;
			const newService = createService(mockConfig);

			await newService.gracefulShutdown(async () => {
				shutdownCompleted = true;
			});

			// Verify shutdown completed successfully
			expect(shutdownCompleted).toBe(true);
		});
	});

	describe('getStats() - Statistics', () => {
		it('should return accurate statistics', () => {
			service.startKeepalive('conn-1', () => {});
			service.startKeepalive('conn-2', () => {});
			service.scheduleReconnection('conn-3', async () => {});

			const stats = service.getStats();

			expect(stats.activeKeepalives).toBe(2);
			expect(stats.pendingReconnections).toBe(1);
			expect(stats.shutdownInProgress).toBe(false);
		});
	});

	describe('onModuleDestroy() - Cleanup', () => {
		it('should clear all timers', async () => {
			service.startKeepalive('conn-1', () => {});
			service.startKeepalive('conn-2', () => {});
			service.scheduleReconnection('conn-3', async () => {});

			await service.onModuleDestroy();

			const stats = service.getStats();
			expect(stats.activeKeepalives).toBe(0);
			expect(stats.pendingReconnections).toBe(0);
		});
	});
});
