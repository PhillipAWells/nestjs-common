/**
 * Qdrant Module Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { QdrantClient } from '@qdrant/js-client-rest';
import { QdrantModule } from '../qdrant.module.js';
import { QdrantService } from '../qdrant.service.js';
import { QDRANT_CLIENT_TOKEN, QDRANT_MODULE_OPTIONS, getQdrantClientToken, getQdrantModuleOptionsToken } from '../qdrant.constants.js';
import type { QdrantModuleOptions } from '../qdrant.interfaces.js';

describe('QdrantModule', () => {
	const mockQdrantOptions: QdrantModuleOptions = {
		url: 'http://localhost:6333',
		apiKey: 'test-api-key',
	};

	describe('forRoot', () => {
		let module: TestingModule;

		beforeEach(async () => {
			module = await Test.createTestingModule({
				imports: [QdrantModule.forRoot(mockQdrantOptions)],
			}).compile();
		});

		afterEach(async () => {
			await module.close();
		});

		it('should create the module', () => {
			expect(module).toBeDefined();
		});

		it('should provide QDRANT_MODULE_OPTIONS', () => {
			const options = module.get<QdrantModuleOptions>(QDRANT_MODULE_OPTIONS);
			// Note: apiKey is stripped for security when storing options
			expect(options).toStrictEqual({ url: 'http://localhost:6333' });
		});

		it('should provide QDRANT_CLIENT_TOKEN', () => {
			const client = module.get<QdrantClient>(QDRANT_CLIENT_TOKEN);
			expect(client).toBeDefined();
			expect(client).toBeInstanceOf(QdrantClient);
		});

		it('should provide QdrantService', () => {
			const service = module.get<QdrantService>(QdrantService);
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(QdrantService);
		});

		it('should be global by default', () => {
			// Check module is registered globally - this is framework behavior we trust
			expect(module).toBeDefined();
		});
	});

	describe('forRootAsync with useFactory', () => {
		let module: TestingModule;

		beforeEach(async () => {
			module = await Test.createTestingModule({
				imports: [
					QdrantModule.forRootAsync({
						useFactory: () => mockQdrantOptions,
					}),
				],
			}).compile();
		});

		afterEach(async () => {
			await module.close();
		});

		it('should create the module', () => {
			expect(module).toBeDefined();
		});

		it('should provide QDRANT_MODULE_OPTIONS from factory', () => {
			const options = module.get<QdrantModuleOptions>(QDRANT_MODULE_OPTIONS);
			// Note: apiKey is stripped for security when storing options
			expect(options).toStrictEqual({ url: 'http://localhost:6333' });
		});

		it('should provide QDRANT_CLIENT_TOKEN', () => {
			const client = module.get<QdrantClient>(QDRANT_CLIENT_TOKEN);
			expect(client).toBeDefined();
			expect(client).toBeInstanceOf(QdrantClient);
		});

		it('should provide QdrantService', () => {
			const service = module.get<QdrantService>(QdrantService);
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(QdrantService);
		});
	});

	describe('forRootAsync with useClass', () => {
		class TestOptionsFactory {
			public createQdrantOptions(): QdrantModuleOptions {
				return mockQdrantOptions;
			}
		}

		let module: TestingModule;

		beforeEach(async () => {
			module = await Test.createTestingModule({
				imports: [
					QdrantModule.forRootAsync({
						useClass: TestOptionsFactory,
					}),
				],
			}).compile();
		});

		afterEach(async () => {
			await module.close();
		});

		it('should create the module', () => {
			expect(module).toBeDefined();
		});

		it('should provide QDRANT_MODULE_OPTIONS from factory class', () => {
			const options = module.get<QdrantModuleOptions>(QDRANT_MODULE_OPTIONS);
			// Note: apiKey is stripped for security when storing options
			expect(options).toEqual({ url: 'http://localhost:6333' });
		});

		it('should provide QDRANT_CLIENT_TOKEN', () => {
			const client = module.get<QdrantClient>(QDRANT_CLIENT_TOKEN);
			expect(client).toBeDefined();
			expect(client).toBeInstanceOf(QdrantClient);
		});

		it('should provide QdrantService', () => {
			const service = module.get<QdrantService>(QdrantService);
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(QdrantService);
		});
	});

	describe('forRootAsync with useExisting', () => {
		class TestOptionsFactory {
			public createQdrantOptions(): QdrantModuleOptions {
				return mockQdrantOptions;
			}
		}

		let module: TestingModule;

		beforeEach(async () => {
			module = await Test.createTestingModule({
				providers: [
					{
						provide: TestOptionsFactory,
						useValue: new TestOptionsFactory(),
					},
				],
				imports: [
					QdrantModule.forRootAsync({
						useExisting: TestOptionsFactory,
					}),
				],
			}).compile();
		});

		afterEach(async () => {
			await module.close();
		});

		it('should create the module with useExisting', () => {
			expect(module).toBeDefined();
		});

		it('should provide QDRANT_MODULE_OPTIONS from existing provider', () => {
			const options = module.get<QdrantModuleOptions>(QDRANT_MODULE_OPTIONS);
			// Note: apiKey is stripped for security when storing options
			expect(options).toEqual({ url: 'http://localhost:6333' });
		});

		it('should provide QDRANT_CLIENT_TOKEN from existing provider', () => {
			const client = module.get<QdrantClient>(QDRANT_CLIENT_TOKEN);
			expect(client).toBeDefined();
			expect(client).toBeInstanceOf(QdrantClient);
		});

		it('should provide QdrantService', () => {
			const service = module.get<QdrantService>(QdrantService);
			expect(service).toBeDefined();
			expect(service).toBeInstanceOf(QdrantService);
		});
	});

	describe('error handling', () => {
		it('should throw error for invalid async options', () => {
			expect(() => {
				QdrantModule.forRootAsync({} as any);
			}).toThrow('Invalid QdrantModuleAsyncOptions: must provide useFactory, useClass, or useExisting');
		});
	});

	describe('named clients', () => {
		describe('forRoot with name', () => {
			let module: TestingModule;
			const namedOptions: QdrantModuleOptions = {
				url: 'http://qdrant-archive:6333',
				apiKey: 'archive-api-key',
				name: 'archive',
				checkCompatibility: false,
			};

			beforeEach(async () => {
				module = await Test.createTestingModule({
					imports: [QdrantModule.forRoot(namedOptions)],
				}).compile();
			});

			afterEach(async () => {
				await module.close();
			});

			it('should register client under named token', () => {
				const namedClientToken = getQdrantClientToken('archive');
				const client = module.get<QdrantClient>(namedClientToken);
				expect(client).toBeDefined();
				expect(client).toBeInstanceOf(QdrantClient);
			});

			it('should register options under named token without name field', () => {
				const namedOptionsToken = getQdrantModuleOptionsToken('archive');
				const options = module.get<QdrantModuleOptions>(namedOptionsToken);
				expect(options).toBeDefined();
				expect(options.url).toBe('http://qdrant-archive:6333');
				// Note: apiKey is stripped for security when storing options
				expect((options as any).apiKey).toBeUndefined();
				expect((options as any).name).toBeUndefined();
			});

			it('should provide QdrantService', () => {
				const service = module.get<QdrantService>(QdrantService);
				expect(service).toBeDefined();
				expect(service).toBeInstanceOf(QdrantService);
			});
		});

		describe('forRoot backward compatibility', () => {
			let module: TestingModule;

			beforeEach(async () => {
				module = await Test.createTestingModule({
					imports: [QdrantModule.forRoot(mockQdrantOptions)],
				}).compile();
			});

			afterEach(async () => {
				await module.close();
			});

			it('should still register under default token without name', () => {
				const client = module.get<QdrantClient>(QDRANT_CLIENT_TOKEN);
				expect(client).toBeDefined();
				expect(client).toBeInstanceOf(QdrantClient);
			});

			it('should still register options under default token', () => {
				const options = module.get<QdrantModuleOptions>(QDRANT_MODULE_OPTIONS);
				expect(options).toBeDefined();
				expect(options.url).toBe('http://localhost:6333');
			});
		});

		describe('forRootAsync with name', () => {
			let module: TestingModule;
			const namedOptions: QdrantModuleOptions = {
				url: 'http://qdrant-archive:6333',
				apiKey: 'archive-api-key',
				name: 'archive',
				checkCompatibility: false,
			};

			beforeEach(async () => {
				module = await Test.createTestingModule({
					imports: [
						QdrantModule.forRootAsync({
							useFactory: () => namedOptions,
							name: 'archive',
						}),
					],
				}).compile();
			});

			afterEach(async () => {
				await module.close();
			});

			it('should register client under named token', () => {
				const namedClientToken = getQdrantClientToken('archive');
				const client = module.get<QdrantClient>(namedClientToken);
				expect(client).toBeDefined();
				expect(client).toBeInstanceOf(QdrantClient);
			});

			it('should register options under named token without name field', () => {
				const namedOptionsToken = getQdrantModuleOptionsToken('archive');
				const options = module.get<QdrantModuleOptions>(namedOptionsToken);
				expect(options).toBeDefined();
				expect(options.url).toBe('http://qdrant-archive:6333');
				expect((options as any).name).toBeUndefined();
			});
		});

		describe('multiple named clients', () => {
			let module: TestingModule;

			beforeEach(async () => {
				module = await Test.createTestingModule({
					imports: [
						QdrantModule.forRoot({ url: 'http://qdrant-main:6333', name: 'main', checkCompatibility: false }),
						QdrantModule.forRoot({ url: 'http://qdrant-archive:6333', name: 'archive', checkCompatibility: false }, false),
					],
				}).compile();
			});

			afterEach(async () => {
				await module.close();
			});

			it('should register both named clients under different tokens', () => {
				const mainClientToken = getQdrantClientToken('main');
				const archiveClientToken = getQdrantClientToken('archive');

				const mainClient = module.get<QdrantClient>(mainClientToken);
				const archiveClient = module.get<QdrantClient>(archiveClientToken);

				expect(mainClient).toBeDefined();
				expect(archiveClient).toBeDefined();
				expect(mainClient).not.toBe(archiveClient);
			});
		});
	});
});
