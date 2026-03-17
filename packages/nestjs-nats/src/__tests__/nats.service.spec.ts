import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { connect } from '@nats-io/transport-node';
import {
	jetstream as createJetStream,
	jetstreamManager as createJetStreamManager,
} from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/transport-node';
import { NatsService } from '../nats.service.js';
import { NATS_MODULE_OPTIONS_RAW } from '../nats.constants.js';

vi.mock('@nats-io/transport-node');
vi.mock('@nats-io/jetstream');

const mockSubscription = {
	[Symbol.asyncIterator]: vi.fn().mockReturnValue({
		next: vi.fn().mockResolvedValue({ done: true, value: undefined }),
	}),
	unsubscribe: vi.fn(),
};

const mockConnection = {
	publish: vi.fn(),
	subscribe: vi.fn().mockReturnValue(mockSubscription),
	request: vi.fn(),
	drain: vi.fn().mockResolvedValue(undefined),
	isClosed: vi.fn().mockReturnValue(false),
	isDraining: vi.fn().mockReturnValue(false),
	status: vi.fn().mockReturnValue({
		async *[Symbol.asyncIterator]() { /* empty status iterator */ },
	}),
};

const mockOptions = { servers: 'nats://localhost:4222' };

describe('NatsService', () => {
	let service: NatsService;

	beforeEach(async () => {
		vi.clearAllMocks();
		(connect as Mock).mockResolvedValue(mockConnection);
		mockConnection.isClosed.mockReturnValue(false);
		mockConnection.isDraining.mockReturnValue(false);
		mockConnection.subscribe.mockReturnValue(mockSubscription);
		mockConnection.status.mockReturnValue({
			async *[Symbol.asyncIterator]() { /* empty status iterator */ },
		});
		mockSubscription[Symbol.asyncIterator].mockReturnValue({
			next: vi.fn().mockResolvedValue({ done: true, value: undefined }),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				NatsService,
				{ provide: NATS_MODULE_OPTIONS_RAW, useValue: mockOptions },
			],
		}).compile();

		service = module.get<NatsService>(NatsService);
		await service.onModuleInit();
	});

	afterEach(async () => {
		mockConnection.isClosed.mockReturnValue(true);
		await service.onApplicationShutdown();
	});

	describe('onModuleInit', () => {
		it('should connect to NATS with the provided options', () => {
			expect(connect).toHaveBeenCalledWith(mockOptions);
		});

		it('should mark the connection as established', () => {
			expect(service.isConnected()).toBe(true);
		});
	});

	describe('onApplicationShutdown', () => {
		it('should drain the connection on shutdown', async () => {
			mockConnection.isClosed.mockReturnValue(false);
			await service.onApplicationShutdown('SIGTERM');
			expect(mockConnection.drain).toHaveBeenCalled();
		});

		it('should not drain if the connection is already closed', async () => {
			mockConnection.isClosed.mockReturnValue(true);
			mockConnection.drain.mockClear();
			await service.onApplicationShutdown();
			expect(mockConnection.drain).not.toHaveBeenCalled();
		});
	});

	describe('isConnected', () => {
		it('should return true when connected and not draining', () => {
			expect(service.isConnected()).toBe(true);
		});

		it('should return false when the connection is closed', () => {
			mockConnection.isClosed.mockReturnValue(true);
			expect(service.isConnected()).toBe(false);
		});

		it('should return false when the connection is draining', () => {
			mockConnection.isDraining.mockReturnValue(true);
			expect(service.isConnected()).toBe(false);
		});

		it('should return false before onModuleInit is called', () => {
			const uninitializedService = new NatsService(mockOptions);
			expect(uninitializedService.isConnected()).toBe(false);
		});
	});

	describe('getConnection', () => {
		it('should return the raw NatsConnection', () => {
			expect(service.getConnection()).toBe(mockConnection);
		});

		it('should throw if the connection is not established', () => {
			const uninitializedService = new NatsService(mockOptions);
			expect(() => uninitializedService.getConnection()).toThrow(
				'NATS connection is not established or is draining',
			);
		});
	});

	describe('publish', () => {
		it('should publish a string message to a subject', () => {
			service.publish('test.subject', 'hello world');
			expect(mockConnection.publish).toHaveBeenCalledWith('test.subject', 'hello world', undefined);
		});

		it('should publish without a payload', () => {
			service.publish('test.subject');
			expect(mockConnection.publish).toHaveBeenCalledWith('test.subject', undefined, undefined);
		});

		it('should pass through publish options', () => {
			const opts = { reply: 'reply.inbox' };
			service.publish('test.subject', 'data', opts);
			expect(mockConnection.publish).toHaveBeenCalledWith('test.subject', 'data', opts);
		});

		it('should throw if the connection is not established', () => {
			const uninitializedService = new NatsService(mockOptions);
			expect(() => uninitializedService.publish('test.subject', 'data')).toThrow(
				'NATS connection is not established or is draining',
			);
		});

		it('should throw if the connection is draining', () => {
			mockConnection.isDraining.mockReturnValue(true);
			expect(() => service.publish('test.subject', 'data')).toThrow(
				'NATS connection is not established or is draining',
			);
		});
	});

	describe('publishJson', () => {
		it('should serialize data as JSON and publish to the subject', () => {
			const data = { id: 1, name: 'order' };
			service.publishJson('orders.created', data);
			expect(mockConnection.publish).toHaveBeenCalledWith(
				'orders.created',
				JSON.stringify(data),
				undefined,
			);
		});
	});

	describe('subscribe', () => {
		it('should subscribe to a subject and return the subscription', () => {
			const handler = vi.fn();
			const sub = service.subscribe('test.subject', handler);
			expect(mockConnection.subscribe).toHaveBeenCalledWith('test.subject', undefined);
			expect(sub).toBe(mockSubscription);
		});

		it('should subscribe with a queue group', () => {
			const handler = vi.fn();
			service.subscribe('test.subject', handler, { queue: 'worker-pool' });
			expect(mockConnection.subscribe).toHaveBeenCalledWith('test.subject', { queue: 'worker-pool' });
		});

		it('should call the handler when a message arrives', async () => {
			const handler = vi.fn();
			const mockMessage = { json: vi.fn().mockReturnValue({ test: 'data' }) };

			mockConnection.subscribe.mockReturnValue({
				async *[Symbol.asyncIterator]() {
					yield mockMessage;
				},
				unsubscribe: vi.fn(),
			});

			service.subscribe('test.subject', handler);

			// Give the async iterator time to process
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(handler).toHaveBeenCalledWith(mockMessage);
		});

		it('should log handler errors without crashing the subscription', async () => {
			const error = new Error('Handler error');
			const handler = vi.fn().mockRejectedValue(error);
			const loggerErrorSpy = vi.spyOn(service['logger'], 'error');

			mockConnection.subscribe.mockReturnValue({
				async *[Symbol.asyncIterator]() {
					yield { json: vi.fn() };
				},
				unsubscribe: vi.fn(),
			});

			service.subscribe('test.subject', handler);

			// Give the async iterator time to process
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(loggerErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Handler error on subject "test.subject"'),
				expect.any(String),
			);
			loggerErrorSpy.mockRestore();
		});
	});

	describe('request', () => {
		it('should send a request and return the reply message', async () => {
			const mockReply = { json: vi.fn().mockReturnValue({ ok: true }) };
			mockConnection.request.mockResolvedValue(mockReply);

			const reply = await service.request('user.get', JSON.stringify({ id: 42 }));
			expect(mockConnection.request).toHaveBeenCalledWith(
				'user.get',
				JSON.stringify({ id: 42 }),
				undefined,
			);
			expect(reply).toBe(mockReply);
		});
	});

	describe('requestJson', () => {
		it('should serialize the request and deserialize the JSON response', async () => {
			const mockReply = { json: vi.fn().mockReturnValue({ name: 'Alice' }) };
			mockConnection.request.mockResolvedValue(mockReply);

			const result = await service.requestJson<{ id: number }, { name: string }>(
				'user.get',
				{ id: 1 },
			);
			expect(result).toEqual({ name: 'Alice' });
		});
	});

	describe('jetstream', () => {
		it('should return a JetStream client for the connection', () => {
			const mockJs = { publish: vi.fn() };
			(createJetStream as Mock).mockReturnValue(mockJs);
			expect(service.jetstream()).toBe(mockJs);
			expect(createJetStream).toHaveBeenCalledWith(mockConnection);
		});
	});

	describe('jetstreamManager', () => {
		it('should return a JetStreamManager for the connection', async () => {
			const mockJsm = { streams: { add: vi.fn() } };
			(createJetStreamManager as Mock).mockResolvedValue(mockJsm);
			await expect(service.jetstreamManager()).resolves.toBe(mockJsm);
			expect(createJetStreamManager).toHaveBeenCalledWith(mockConnection);
		});
	});

	describe('monitorStatus', () => {
		it('should log disconnect status events', async () => {
			const statusIterator = {
				async *[Symbol.asyncIterator]() {
					yield { type: 'disconnect' };
				},
			};
			mockConnection.status.mockReturnValue(statusIterator);

			const newService = new NatsService(mockOptions);
			newService['connection'] = mockConnection as unknown as NatsConnection;
			const loggerWarnSpy = vi.spyOn(newService['logger'], 'warn');
			newService['monitorStatus']();

			// Give the async iterator time to process
			await new Promise(resolve => setImmediate(resolve));

			expect(loggerWarnSpy).toHaveBeenCalledWith('NATS disconnected');
			loggerWarnSpy.mockRestore();
		});

		it('should log reconnecting status events', async () => {
			const statusIterator = {
				async *[Symbol.asyncIterator]() {
					yield { type: 'reconnecting' };
				},
			};
			mockConnection.status.mockReturnValue(statusIterator);

			const newService = new NatsService(mockOptions);
			newService['connection'] = mockConnection as unknown as NatsConnection;
			const loggerWarnSpy = vi.spyOn(newService['logger'], 'warn');
			newService['monitorStatus']();

			// Give the async iterator time to process
			await new Promise(resolve => setImmediate(resolve));

			expect(loggerWarnSpy).toHaveBeenCalledWith('NATS reconnecting...');
			loggerWarnSpy.mockRestore();
		});

		it('should log reconnect status events', async () => {
			const statusIterator = {
				async *[Symbol.asyncIterator]() {
					yield { type: 'reconnect' };
				},
			};
			mockConnection.status.mockReturnValue(statusIterator);

			const newService = new NatsService(mockOptions);
			newService['connection'] = mockConnection as unknown as NatsConnection;
			const loggerLogSpy = vi.spyOn(newService['logger'], 'log');
			newService['monitorStatus']();

			// Give the async iterator time to process
			await new Promise(resolve => setImmediate(resolve));

			expect(loggerLogSpy).toHaveBeenCalledWith('NATS reconnected');
			loggerLogSpy.mockRestore();
		});

		it('should log error status events with error details', async () => {
			const testError = new Error('Connection error');
			const statusIterator = {
				async *[Symbol.asyncIterator]() {
					yield { type: 'error', error: testError };
				},
			};
			mockConnection.status.mockReturnValue(statusIterator);

			const newService = new NatsService(mockOptions);
			newService['connection'] = mockConnection as unknown as NatsConnection;
			const loggerErrorSpy = vi.spyOn(newService['logger'], 'error');
			newService['monitorStatus']();

			// Give the async iterator time to process
			await new Promise(resolve => setImmediate(resolve));

			expect(loggerErrorSpy).toHaveBeenCalledWith('NATS async error', expect.stringContaining('Error'));
			loggerErrorSpy.mockRestore();
		});

		it('should log ldm status events', async () => {
			const statusIterator = {
				async *[Symbol.asyncIterator]() {
					yield { type: 'ldm' };
				},
			};
			mockConnection.status.mockReturnValue(statusIterator);

			const newService = new NatsService(mockOptions);
			newService['connection'] = mockConnection as unknown as NatsConnection;
			const loggerWarnSpy = vi.spyOn(newService['logger'], 'warn');
			newService['monitorStatus']();

			// Give the async iterator time to process
			await new Promise(resolve => setImmediate(resolve));

			expect(loggerWarnSpy).toHaveBeenCalledWith('NATS server entering lame duck mode');
			loggerWarnSpy.mockRestore();
		});
	});
});
