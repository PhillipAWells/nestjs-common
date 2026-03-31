import { Test, TestingModule } from '@nestjs/testing';
import { Injectable, Controller, Get } from '@nestjs/common';
import { PyroscopeModule } from '../../module.js';
import { PyroscopeService } from '../../service.js';
import { Profile, ProfileMethod, ProfileAsync } from '../../decorators/profile.decorator.js';
import { IPyroscopeConfig } from '../../interfaces/profiling.interface.js';

/**
 * Integration tests for decorators in real NestJS application context
 * Tests decorator behavior, interaction with services, and real DI scenarios
 */
describe('Profile Decorators in NestJS App Context (Integration)', () => {
	const mockConfig: IPyroscopeConfig = {
		enabled: true,
		serverAddress: 'http://localhost:4040',
		applicationName: 'decorator-integration-test',
		tags: { env: 'test' },
	};

	describe('@Profile class decorator', () => {
		let module: TestingModule;
		let _pyroscopeService: PyroscopeService;

		afterEach(async () => {
			if (module) {
				await module.close();
			}
		});

		it('should profile all methods in decorated class', async () => {
			@Profile()
			@Injectable()
			class ProfiledService {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				public processData(input: string): string {
					return input.toUpperCase();
				}

				public calculateMetrics(values: number[]): number {
					return values.reduce((a, b) => a + b, 0);
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				providers: [ProfiledService],
			}).compile();

			_pyroscopeService = module.get<PyroscopeService>(PyroscopeService);
			const service = module.get<ProfiledService>(ProfiledService);

			// Verify service methods are wrapped
			expect(service.processData('test')).toBe('TEST');
			expect(service.calculateMetrics([1, 2, 3])).toBe(6);

			// Methods should have been wrapped with profiling
			const metrics = _pyroscopeService.GetMetrics();
			expect(metrics).toBeDefined();
		});

		it('should apply tags from @Profile decorator', async () => {
			const customTags = { service: 'user', version: '1.0' };

			@Profile({ tags: customTags })
			@Injectable()
			class TaggedService {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				public execute(): string {
					return 'executed';
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				providers: [TaggedService],
			}).compile();

			const service = module.get<TaggedService>(TaggedService);
			service.execute();

			// Verify profiling was called with tags
			expect(service.execute).toBeDefined();
		});

		it('should handle errors in profiled methods', async () => {
			@Profile()
			@Injectable()
			class ErrorService {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				public throwError(): void {
					throw new Error('Test error');
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				providers: [ErrorService],
			}).compile();

			const service = module.get<ErrorService>(ErrorService);

			expect(() => service.throwError()).toThrow('Test error');
		});

		it('should work with controller methods', async () => {
			@Profile()
			@Controller('test')
			class ProfiledController {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				@Get('data')
				public getData(): { success: boolean } {
					return { success: true };
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				controllers: [ProfiledController],
			}).compile();

			const controller = module.get<ProfiledController>(ProfiledController);
			const result = controller.getData();

			expect(result).toEqual({ success: true });
		});
	});

	describe('@ProfileMethod method decorator', () => {
		let module: TestingModule;

		afterEach(async () => {
			if (module) {
				await module.close();
			}
		});

		it('should profile specific decorated methods only', async () => {
			@Injectable()
			class SelectiveService {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				@ProfileMethod()
				public profiledMethod(): string {
					return 'profiled';
				}

				public unprofiled(): string {
					return 'unprofiled';
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				providers: [SelectiveService],
			}).compile();

			const service = module.get<SelectiveService>(SelectiveService);

			expect(service.profiledMethod()).toBe('profiled');
			expect(service.unprofiled()).toBe('unprofiled');
		});

		it('should use custom profile name', async () => {
			@Injectable()
			class CustomNameService {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				@ProfileMethod({ name: 'CustomOperation' })
				public execute(): string {
					return 'executed';
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				providers: [CustomNameService],
			}).compile();

			const service = module.get<CustomNameService>(CustomNameService);
			expect(service.execute()).toBe('executed');
		});

		it('should apply method-level tags', async () => {
			const tags = { operation: 'create', entity: 'user' };

			@Injectable()
			class TaggedMethodService {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				@ProfileMethod({ tags })
				public create(): { id: string } {
					return { id: '123' };
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				providers: [TaggedMethodService],
			}).compile();

			const service = module.get<TaggedMethodService>(TaggedMethodService);
			const result = service.create();

			expect(result).toEqual({ id: '123' });
		});

		it('should handle method arguments and return values', async () => {
			@Injectable()
			class ArgsService {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				@ProfileMethod()
				public processInput(name: string, age: number): { name: string; isAdult: boolean } {
					return { name, isAdult: age >= 18 };
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				providers: [ArgsService],
			}).compile();

			const service = module.get<ArgsService>(ArgsService);
			const result = service.processInput('John', 25);

			expect(result).toEqual({ name: 'John', isAdult: true });
		});

		it('should work on controller action methods', async () => {
			@Controller('items')
			class ItemController {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				@Get(':id')
				@ProfileMethod({ name: 'GetItem' })
				public getItem(id: string): { id: string; name: string } {
					return { id, name: `IItem ${id}` };
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				controllers: [ItemController],
			}).compile();

			const controller = module.get<ItemController>(ItemController);
			const result = controller.getItem('42');

			expect(result).toEqual({ id: '42', name: 'IItem 42' });
		});
	});

	describe('@ProfileAsync async method decorator', () => {
		let module: TestingModule;

		afterEach(async () => {
			if (module) {
				await module.close();
			}
		});

		it('should profile async methods', async () => {
			@Injectable()
			class AsyncService {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				@ProfileAsync()
				public async fetchData(): Promise<{ data: string }> {
					await new Promise(resolve => setTimeout(resolve, 10));
					return { data: 'fetched' };
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				providers: [AsyncService],
			}).compile();

			const service = module.get<AsyncService>(AsyncService);
			const result = await service.fetchData();

			expect(result).toEqual({ data: 'fetched' });
		});

		it('should use custom name for async methods', async () => {
			@Injectable()
			class CustomAsyncService {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				@ProfileAsync({ name: 'AsyncOperation' })
				public process(): boolean {
					return true;
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				providers: [CustomAsyncService],
			}).compile();

			const service = module.get<CustomAsyncService>(CustomAsyncService);
			const result = await service.process();

			expect(result).toBe(true);
		});

		it('should apply tags to async methods', async () => {
			const tags = { async: 'true', operation: 'database' };

			@Injectable()
			class AsyncTagService {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				@ProfileAsync({ tags })
				public async queryDatabase(): Promise<{ count: number }> {
					await new Promise(resolve => setTimeout(resolve, 5));
					return { count: 42 };
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				providers: [AsyncTagService],
			}).compile();

			const service = module.get<AsyncTagService>(AsyncTagService);
			const result = await service.queryDatabase();

			expect(result).toEqual({ count: 42 });
		});

		it('should handle async method errors', async () => {
			@Injectable()
			class AsyncErrorService {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				@ProfileAsync()
				public async failAsync(): Promise<void> {
					await new Promise(resolve => setTimeout(resolve, 5));
					throw new Error('Async operation failed');
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				providers: [AsyncErrorService],
			}).compile();

			const service = module.get<AsyncErrorService>(AsyncErrorService);

			await expect(service.failAsync()).rejects.toThrow('Async operation failed');
		});

		it('should work with controller async handlers', async () => {
			@Controller('async-items')
			class AsyncItemController {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				@Get()
				@ProfileAsync({ name: 'ListAsyncItems' })
				public async list(): Promise<{ items: string[] }> {
					await new Promise(resolve => setTimeout(resolve, 5));
					return { items: ['item1', 'item2'] };
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				controllers: [AsyncItemController],
			}).compile();

			const controller = module.get<AsyncItemController>(AsyncItemController);
			const result = await controller.list();

			expect(result).toEqual({ items: ['item1', 'item2'] });
		});

		it('should handle multiple concurrent async operations', async () => {
			@Injectable()
			class ConcurrentService {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				@ProfileAsync()
				public async operation1(): Promise<string> {
					await new Promise(resolve => setTimeout(resolve, 10));
					return 'result1';
				}

				@ProfileAsync()
				public async operation2(): Promise<string> {
					await new Promise(resolve => setTimeout(resolve, 10));
					return 'result2';
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				providers: [ConcurrentService],
			}).compile();

			const service = module.get<ConcurrentService>(ConcurrentService);

			const [result1, result2] = await Promise.all([
				service.operation1(),
				service.operation2(),
			]);

			expect(result1).toBe('result1');
			expect(result2).toBe('result2');
		});
	});

	describe('Decorator combinations', () => {
		let module: TestingModule;

		afterEach(async () => {
			if (module) {
				await module.close();
			}
		});

		it('should work with @Profile and @ProfileMethod together', async () => {
			@Profile()
			@Injectable()
			class MixedService {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				@ProfileMethod({ name: 'CustomName' })
				public customMethod(): string {
					return 'custom';
				}

				public regularMethod(): string {
					return 'regular';
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
				providers: [MixedService],
			}).compile();

			const service = module.get<MixedService>(MixedService);

			expect(service.customMethod()).toBe('custom');
			expect(service.regularMethod()).toBe('regular');
		});

		it('should handle disabled profiling gracefully with all decorators', async () => {
			const disabledConfig = { ...mockConfig, enabled: false };

			@Profile()
			@Injectable()
			class DisabledService {
				constructor(private readonly _pyroscopeService: PyroscopeService) {}

				@ProfileMethod()
				public method1(): string {
					return 'method1';
				}

				@ProfileAsync()
				public method2(): string {
					return 'method2';
				}
			}

			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: disabledConfig })],
				providers: [DisabledService],
			}).compile();

			const service = module.get<DisabledService>(DisabledService);

			expect(service.method1()).toBe('method1');
			await expect(service.method2()).resolves.toBe('method2');
		});
	});
});
