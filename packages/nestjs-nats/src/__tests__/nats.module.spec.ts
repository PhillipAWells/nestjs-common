import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { connect } from '@nats-io/transport-node';
import { NatsModule } from '../nats.module.js';
import { NatsService } from '../nats.service.js';
import { NATS_MODULE_OPTIONS } from '../nats.constants.js';
import type { INatsModuleAsyncOptions, TNatsModuleOptions, INatsOptionsFactory } from '../nats.interfaces.js';

vi.mock('@nats-io/transport-node');
vi.mock('@nats-io/jetstream');

const mockConnection = {
	publish: vi.fn(),
	subscribe: vi.fn().mockReturnValue({
		async *[Symbol.asyncIterator]() { /* empty */ },
	}),
	request: vi.fn(),
	drain: vi.fn().mockResolvedValue(undefined),
	isClosed: vi.fn().mockReturnValue(false),
	isDraining: vi.fn().mockReturnValue(false),
	status: vi.fn().mockReturnValue({
		async *[Symbol.asyncIterator]() { /* empty */ },
	}),
};

describe('NatsModule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(connect as Mock).mockResolvedValue(mockConnection);
		mockConnection.isClosed.mockReturnValue(false);
		mockConnection.subscribe.mockReturnValue({
			async *[Symbol.asyncIterator]() { /* empty */ },
		});
		mockConnection.status.mockReturnValue({
			async *[Symbol.asyncIterator]() { /* empty */ },
		});
	});

	describe('forRoot', () => {
		let module: TestingModule;

		beforeEach(async () => {
			module = await Test.createTestingModule({
				imports: [NatsModule.ForRoot({ servers: 'nats://localhost:4222' })],
			}).compile();
		});

		afterEach(async () => {
			await module.close();
		});

		it('should provide NatsService', () => {
			expect(module.get(NatsService)).toBeInstanceOf(NatsService);
		});

		it('should provide the NATS_MODULE_OPTIONS token', () => {
			const opts = module.get(NATS_MODULE_OPTIONS);
			expect(opts).toBeDefined();
			expect(opts).toHaveProperty('servers');
		});

		it('should strip credentials from the public NATS_MODULE_OPTIONS token', async () => {
			const sensitiveOptions: TNatsModuleOptions = {
				servers: 'nats://localhost:4222',
				user: 'alice',
				pass: 'secret',
				token: 'my-token',
			};
			const sensitiveModule = await Test.createTestingModule({
				imports: [NatsModule.ForRoot(sensitiveOptions)],
			}).compile();

			const publicOptions = sensitiveModule.get(NATS_MODULE_OPTIONS);
			expect(publicOptions).not.toHaveProperty('user');
			expect(publicOptions).not.toHaveProperty('pass');
			expect(publicOptions).not.toHaveProperty('token');
			expect(publicOptions).toHaveProperty('servers');

			await sensitiveModule.close();
		});

		it('should not be global by default', () => {
			const dynamicModule = NatsModule.ForRoot({ servers: 'nats://localhost:4222' });
			expect(dynamicModule.global).toBe(false);
		});

		it('should be global when isGlobal is true', () => {
			const dynamicModule = NatsModule.ForRoot({ servers: 'nats://localhost:4222' }, true);
			expect(dynamicModule.global).toBe(true);
		});
	});

	describe('forRootAsync with useFactory', () => {
		let module: TestingModule;

		beforeEach(async () => {
			module = await Test.createTestingModule({
				imports: [
					NatsModule.ForRootAsync({
						useFactory: () => ({ servers: 'nats://localhost:4222' }),
					}),
				],
			}).compile();
		});

		afterEach(async () => {
			await module.close();
		});

		it('should provide NatsService', () => {
			expect(module.get(NatsService)).toBeInstanceOf(NatsService);
		});

		it('should resolve options from the factory', () => {
			const opts = module.get(NATS_MODULE_OPTIONS);
			expect(opts).toHaveProperty('servers');
		});

		it('should strip credentials from options returned by the factory', async () => {
			const sensitiveModule = await Test.createTestingModule({
				imports: [
					NatsModule.ForRootAsync({
						useFactory: (): TNatsModuleOptions => ({
							servers: 'nats://localhost:4222',
							user: 'alice',
							pass: 'secret',
						}),
					}),
				],
			}).compile();

			const publicOptions = sensitiveModule.get(NATS_MODULE_OPTIONS);
			expect(publicOptions).not.toHaveProperty('user');
			expect(publicOptions).not.toHaveProperty('pass');
			expect(publicOptions).toHaveProperty('servers');

			await sensitiveModule.close();
		});
	});

	describe('forRootAsync with useClass', () => {
		let module: TestingModule;

		class TestNatsOptionsFactory implements INatsOptionsFactory {
			public createNatsOptions(): TNatsModuleOptions {
				return { servers: 'nats://localhost:4222' };
			}
		}

		beforeEach(async () => {
			module = await Test.createTestingModule({
				imports: [NatsModule.ForRootAsync({ useClass: TestNatsOptionsFactory })],
			}).compile();
		});

		afterEach(async () => {
			await module.close();
		});

		it('should provide NatsService using the class factory', () => {
			expect(module.get(NatsService)).toBeInstanceOf(NatsService);
		});
	});

	describe('forRootAsync with useExisting', () => {
		it('should provide NatsService using an existing provider', async () => {
			class TestNatsOptionsFactory implements INatsOptionsFactory {
				public createNatsOptions(): TNatsModuleOptions {
					return { servers: 'nats://localhost:4222' };
				}
			}

			@Module({
				providers: [TestNatsOptionsFactory],
				exports: [TestNatsOptionsFactory],
			})
			class TestConfigModule {}

			const module = await Test.createTestingModule({
				imports: [
					NatsModule.ForRootAsync({
						imports: [TestConfigModule],
						useExisting: TestNatsOptionsFactory,
					}),
				],
			}).compile();

			expect(module.get(NatsService)).toBeInstanceOf(NatsService);
			await module.close();
		});
	});

	describe('forRootAsync isGlobal', () => {
		it('should not be global by default', () => {
			const dynamicModule = NatsModule.ForRootAsync({
				useFactory: () => ({ servers: 'nats://localhost:4222' }),
			});
			expect(dynamicModule.global).toBe(false);
		});

		it('should be global when isGlobal is true', () => {
			const dynamicModule = NatsModule.ForRootAsync(
				{ useFactory: () => ({ servers: 'nats://localhost:4222' }) },
				true,
			);
			expect(dynamicModule.global).toBe(true);
		});
	});

	describe('error handling', () => {
		it('should throw for invalid async options (no strategy provided)', () => {
			expect(() => {
				NatsModule.ForRootAsync({} as INatsModuleAsyncOptions);
			}).toThrow('Invalid async module options');
		});
	});
});
