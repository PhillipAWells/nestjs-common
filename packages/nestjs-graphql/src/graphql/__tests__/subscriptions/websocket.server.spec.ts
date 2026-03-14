
import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { GraphQLWebSocketServer } from '../../subscriptions/websocket.server.js';

describe('GraphQLWebSocketServer', () => {
	let server: GraphQLWebSocketServer;
	let module: TestingModule;

	const mockHttpAdapter = {
		getHttpServer: vi.fn(() => ({ on: vi.fn(() => undefined) })),
	};
	const mockHttpAdapterHost = { httpAdapter: mockHttpAdapter };
	const mockSchema = {};
	const mockSchemaHost = { schema: mockSchema };

	beforeEach(async () => {
		const mockModuleRef = {
			get: vi.fn((token: any) => {
				if (token === HttpAdapterHost) return mockHttpAdapterHost;
				if (token === GraphQLSchemaHost) return mockSchemaHost;
				throw new Error(`Unknown token: ${String(token)}`);
			}),
		} as any;

		module = await Test.createTestingModule({
			providers: [
				{
					provide: GraphQLWebSocketServer,
					useFactory: () => new GraphQLWebSocketServer(mockModuleRef),
				},
			],
		}).compile();

		server = module.get<GraphQLWebSocketServer>(GraphQLWebSocketServer);
	});

	describe('initialize', () => {
		it('should initialize without errors when config is valid', async () => {
			const config = { path: '/graphql', keepalive: 12000, maxPayloadSize: 102400, connectionTimeout: 60000 };
			await expect(server.initialize(config)).resolves.toBeUndefined();
		});

		it('should warn when HttpAdapterHost is unavailable', async () => {
			const config = { path: '/graphql', keepalive: 12000, maxPayloadSize: 102400, connectionTimeout: 60000 };

			// Create a new server instance with broken module ref
			const brokenModuleRef = {
				get: vi.fn(() => {
					throw new Error('not found');
				}),
			} as any;
			const brokenServer = new (server.constructor as any)(brokenModuleRef);
			const brokenLoggerSpy = vi.spyOn(brokenServer['logger'], 'warn');

			await brokenServer.initialize(config);

			expect(brokenLoggerSpy).toHaveBeenCalledWith(expect.stringContaining('HttpAdapterHost unavailable'));
		});
	});

	describe('onModuleDestroy', () => {
		it('should cleanup on destroy without errors', async () => {
			await expect(server.onModuleDestroy()).resolves.toBeUndefined();
		});
	});

	describe('configure', () => {
		it('should store configuration for auto-initialization', async () => {
			const config = { path: '/graphql', keepalive: 12000, maxPayloadSize: 102400, connectionTimeout: 60000 };
			server.configure(config);
			const initSpy = vi.spyOn(server, 'initialize').mockResolvedValue(undefined);
			await server.onApplicationBootstrap();
			expect(initSpy).toHaveBeenCalledWith(config);
		});
	});

	describe('onApplicationBootstrap', () => {
		it('should skip initialization when no config is set', async () => {
			const initSpy = vi.spyOn(server, 'initialize');
			await server.onApplicationBootstrap();
			expect(initSpy).not.toHaveBeenCalled();
		});
	});
});
