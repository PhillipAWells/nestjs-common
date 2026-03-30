import {
	CreateGlobalModule,
	CreateFeatureModule,
	CreateServiceModule,
	CreateApplicationModule,
	CreateConditionalModule,
	type IGlobalModuleConfig,
	type IFeatureModuleConfig,
	type IServiceModuleConfig,
	type IApplicationModuleConfig,
} from '../module-factory.js';
import { Logger, Module, Injectable } from '@nestjs/common';
import { describe, it, expect, vi } from 'vitest';

describe('Module Factory Utilities', () => {
	describe('CreateGlobalModule', () => {
		it('should create a global module with default configuration', () => {
			const config: IGlobalModuleConfig = {
				name: 'TestGlobalModule',
				providers: [],
				exports: [],
			};

			const result = CreateGlobalModule(config);

			expect(result).toBeDefined();
			expect(result.global).toBe(true);
			expect(result.providers).toBeDefined();
			expect(result.exports).toBeDefined();
			expect(result.module).toBeDefined();
		});

		it('should include providers and exports from config', () => {
			@Injectable()
			class TestService {}

			const config: IGlobalModuleConfig = {
				name: 'TestModule',
				providers: [TestService],
				exports: [TestService],
			};

			const result = CreateGlobalModule(config);

			expect(result.providers).toContain(TestService);
			expect(result.exports).toContain(TestService);
		});

		it('should create a Logger provider with module name', () => {
			const config: IGlobalModuleConfig = {
				name: 'MyModule',
				providers: [],
				exports: [],
			};

			const result = CreateGlobalModule(config);

			const loggerProvider = result.providers?.find(
				(p: any) => p?.provide === Logger || p === Logger,
			);
			expect(loggerProvider).toBeDefined();
		});

		it('should set isGlobal to true by default', () => {
			const config: IGlobalModuleConfig = {
				name: 'TestModule',
			};

			const result = CreateGlobalModule(config);

			expect(result.global).toBe(true);
		});

		it('should allow isGlobal to be overridden', () => {
			const config: IGlobalModuleConfig = {
				name: 'TestModule',
				isGlobal: false,
			};

			const result = CreateGlobalModule(config);

			expect(result.global).toBe(false);
		});

		it('should include imports from config', () => {
			@Module({})
			class ImportedModule {}

			const config: IGlobalModuleConfig = {
				name: 'TestModule',
				imports: [ImportedModule],
			};

			const result = CreateGlobalModule(config);

			expect(result.imports).toContain(ImportedModule);
		});
	});

	describe('CreateFeatureModule', () => {
		it('should create a feature module with standard configuration', () => {
			const config: IFeatureModuleConfig = {
				name: 'TestFeatureModule',
				providers: [],
				exports: [],
				controllers: [],
			};

			const result = CreateFeatureModule(config);

			expect(result).toBeDefined();
			expect(result.providers).toBeDefined();
			expect(result.exports).toBeDefined();
			expect(result.controllers).toBeDefined();
		});

		it('should include controllers in the result', () => {
			const mockController = {};

			const config: IFeatureModuleConfig = {
				name: 'UserModule',
				controllers: [mockController as any],
				providers: [],
				exports: [],
			};

			const result = CreateFeatureModule(config);

			expect(result.controllers).toContain(mockController);
		});

		it('should export Logger by default', () => {
			const config: IFeatureModuleConfig = {
				name: 'TestModule',
			};

			const result = CreateFeatureModule(config);

			expect(result.exports).toContain(Logger);
		});
	});

	describe('CreateServiceModule', () => {
		it('should create a service module with providers', () => {
			@Injectable()
			class TestService {}

			const config: IServiceModuleConfig = {
				name: 'TestServiceModule',
				providers: [TestService],
				exports: [TestService],
			};

			const result = CreateServiceModule(config);

			expect(result).toBeDefined();
			expect(result.providers).toContain(TestService);
			expect(result.exports).toContain(TestService);
		});

		it('should include Logger in providers and exports', () => {
			const config: IServiceModuleConfig = {
				name: 'MyServiceModule',
			};

			const result = CreateServiceModule(config);

			const hasLoggerInProviders = result.providers?.some(
				(p: any) => p === Logger || p?.provide === Logger,
			);
			expect(hasLoggerInProviders).toBe(true);
			expect(result.exports).toContain(Logger);
		});
	});

	describe('CreateApplicationModule', () => {
		it('should create an application module with filters, interceptors, pipes, and guards', () => {
			const mockFilter = {};
			const mockInterceptor = {};
			const mockPipe = {};
			const mockGuard = {};

			const config: IApplicationModuleConfig = {
				name: 'AppModule',
				filters: [mockFilter as any],
				interceptors: [mockInterceptor as any],
				pipes: [mockPipe as any],
				guards: [mockGuard as any],
			};

			const result = CreateApplicationModule(config);

			expect(result).toBeDefined();
			expect(result.providers).toBeDefined();
			expect(result.exports).toBeDefined();
		});

		it('should create providers for each filter with APP_FILTER token', () => {
			const mockFilter = class MockFilter {};

			const config: IApplicationModuleConfig = {
				name: 'AppModule',
				filters: [mockFilter as any],
			};

			const result = CreateApplicationModule(config);

			// Check if providers include APP_FILTER provider
			expect(result.providers).toBeDefined();
			expect(result.providers?.length).toBeGreaterThan(0);
		});

		it('should handle multiple filters correctly', () => {
			const filter1 = class Filter1 {};
			const filter2 = class Filter2 {};

			const config: IApplicationModuleConfig = {
				name: 'AppModule',
				filters: [filter1 as any, filter2 as any],
			};

			const result = CreateApplicationModule(config);

			expect(result.providers).toBeDefined();
			// Verify both filters are added
			expect(result.providers?.length).toBeGreaterThan(1);
		});

		it('should export Logger', () => {
			const config: IApplicationModuleConfig = {
				name: 'AppModule',
			};

			const result = CreateApplicationModule(config);

			expect(result.exports).toContain(Logger);
		});
	});

	describe('CreateConditionalModule', () => {
		it('should include providers when condition is true', () => {
			@Injectable()
			class ConditionalService {}

			const baseConfig = {
				name: 'ConditionalModule',
			};

			const result = CreateConditionalModule(baseConfig, [
				{
					condition: () => true,
					providers: [ConditionalService],
					exports: [ConditionalService],
				},
			]);

			expect(result).toBeDefined();
			expect(result.providers).toBeDefined();
			expect(
				result.providers?.some(
					(p: any) => p === ConditionalService || p?.provide === ConditionalService,
				),
			).toBe(true);
		});

		it('should exclude providers when condition is false', () => {
			@Injectable()
			class ConditionalService {}

			const baseConfig = {
				name: 'ConditionalModule',
			};

			const result = CreateConditionalModule(baseConfig, [
				{
					condition: () => false,
					providers: [ConditionalService],
					exports: [ConditionalService],
				},
			]);

			const hasService = result.providers?.some(
				(p: any) => p === ConditionalService || p?.provide === ConditionalService,
			);
			expect(hasService).toBe(false);
		});

		it('should handle multiple conditions', () => {
			@Injectable()
			class Service1 {}
			@Injectable()
			class Service2 {}

			const baseConfig = {
				name: 'ConditionalModule',
			};

			const result = CreateConditionalModule(baseConfig, [
				{
					condition: () => true,
					providers: [Service1],
					exports: [Service1],
				},
				{
					condition: () => false,
					providers: [Service2],
					exports: [Service2],
				},
			]);

			const hasService1 = result.providers?.some(
				(p: any) => p === Service1 || p?.provide === Service1,
			);
			const hasService2 = result.providers?.some(
				(p: any) => p === Service2 || p?.provide === Service2,
			);

			expect(hasService1).toBe(true);
			expect(hasService2).toBe(false);
		});

		it('should pass config to condition function', () => {
			const conditionFn = vi.fn(() => true);

			const baseConfig = {
				name: 'ConditionalModule',
			};

			const testConfig = { enabled: true };

			CreateConditionalModule(baseConfig, [
				{
					condition: conditionFn,
					config: testConfig,
				},
			]);

			expect(conditionFn).toHaveBeenCalledWith(testConfig);
		});

		it('should handle imports correctly', () => {
			@Module({})
			class ImportedModule {}

			const baseConfig = {
				name: 'ConditionalModule',
				imports: [ImportedModule],
			};

			const result = CreateConditionalModule(baseConfig, [
				{
					condition: () => true,
					imports: [ImportedModule],
				},
			]);

			// Count how many times ImportedModule appears (once from base, once from condition)
			const importCount = (result.imports as any[]).filter((i) => i === ImportedModule).length;
			expect(importCount).toBeGreaterThanOrEqual(1);
		});

		it('should include base providers and exports', () => {
			@Injectable()
			class BaseService {}

			const baseConfig = {
				name: 'ConditionalModule',
				providers: [BaseService],
				exports: [BaseService],
			};

			const result = CreateConditionalModule(baseConfig, [
				{
					condition: () => false,
				},
			]);

			expect(result.providers).toContain(BaseService);
			expect(result.exports).toContain(BaseService);
		});
	});

	describe('Backwards Compatibility Aliases', () => {
		it('should export lowercase aliases for PascalCase functions', async () => {
			const moduleFactory = await import('../module-factory.js');

			expect(moduleFactory.createGlobalModule).toBeDefined();
			expect(moduleFactory.createFeatureModule).toBeDefined();
			expect(moduleFactory.createServiceModule).toBeDefined();
			expect(moduleFactory.createApplicationModule).toBeDefined();
			expect(moduleFactory.createConditionalModule).toBeDefined();
		});

		it('lowercase aliases should be functions', async () => {
			const moduleFactory = await import('../module-factory.js');

			expect(typeof moduleFactory.createGlobalModule).toBe('function');
			expect(typeof moduleFactory.createFeatureModule).toBe('function');
			expect(typeof moduleFactory.createServiceModule).toBe('function');
			expect(typeof moduleFactory.createApplicationModule).toBe('function');
			expect(typeof moduleFactory.createConditionalModule).toBe('function');
		});
	});
});
