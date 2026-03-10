
import { vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { GraphQLWebSocketServer } from '../../subscriptions/websocket.server.js';

describe('GraphQLWebSocketServer', () => {
	let server: GraphQLWebSocketServer;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [GraphQLWebSocketServer],
		}).compile();

		server = module.get<GraphQLWebSocketServer>(GraphQLWebSocketServer);
	});

	describe('initialize', () => {
		it('should initialize without errors', async () => {
			await expect(server.initialize()).resolves.toBeUndefined();
		});

		it('should log warning when initialized (stub implementation)', async () => {
			const loggerSpy = vi.spyOn(server['logger'], 'warn');

			await server.initialize();

			expect(loggerSpy).toHaveBeenCalledWith('GraphQLWebSocketServer is stubbed - GraphQL subscriptions disabled');
		});
	});

	describe('onModuleDestroy', () => {
		it('should cleanup on destroy without errors', async () => {
			await expect(server.onModuleDestroy()).resolves.toBeUndefined();
		});
	});
});
