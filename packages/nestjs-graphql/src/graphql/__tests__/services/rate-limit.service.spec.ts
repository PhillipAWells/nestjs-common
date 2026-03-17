
import { vi } from 'vitest';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { RateLimitService, RateLimitResult } from '../../services/rate-limit.service.js';

function createService(): RateLimitService {
	const mockAppLogger = {
		createContextualLogger: vi.fn().mockReturnValue({
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		}),
	};
	const mockModuleRef = {
		get: (token: any) => {
			if (token === AppLogger) return mockAppLogger;
			throw new Error(`Unknown token: ${String(token)}`);
		},
	} as any;
	return new RateLimitService(mockModuleRef);
}

describe('RateLimitService', () => {
	let service: RateLimitService;

	beforeEach(() => {
		vi.useFakeTimers();
		service = createService();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	describe('checkLimit', () => {
		it('should allow requests within limit', async () => {
			const clientId = 'user123';

			for (let i = 0; i < 5; i++) {
				const result: RateLimitResult = await service.checkLimit(clientId);
				expect(result.allowed).toBe(true);
				expect(result.remaining).toBe(99 - i);
				expect(result.limit).toBe(100);
				expect(result.resetTime).toBeGreaterThan(Date.now());
			}
		});

		it('should block requests over limit', async () => {
			const clientId = 'user123';

			// Use up all requests
			for (let i = 0; i < 100; i++) {
				await service.checkLimit(clientId);
			}

			// Next request should be blocked
			const result: RateLimitResult = await service.checkLimit(clientId);
			expect(result.allowed).toBe(false);
			expect(result.remaining).toBe(0);
			expect(result.limit).toBe(100);
		});

		it('should reset limit after window expires', async () => {
			const clientId = 'user123';

			// Use up all requests
			for (let i = 0; i < 100; i++) {
				await service.checkLimit(clientId);
			}

			// Verify blocked
			let result = await service.checkLimit(clientId);
			expect(result.allowed).toBe(false);

			// Simulate time passing (15 minutes + 1 second)
			vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

			// Should allow again
			result = await service.checkLimit(clientId);
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(99);
		});

		it('should handle different clients independently', async () => {
			const client1 = 'user123';
			const client2 = 'user456';

			// Use up client1's limit
			for (let i = 0; i < 100; i++) {
				await service.checkLimit(client1);
			}

			// Client2 should still be allowed
			const result = await service.checkLimit(client2);
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(99);
		});

		it('should support custom operation configs', async () => {
			const operation = 'intensiveQuery';
			service.setOperationConfig(operation, {
				windowMs: 60000, // 1 minute
				maxRequests: 10,
			});

			const clientId = 'user123';

			// Use up the custom limit
			for (let i = 0; i < 10; i++) {
				const result = await service.checkLimit(clientId, operation);
				expect(result.allowed).toBe(true);
				expect(result.limit).toBe(10);
			}

			// Next should be blocked
			const result = await service.checkLimit(clientId, operation);
			expect(result.allowed).toBe(false);
		});
	});

	describe('setOperationConfig', () => {
		it('should set custom config for operation', () => {
			const operation = 'mutation';
			const config = {
				windowMs: 30000,
				maxRequests: 5,
			};

			service.setOperationConfig(operation, config);

			// Verify by checking limit
			const result = service.getStatus('test', operation);
			expect(result).toBeNull(); // No requests made yet
		});
	});

	describe('resetLimit', () => {
		it('should reset client limit', async () => {
			const clientId = 'user123';

			// Use some requests
			await service.checkLimit(clientId);
			await service.checkLimit(clientId);

			// Reset
			service.resetLimit(clientId);

			// Should start fresh
			const result = await service.checkLimit(clientId);
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(99);
		});
	});

	describe('getStatus', () => {
		it('should return null for unknown client', () => {
			const result = service.getStatus('unknown');
			expect(result).toBeNull();
		});

		it('should return current status for known client', async () => {
			const clientId = 'user123';

			await service.checkLimit(clientId);
			await service.checkLimit(clientId);

			const result = await service.getStatus(clientId);

			expect(result).not.toBeNull();
			expect(result!.allowed).toBe(true);
			expect(result!.remaining).toBe(98);
			expect(result!.limit).toBe(100);
		});

		it('should handle expired entries', async () => {
			const clientId = 'user123';

			await service.checkLimit(clientId);

			// Advance time past reset
			vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

			const result = await service.getStatus(clientId);
			expect(result!.allowed).toBe(false); // Entry exists but expired
		});
	});

	describe('cleanup', () => {
		it('should remove expired entries', async () => {
			const client1 = 'user123';
			const client2 = 'user456';

			await service.checkLimit(client1);
			// Advance time slightly so client2 has a later resetTime
			vi.advanceTimersByTime(2000);
			await service.checkLimit(client2);

			expect(service.getStats().totalEntries).toBe(2);

			// Advance time past reset for client1 but not client2
			vi.advanceTimersByTime(15 * 60 * 1000 - 1000);

			// Trigger cleanup (normally done by interval)
			(service as any).cleanup();

			expect(service.getStats().totalEntries).toBe(1);
		});
	});

	describe('getStats', () => {
		it('should return store statistics', async () => {
			const operation = 'testOp';
			service.setOperationConfig(operation, { windowMs: 60000, maxRequests: 10 });

			await service.checkLimit('user1');
			await service.checkLimit('user2');

			const stats = service.getStats();

			expect(stats.totalEntries).toBe(2);
			expect(stats.operationConfigs).toBe(1);
		});
	});

	describe('lifecycle', () => {
		it('should initialize and destroy properly', async () => {
			const newService = createService();

			// Should initialize without throwing
			newService.onModuleInit();

			// Should destroy without throwing
			newService.onModuleDestroy();
		});
	});
});
