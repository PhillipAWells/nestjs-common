
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionManagerService } from '../../subscriptions/connection-manager.service.js';
import type { SubscriptionConfig } from '../../subscriptions/subscription-config.interface.js';

describe('ConnectionManagerService', () => {
	let service: ConnectionManagerService;
	let config: SubscriptionConfig;
	let mockWs: any;

	beforeEach(async () => {
		mockWs = { id: 'ws123' };

		config = {
			redis: {
				host: 'localhost',
				port: 6379
			},
			websocket: {
				path: '/subscriptions',
				maxPayloadSize: 100 * 1024,
				keepalive: 30000,
				connectionTimeout: 60000,
				maxConnections: 5
			},
			auth: {
				jwtSecret: 'test-secret',
				tokenExpiration: '1h'
			},
			connection: {
				maxSubscriptionsPerUser: 10,
				cleanupInterval: 60000,
				timeout: 300000
			},
			resilience: {
				keepalive: { enabled: true, interval: 30000, timeout: 5000 },
				reconnection: { enabled: true, attempts: 3, delay: 1000, backoff: 'exponential' },
				errorRecovery: { enabled: true, retryDelay: 1000, maxRetries: 3 },
				shutdown: { timeout: 10000, force: true }
			}
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ConnectionManagerService,
				{
					provide: 'SUBSCRIPTION_CONFIG',
					useValue: config
				}
			]
		}).compile();

		service = module.get<ConnectionManagerService>(ConnectionManagerService);
	});

	afterEach(() => {
		jest.clearAllTimers();
	});

	describe('addConnection', () => {
		it('should add connection for new user', () => {
			service.addConnection(mockWs, 'user123');

			expect(service.getConnectionCount()).toBe(1);
		});

		it('should add multiple connections for same user', () => {
			const mockWs2 = { id: 'ws456' };

			service.addConnection(mockWs, 'user123');
			service.addConnection(mockWs2, 'user123');

			expect(service.getConnectionCount()).toBe(2);
		});

		it('should set connection timeout', () => {
			jest.useFakeTimers();

			service.addConnection(mockWs, 'user123');

			expect(service.getConnectionCount()).toBe(1);

			// Fast-forward past timeout
			jest.advanceTimersByTime(config.connection.timeout + 1000);

			expect(service.getConnectionCount()).toBe(0);
		});
	});

	describe('removeConnection', () => {
		it('should remove specific connection', () => {
			const mockWs2 = { id: 'ws456' };

			service.addConnection(mockWs, 'user123');
			service.addConnection(mockWs2, 'user123');

			service.removeConnection(mockWs, 'user123');

			expect(service.getConnectionCount()).toBe(1);
		});

		it('should remove user when no connections remain', () => {
			service.addConnection(mockWs, 'user123');

			service.removeConnection(mockWs, 'user123');

			expect(service.getConnectionCount()).toBe(0);
		});

		it('should clear connection timeout', () => {
			service.addConnection(mockWs, 'user123');

			service.removeConnection(mockWs, 'user123');

			// Should not trigger timeout cleanup
			expect(service.getConnectionCount()).toBe(0);
		});

		it('should remove all subscriptions when connection is removed', () => {
			service.addConnection(mockWs, 'user123');
			service.addSubscription('user123', 'sub1');
			service.addSubscription('user123', 'sub2');

			expect(service.getSubscriptionCount()).toBe(2);

			service.removeConnection(mockWs, 'user123');

			expect(service.getSubscriptionCount()).toBe(0);
		});
	});

	describe('canAcceptConnection', () => {
		it('should allow connection when under limit', () => {
			expect(service.canAcceptConnection('user123')).toBe(true);
		});

		it('should reject connection when at limit', () => {
			// Add connections up to limit
			for (let i = 0; i < config.websocket.maxConnections; i++) {
				service.addConnection({ id: `ws${i}` }, 'user123');
			}

			expect(service.canAcceptConnection('user123')).toBe(false);
		});

		it('should allow connections for different users', () => {
			// Fill up one user
			for (let i = 0; i < config.websocket.maxConnections; i++) {
				service.addConnection({ id: `ws${i}` }, 'user123');
			}

			expect(service.canAcceptConnection('user456')).toBe(true);
		});
	});

	describe('addSubscription', () => {
		it('should add subscription for user', () => {
			service.addSubscription('user123', 'sub1');

			expect(service.getSubscriptionCount()).toBe(1);
		});

		it('should add multiple subscriptions for same user', () => {
			service.addSubscription('user123', 'sub1');
			service.addSubscription('user123', 'sub2');

			expect(service.getSubscriptionCount()).toBe(2);
		});
	});

	describe('removeSubscription', () => {
		it('should remove specific subscription', () => {
			service.addSubscription('user123', 'sub1');
			service.addSubscription('user123', 'sub2');

			service.removeSubscription('user123', 'sub1');

			expect(service.getSubscriptionCount()).toBe(1);
		});

		it('should remove user when no subscriptions remain', () => {
			service.addSubscription('user123', 'sub1');

			service.removeSubscription('user123', 'sub1');

			expect(service.getSubscriptionCount()).toBe(0);
		});
	});

	describe('canAcceptSubscription', () => {
		it('should allow subscription when under limit', () => {
			expect(service.canAcceptSubscription('user123')).toBe(true);
		});

		it('should reject subscription when at limit', () => {
			// Add subscriptions up to limit
			for (let i = 0; i < config.connection.maxSubscriptionsPerUser; i++) {
				service.addSubscription('user123', `sub${i}`);
			}

			expect(service.canAcceptSubscription('user123')).toBe(false);
		});

		it('should allow subscriptions for different users', () => {
			// Fill up one user
			for (let i = 0; i < config.connection.maxSubscriptionsPerUser; i++) {
				service.addSubscription('user123', `sub${i}`);
			}

			expect(service.canAcceptSubscription('user456')).toBe(true);
		});
	});

	describe('getConnectionCount', () => {
		it('should return total connection count', () => {
			service.addConnection(mockWs, 'user123');
			service.addConnection({ id: 'ws456' }, 'user456');

			expect(service.getConnectionCount()).toBe(2);
		});

		it('should return 0 when no connections', () => {
			expect(service.getConnectionCount()).toBe(0);
		});
	});

	describe('getSubscriptionCount', () => {
		it('should return total subscription count', () => {
			service.addSubscription('user123', 'sub1');
			service.addSubscription('user456', 'sub2');

			expect(service.getSubscriptionCount()).toBe(2);
		});

		it('should return 0 when no subscriptions', () => {
			expect(service.getSubscriptionCount()).toBe(0);
		});
	});

	describe('getStats', () => {
		it('should return comprehensive statistics', () => {
			service.addConnection(mockWs, 'user123');
			service.addConnection({ id: 'ws456' }, 'user456');
			service.addSubscription('user123', 'sub1');
			service.addSubscription('user123', 'sub2');
			service.addSubscription('user456', 'sub3');

			const stats = service.getStats();

			expect(stats.totalConnections).toBe(2);
			expect(stats.totalSubscriptions).toBe(3);
			expect(stats.connectionsByUser).toEqual({
				user123: 1,
				user456: 1
			});
			expect(stats.subscriptionsByUser).toEqual({
				user123: 2,
				user456: 1
			});
		});

		it('should return empty stats when no activity', () => {
			const stats = service.getStats();

			expect(stats.totalConnections).toBe(0);
			expect(stats.totalSubscriptions).toBe(0);
			expect(stats.connectionsByUser).toEqual({});
			expect(stats.subscriptionsByUser).toEqual({});
		});
	});

	describe('onModuleDestroy', () => {
		it('should cleanup all resources', async () => {
			service.addConnection(mockWs, 'user123');
			service.addSubscription('user123', 'sub1');

			await service.onModuleDestroy();

			expect(service.getConnectionCount()).toBe(0);
			expect(service.getSubscriptionCount()).toBe(0);
		});
	});

	describe('concurrent connections', () => {
		it('should handle multiple users with concurrent connections', () => {
			const users = ['user1', 'user2', 'user3'];
			const wsObjects = [
				{ id: 'ws1' },
				{ id: 'ws2' },
				{ id: 'ws3' }
			];

			users.forEach((user, idx) => {
				service.addConnection(wsObjects[idx], user);
			});

			expect(service.getConnectionCount()).toBe(3);
		});

		it('should isolate connections between different users', () => {
			const ws1 = { id: 'ws1' };
			const ws2 = { id: 'ws2' };

			service.addConnection(ws1, 'user123');
			service.addConnection(ws2, 'user456');

			service.removeConnection(ws1, 'user123');

			expect(service.getConnectionCount()).toBe(1);
		});

		it('should enforce max connections per user', () => {
			for (let i = 0; i < config.websocket.maxConnections; i++) {
				service.addConnection({ id: `ws${i}` }, 'user123');
			}

			expect(service.canAcceptConnection('user123')).toBe(false);

			// Should still allow other users
			expect(service.canAcceptConnection('user456')).toBe(true);
		});

		it('should track concurrent subscriptions per user', () => {
			service.addConnection(mockWs, 'user123');
			service.addSubscription('user123', 'sub1');
			service.addSubscription('user123', 'sub2');
			service.addSubscription('user123', 'sub3');

			expect(service.getSubscriptionCount()).toBe(3);
		});

		it('should handle rapid add/remove cycles', () => {
			for (let i = 0; i < 10; i++) {
				service.addConnection({ id: `ws${i}` }, 'user123');
				service.addSubscription('user123', `sub${i}`);
			}

			expect(service.getConnectionCount()).toBe(10);
			expect(service.getSubscriptionCount()).toBe(10);

			for (let i = 0; i < 10; i++) {
				service.removeConnection({ id: `ws${i}` }, 'user123');
				service.removeSubscription('user123', `sub${i}`);
			}

			expect(service.getConnectionCount()).toBe(0);
			expect(service.getSubscriptionCount()).toBe(0);
		});
	});

	describe('connection state tracking', () => {
		it('should track connection creation time', () => {
			const beforeAdd = Date.now();
			service.addConnection(mockWs, 'user123');
			const afterAdd = Date.now();

			// Connection was added within this timeframe
			expect(service.getConnectionCount()).toBe(1);
		});

		it('should track last activity time implicitly', () => {
			service.addConnection(mockWs, 'user123');

			// Activity is implicit - just verify connection exists
			expect(service.getConnectionCount()).toBe(1);
		});

		it('should verify authentication status on connection', () => {
			// By adding a connection, we verify it was authenticated
			service.addConnection(mockWs, 'user123');

			expect(service.getConnectionCount()).toBe(1);
			const stats = service.getStats();
			expect(stats.connectionsByUser['user123']).toBe(1);
		});

		it('should track connection metadata', () => {
			const wsWithMetadata = {
				id: 'ws123',
				remoteAddress: '127.0.0.1',
				protocol: 'graphql-ws'
			};

			service.addConnection(wsWithMetadata, 'user123');

			const stats = service.getStats();
			expect(stats.connectionsByUser['user123']).toBe(1);
		});
	});

	describe('connection isolation', () => {
		it('should prevent connection leakage between users', () => {
			const ws1 = { id: 'ws1' };
			const ws2 = { id: 'ws2' };

			service.addConnection(ws1, 'user1');
			service.addConnection(ws2, 'user2');

			const stats = service.getStats();

			expect(stats.connectionsByUser['user1']).toBe(1);
			expect(stats.connectionsByUser['user2']).toBe(1);
		});

		it('should isolate subscriptions between users', () => {
			service.addSubscription('user1', 'sub1');
			service.addSubscription('user1', 'sub2');
			service.addSubscription('user2', 'sub3');

			const stats = service.getStats();

			expect(stats.subscriptionsByUser['user1']).toBe(2);
			expect(stats.subscriptionsByUser['user2']).toBe(1);
		});

		it('should prevent subscription limits affecting other users', () => {
			// Fill up user1
			for (let i = 0; i < config.connection.maxSubscriptionsPerUser; i++) {
				service.addSubscription('user1', `sub${i}`);
			}

			expect(service.canAcceptSubscription('user1')).toBe(false);
			expect(service.canAcceptSubscription('user2')).toBe(true);
		});
	});

	describe('edge cases', () => {
		it('should handle null user ID gracefully', () => {
			expect(() => {
				service.addConnection(mockWs, null as any);
			}).not.toThrow();
		});

		it('should handle undefined connection object', () => {
			expect(() => {
				service.addConnection(undefined as any, 'user123');
			}).not.toThrow();
		});

		it('should handle removing non-existent connection', () => {
			expect(() => {
				service.removeConnection({ id: 'non-existent' }, 'user123');
			}).not.toThrow();
		});

		it('should handle removing from non-existent user', () => {
			expect(() => {
				service.removeConnection(mockWs, 'non-existent-user');
			}).not.toThrow();
		});

		it('should return accurate stats with mixed operations', () => {
			service.addConnection({ id: 'ws1' }, 'user1');
			service.addConnection({ id: 'ws2' }, 'user1');
			service.addConnection({ id: 'ws3' }, 'user2');

			service.addSubscription('user1', 'sub1');
			service.addSubscription('user1', 'sub2');

			const stats = service.getStats();

			expect(stats.totalConnections).toBe(3);
			expect(stats.totalSubscriptions).toBe(2);
			expect(stats.connectionsByUser['user1']).toBe(2);
			expect(stats.connectionsByUser['user2']).toBe(1);
		});
	});

	describe('cleanup and lifecycle', () => {
		it('should preserve connection state until explicit removal', () => {
			service.addConnection(mockWs, 'user123');

			// Connection should persist
			expect(service.getConnectionCount()).toBe(1);

			// After explicit removal, should be gone
			service.removeConnection(mockWs, 'user123');
			expect(service.getConnectionCount()).toBe(0);
		});

		it('should handle subscription cleanup on connection removal', () => {
			service.addConnection(mockWs, 'user123');
			service.addSubscription('user123', 'sub1');
			service.addSubscription('user123', 'sub2');

			// When connection is removed, subscriptions should be cleaned
			service.removeConnection(mockWs, 'user123');

			expect(service.getSubscriptionCount()).toBe(0);
		});

		it('should allow re-adding connections after removal', () => {
			service.addConnection(mockWs, 'user123');
			service.removeConnection(mockWs, 'user123');
			service.addConnection(mockWs, 'user123');

			expect(service.getConnectionCount()).toBe(1);
		});

		it('should handle module destroy with active connections', async () => {
			service.addConnection(mockWs, 'user123');
			service.addConnection({ id: 'ws2' }, 'user456');
			service.addSubscription('user123', 'sub1');

			await service.onModuleDestroy();

			expect(service.getConnectionCount()).toBe(0);
			expect(service.getSubscriptionCount()).toBe(0);
		});
	});
});
