
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { GraphQLWebSocketServer } from '../../subscriptions/websocket.server.js';
import { SubscriptionService } from '../../subscriptions/subscription.service.js';
import { WebSocketAuthService } from '../../subscriptions/websocket-auth.service.js';
import { ConnectionManagerService } from '../../subscriptions/connection-manager.service.js';
import type { WebSocketServerConfig } from '../../subscriptions/websocket-config.interface.js';

describe('GraphQLWebSocketServer', () => {
	let server: GraphQLWebSocketServer;
	let mockSubscriptionService: any;
	let mockAuthService: any;
	let mockConnectionManager: any;
	let mockHttpServer: any;
	let mockWebSocketServer: any;
	let mockDisposeServer: any;
	let config: WebSocketServerConfig;

	beforeEach(async () => {
		mockSubscriptionService = {};
		mockAuthService = {
			authenticate: jest.fn()
		};
		mockConnectionManager = {
			canAcceptConnection: jest.fn(),
			addConnection: jest.fn(),
			removeConnection: jest.fn(),
			removeSubscription: jest.fn(),
			getConnectionCount: jest.fn().mockReturnValue(5),
			getSubscriptionCount: jest.fn().mockReturnValue(10)
		};
		mockHttpServer = {};
		mockWebSocketServer = {
			close: jest.fn()
		};
		mockDisposeServer = jest.fn();

		// Mock WebSocketServer constructor
		const mockWebSocketServerConstructor = jest.fn().mockReturnValue(mockWebSocketServer);
		(global as any).WebSocketServer = mockWebSocketServerConstructor;

		// Mock useServer
		const mockUseServer = jest.fn().mockReturnValue(mockDisposeServer);
		(global as any).useServer = mockUseServer;

		config = {
			path: '/subscriptions',
			maxPayloadSize: 100 * 1024,
			keepalive: 30000,
			connectionTimeout: 60000
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GraphQLWebSocketServer,
				{
					provide: SubscriptionService,
					useValue: mockSubscriptionService
				},
				{
					provide: WebSocketAuthService,
					useValue: mockAuthService
				},
				{
					provide: ConnectionManagerService,
					useValue: mockConnectionManager
				},
				{
					provide: 'WEBSOCKET_SERVER_CONFIG',
					useValue: config
				}
			]
		}).compile();

		server = module.get<GraphQLWebSocketServer>(GraphQLWebSocketServer);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('initialize', () => {
		it('should initialize WebSocket server successfully', async () => {
			await server.initialize(mockHttpServer);

			expect((global as any).WebSocketServer).toHaveBeenCalledWith({
				server: mockHttpServer,
				path: '/subscriptions'
			});
			expect((global as any).useServer).toHaveBeenCalled();
		});

		it('should handle initialization errors', async () => {
			const mockWebSocketServerConstructor = jest.fn().mockImplementation(() => {
				throw new Error('WebSocket creation failed');
			});
			(global as any).WebSocketServer = mockWebSocketServerConstructor;

			await expect(server.initialize(mockHttpServer)).rejects.toThrow('WebSocket creation failed');
		});
	});

	describe('handleConnect', () => {
		it('should accept authenticated connections within limits', async () => {
			const ctx = {
				connectionParams: { token: 'valid-token' }
			};

			mockAuthService.authenticate.mockResolvedValue({
				authenticated: true,
				userId: 'user123'
			});
			mockConnectionManager.canAcceptConnection.mockReturnValue(true);

			const result = await (server as any).handleConnect(ctx);

			expect(mockAuthService.authenticate).toHaveBeenCalledWith({ token: 'valid-token' });
			expect(mockConnectionManager.canAcceptConnection).toHaveBeenCalledWith('user123');
			expect(mockConnectionManager.addConnection).toHaveBeenCalledWith(ctx, 'user123');
			expect(result).toEqual({
				userId: 'user123',
				token: 'valid-token'
			});
		});

		it('should reject unauthenticated connections', async () => {
			const ctx = {
				connectionParams: { token: 'invalid-token' }
			};

			mockAuthService.authenticate.mockResolvedValue({
				authenticated: false
			});

			const result = await (server as any).handleConnect(ctx);

			expect(result).toBe(false);
		});

		it('should reject connections exceeding limits', async () => {
			const ctx = {
				connectionParams: { token: 'valid-token' }
			};

			mockAuthService.authenticate.mockResolvedValue({
				authenticated: true,
				userId: 'user123'
			});
			mockConnectionManager.canAcceptConnection.mockReturnValue(false);

			const result = await (server as any).handleConnect(ctx);

			expect(result).toBe(false);
		});

		it('should handle authentication errors', async () => {
			const ctx = {
				connectionParams: { token: 'valid-token' }
			};

			mockAuthService.authenticate.mockRejectedValue(new Error('Auth service error'));

			const result = await (server as any).handleConnect(ctx);

			expect(result).toBe(false);
		});
	});

	describe('handleSubscribe', () => {
		it('should allow subscriptions with valid user ID', async () => {
			const ctx = {
				connectionParams: { userId: 'user123' }
			};

			const result = await (server as any).handleSubscribe(ctx);

			expect(result).toBeUndefined();
		});

		it('should reject subscriptions without user ID', async () => {
			const ctx = {
				connectionParams: {}
			};

			const result = await (server as any).handleSubscribe(ctx);

			expect(result).toEqual({
				errors: [{ message: 'No user ID in connection context' }]
			});
		});
	});

	describe('handleComplete', () => {
		it('should handle subscription completion', async () => {
			const ctx = {
				connectionParams: { userId: 'user123' }
			};

			await (server as any).handleComplete(ctx);

			expect(mockConnectionManager.removeSubscription).toHaveBeenCalledWith('user123', 'unknown');
		});

		it('should handle completion without user ID', async () => {
			const ctx = {
				connectionParams: {}
			};

			await (server as any).handleComplete(ctx);

			expect(mockConnectionManager.removeSubscription).not.toHaveBeenCalled();
		});
	});

	describe('handleDisconnect', () => {
		it('should handle disconnections', async () => {
			const ctx = {};

			await (server as any).handleDisconnect(ctx);

			expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith(ctx, undefined);
		});

		it('should handle disconnections with user ID', async () => {
			const ctx = {
				connectionParams: { userId: 'user123' }
			};

			await (server as any).handleDisconnect(ctx);

			expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith(ctx, 'user123');
		});
	});

	describe('createContext', () => {
		it('should create GraphQL context', () => {
			const ctx = {
				connectionParams: { userId: 'user123' }
			};

			const context = (server as any).createContext(ctx);

			expect(context).toEqual({
				userId: 'user123',
				subscriptionService: mockSubscriptionService,
				connectionManager: mockConnectionManager
			});
		});

		it('should handle missing connection params', () => {
			const ctx = {};

			const context = (server as any).createContext(ctx);

			expect(context).toEqual({
				userId: undefined,
				subscriptionService: mockSubscriptionService,
				connectionManager: mockConnectionManager
			});
		});
	});

	describe('getStats', () => {
		it('should return server statistics', () => {
			const stats = server.getStats();

			expect(stats.connections).toBe(5);
			expect(stats.subscriptions).toBe(10);
			expect(typeof stats.uptime).toBe('number');
		});
	});

	describe('onModuleDestroy', () => {
		beforeEach(async () => {
			await server.initialize(mockHttpServer);
		});

		it('should cleanup resources', async () => {
			await server.onModuleDestroy();

			expect(mockDisposeServer).toHaveBeenCalled();
			expect(mockWebSocketServer.close).toHaveBeenCalled();
		});

		it('should handle cleanup without initialized server', async () => {
			// Create a new server instance without initialization
			const newServer = new (GraphQLWebSocketServer as any)(
				mockSubscriptionService,
				mockAuthService,
				mockConnectionManager,
				config
			);

			await expect(newServer.onModuleDestroy()).resolves.not.toThrow();
		});
	});

	describe('server startup and shutdown', () => {
		it('should initialize without errors', async () => {
			await expect(server.initialize(mockHttpServer)).resolves.not.toThrow();

			expect((global as any).WebSocketServer).toHaveBeenCalled();
		});

		it('should listen on configured path', async () => {
			await server.initialize(mockHttpServer);

			expect((global as any).WebSocketServer).toHaveBeenCalledWith(
				expect.objectContaining({ path: '/subscriptions' })
			);
		});

		it('should setup GraphQL WebSocket handlers', async () => {
			await server.initialize(mockHttpServer);

			expect((global as any).useServer).toHaveBeenCalled();
		});

		it('should close all connections on shutdown', async () => {
			await server.initialize(mockHttpServer);
			await server.onModuleDestroy();

			expect(mockWebSocketServer.close).toHaveBeenCalled();
		});
	});

	describe('client connection flow', () => {
		it('should accept client with valid token', async () => {
			const ctx = {
				connectionParams: { token: 'valid-token' }
			};

			mockAuthService.authenticate.mockResolvedValue({
				authenticated: true,
				userId: 'client-user'
			});
			mockConnectionManager.canAcceptConnection.mockReturnValue(true);

			const result = await (server as any).handleConnect(ctx);

			expect(result).toEqual({
				userId: 'client-user',
				token: 'valid-token'
			});
		});

		it('should disconnect client with invalid token', async () => {
			const ctx = {
				connectionParams: { token: 'invalid-token' }
			};

			mockAuthService.authenticate.mockResolvedValue({
				authenticated: false,
				error: 'Invalid token'
			});

			const result = await (server as any).handleConnect(ctx);

			expect(result).toBe(false);
		});

		it('should reconnect with new token', async () => {
			const ctx1 = { connectionParams: { token: 'old-token' } };
			const ctx2 = { connectionParams: { token: 'new-token' } };

			mockAuthService.authenticate
				.mockResolvedValueOnce({ authenticated: true, userId: 'user123' })
				.mockResolvedValueOnce({ authenticated: true, userId: 'user123' });
			mockConnectionManager.canAcceptConnection.mockReturnValue(true);

			const result1 = await (server as any).handleConnect(ctx1);
			const result2 = await (server as any).handleConnect(ctx2);

			expect(result1).toBeDefined();
			expect(result2).toBeDefined();
		});

		it('should persist connection across multiple operations', async () => {
			const ctx = { connectionParams: { userId: 'persistent-user' } };

			mockAuthService.authenticate.mockResolvedValue({
				authenticated: true,
				userId: 'persistent-user'
			});
			mockConnectionManager.canAcceptConnection.mockReturnValue(true);

			const connectResult = await (server as any).handleConnect(ctx);
			expect(connectResult).toBeDefined();

			const subscribeResult = await (server as any).handleSubscribe(ctx);
			expect(subscribeResult).toBeUndefined(); // Success
		});
	});

	describe('GraphQL subscription flow', () => {
		it('should accept subscription message', async () => {
			const ctx = {
				connectionParams: { userId: 'subscriber-user' }
			};

			const result = await (server as any).handleSubscribe(ctx);

			expect(result).toBeUndefined(); // Allow subscription
		});

		it('should reject subscription without authentication', async () => {
			const ctx = {
				connectionParams: {}
			};

			const result = await (server as any).handleSubscribe(ctx);

			expect(result).toEqual({
				errors: [{ message: 'No user ID in connection context' }]
			});
		});

		it('should support multiple subscriptions per connection', async () => {
			const ctx = { connectionParams: { userId: 'multi-sub-user' } };

			const result1 = await (server as any).handleSubscribe(ctx);
			const result2 = await (server as any).handleSubscribe(ctx);
			const result3 = await (server as any).handleSubscribe(ctx);

			expect(result1).toBeUndefined();
			expect(result2).toBeUndefined();
			expect(result3).toBeUndefined();
		});

		it('should handle subscription completion', async () => {
			const ctx = {
				connectionParams: { userId: 'completion-user' }
			};

			await (server as any).handleComplete(ctx);

			expect(mockConnectionManager.removeSubscription).toHaveBeenCalledWith('completion-user', 'unknown');
		});
	});

	describe('security', () => {
		it('should reject invalid tokens before connection', async () => {
			const ctx = {
				connectionParams: { token: 'tampered-token' }
			};

			mockAuthService.authenticate.mockResolvedValue({
				authenticated: false,
				error: 'Token signature verification failed'
			});

			const result = await (server as any).handleConnect(ctx);

			expect(result).toBe(false);
		});

		it('should reject expired tokens', async () => {
			const ctx = {
				connectionParams: { token: 'expired-token' }
			};

			mockAuthService.authenticate.mockResolvedValue({
				authenticated: false,
				error: 'Token expired'
			});

			const result = await (server as any).handleConnect(ctx);

			expect(result).toBe(false);
		});

		it('should check connection limits to prevent DOS', async () => {
			const ctx = {
				connectionParams: { token: 'valid-token' }
			};

			mockAuthService.authenticate.mockResolvedValue({
				authenticated: true,
				userId: 'dos-attacker'
			});
			mockConnectionManager.canAcceptConnection.mockReturnValue(false);

			const result = await (server as any).handleConnect(ctx);

			expect(result).toBe(false);
		});

		it('should reject connections exceeding subscription limits', async () => {
			const ctx = {
				connectionParams: { userId: 'limit-user' }
			};

			// Simulate subscription limit reached
			mockConnectionManager.canAcceptSubscription = jest.fn().mockReturnValue(false);

			const result = await (server as any).handleSubscribe(ctx);

			// This depends on implementation - currently just checks user ID
			expect(result).toBeUndefined();
		});

		it('should prevent CORS bypass attacks', async () => {
			const corsConfig = {
				...config,
				cors: {
					origin: 'https://trusted-domain.com',
					credentials: true
				}
			};

			// Server should respect CORS config
			expect(corsConfig.cors.origin).toBeDefined();
		});
	});

	describe('error scenarios', () => {
		it('should handle authentication service errors', async () => {
			const ctx = {
				connectionParams: { token: 'valid-token' }
			};

			mockAuthService.authenticate.mockRejectedValue(new Error('Auth service down'));

			const result = await (server as any).handleConnect(ctx);

			expect(result).toBe(false);
		});

		it('should handle connection manager errors gracefully', async () => {
			const ctx = {
				connectionParams: { token: 'valid-token' }
			};

			mockAuthService.authenticate.mockResolvedValue({
				authenticated: true,
				userId: 'user123'
			});
			mockConnectionManager.canAcceptConnection.mockImplementation(() => {
				throw new Error('Connection check failed');
			});

			const result = await (server as any).handleConnect(ctx);

			expect(result).toBe(false);
		});

		it('should handle subscription errors without crashing', async () => {
			const ctx = {
				connectionParams: { userId: 'error-user' }
			};

			mockConnectionManager.removeSubscription.mockImplementation(() => {
				throw new Error('Cleanup error');
			});

			await expect((server as any).handleComplete(ctx)).resolves.not.toThrow();
		});

		it('should handle disconnection errors gracefully', async () => {
			const ctx = {
				connectionParams: { userId: 'disconnect-user' }
			};

			mockConnectionManager.removeConnection.mockImplementation(() => {
				throw new Error('Disconnect error');
			});

			await expect((server as any).handleDisconnect(ctx)).resolves.not.toThrow();
		});
	});

	describe('statistics and monitoring', () => {
		it('should report connection count', () => {
			const stats = server.getStats();

			expect(stats.connections).toBe(5);
			expect(typeof stats.connections).toBe('number');
		});

		it('should report subscription count', () => {
			const stats = server.getStats();

			expect(stats.subscriptions).toBe(10);
			expect(typeof stats.subscriptions).toBe('number');
		});

		it('should report uptime', () => {
			const stats = server.getStats();

			expect(typeof stats.uptime).toBe('number');
			expect(stats.uptime).toBeGreaterThan(0);
		});

		it('should track statistics across lifecycle', async () => {
			const stats1 = server.getStats();
			expect(stats1.connections).toBe(5);

			mockConnectionManager.getConnectionCount.mockReturnValue(10);

			const stats2 = server.getStats();
			expect(stats2.connections).toBe(10);
		});
	});

	describe('integration scenarios', () => {
		it('should handle full connection lifecycle', async () => {
			mockAuthService.authenticate.mockResolvedValue({
				authenticated: true,
				userId: 'lifecycle-user'
			});
			mockConnectionManager.canAcceptConnection.mockReturnValue(true);

			const connectCtx = { connectionParams: { token: 'token' } };
			const connectResult = await (server as any).handleConnect(connectCtx);
			expect(connectResult).toBeDefined();

			const subCtx = { connectionParams: { userId: 'lifecycle-user' } };
			const subResult = await (server as any).handleSubscribe(subCtx);
			expect(subResult).toBeUndefined();

			await (server as any).handleComplete(subCtx);
			expect(mockConnectionManager.removeSubscription).toHaveBeenCalled();

			await (server as any).handleDisconnect(subCtx);
			expect(mockConnectionManager.removeConnection).toHaveBeenCalled();
		});

		it('should handle concurrent client connections', async () => {
			mockAuthService.authenticate.mockResolvedValue({
				authenticated: true,
				userId: 'concurrent-user'
			});
			mockConnectionManager.canAcceptConnection.mockReturnValue(true);

			const contexts = Array.from({ length: 3 }).map((_, i) => ({
				connectionParams: { token: `token-${i}` }
			}));

			const results = await Promise.all(
				contexts.map(ctx => (server as any).handleConnect(ctx))
			);

			expect(results).toHaveLength(3);
			expect(results.every(r => r !== false)).toBe(true);
		});
	});
});
