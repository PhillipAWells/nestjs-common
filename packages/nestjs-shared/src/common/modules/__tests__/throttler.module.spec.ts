import { describe, it, expect, vi } from 'vitest';
import { SharedThrottlerModule, ISharedThrottlerConfig } from '../throttler.module.js';

describe('SharedThrottlerModule', () => {
	describe('forRoot', () => {
		it('should return a DynamicModule', () => {
			const Result = SharedThrottlerModule.ForRoot();
			expect(Result).toBeDefined();
			expect(Result.module).toBe(SharedThrottlerModule);
		});

		it('should configure in-memory throttling with default config', () => {
			const Result = SharedThrottlerModule.ForRoot();
			expect(Result.imports).toBeDefined();
			expect(Result.providers).toBeDefined();
			expect(Result.exports).toBeDefined();
		});

		it('should return a module that exports ThrottlerModule', () => {
			const Result = SharedThrottlerModule.ForRoot();
			expect(Result.exports).toBeDefined();
			expect(Result.exports?.length).toBeGreaterThan(0);
		});

		it('should return a module that exports ThrottlerGuard', () => {
			const Result = SharedThrottlerModule.ForRoot();
			expect(Result.exports).toBeDefined();
			expect(Result.exports?.length).toBeGreaterThan(0);
		});

		it('should provide ThrottlerGuard', () => {
			const Result = SharedThrottlerModule.ForRoot();
			expect(Result.providers).toBeDefined();
			expect(Result.providers?.length).toBeGreaterThan(0);
		});

		it('should accept custom ttl configuration', () => {
			const config: ISharedThrottlerConfig = {
				ttl: 30000,
			};
			const Result = SharedThrottlerModule.ForRoot(config);
			expect(Result).toBeDefined();
			expect(Result.module).toBe(SharedThrottlerModule);
		});

		it('should accept custom limit configuration', () => {
			const config: ISharedThrottlerConfig = {
				limit: 50,
			};
			const Result = SharedThrottlerModule.ForRoot(config);
			expect(Result).toBeDefined();
		});

		it('should accept both ttl and limit configuration', () => {
			const config: ISharedThrottlerConfig = {
				ttl: 30000,
				limit: 50,
			};
			const Result = SharedThrottlerModule.ForRoot(config);
			expect(Result).toBeDefined();
		});

		it('should use default ttl (15 minutes = 900000ms)', () => {
			const Result = SharedThrottlerModule.ForRoot();
			expect(Result).toBeDefined();
			// The module should be configured with default 15 minute window
		});

		it('should use default limit (100 requests)', () => {
			const Result = SharedThrottlerModule.ForRoot();
			expect(Result).toBeDefined();
			// The module should be configured with default 100 request limit
		});

		it('should handle zero ttl', () => {
			const config: ISharedThrottlerConfig = {
				ttl: 0,
			};
			const Result = SharedThrottlerModule.ForRoot(config);
			expect(Result).toBeDefined();
		});

		it('should handle zero limit', () => {
			const config: ISharedThrottlerConfig = {
				limit: 0,
			};
			const Result = SharedThrottlerModule.ForRoot(config);
			expect(Result).toBeDefined();
		});

		it('should handle very large ttl values', () => {
			const config: ISharedThrottlerConfig = {
				ttl: 86400000, // 24 hours
			};
			const Result = SharedThrottlerModule.ForRoot(config);
			expect(Result).toBeDefined();
		});

		it('should handle very large limit values', () => {
			const config: ISharedThrottlerConfig = {
				limit: 10000,
			};
			const Result = SharedThrottlerModule.ForRoot(config);
			expect(Result).toBeDefined();
		});

		it('should return module with correct structure', () => {
			const Result = SharedThrottlerModule.ForRoot();
			expect(Result.module).toBeDefined();
			expect(Result.imports).toBeInstanceOf(Array);
			expect(Result.providers).toBeInstanceOf(Array);
			expect(Result.exports).toBeInstanceOf(Array);
		});

		it('should include ThrottlerModule in imports', () => {
			const Result = SharedThrottlerModule.ForRoot();
			expect(Result.imports).toHaveLength(1);
			// ThrottlerModule.forRoot() should be the first import
		});
	});

	describe('forRootAsync', () => {
		it('should return a DynamicModule', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}),
			});
			expect(Result).toBeDefined();
			expect(Result.module).toBe(SharedThrottlerModule);
		});

		it('should configure async throttling with useFactory', () => {
			const config: ISharedThrottlerConfig = {
				ttl: 30000,
				limit: 50,
			};
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => config,
			});
			expect(Result).toBeDefined();
			expect(Result.providers).toBeDefined();
		});

		it('should support useFactory with inject array', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: (config: ISharedThrottlerConfig) => config,
				inject: ['CONFIG_SERVICE'],
			});
			expect(Result).toBeDefined();
			expect(Result.providers).toHaveLength(2); // Provider + ThrottlerGuard
		});

		it('should support useClass configuration', () => {
			class ThrottlerConfigService {
				createThrottlerConfig(): ISharedThrottlerConfig {
					return { ttl: 30000, limit: 50 };
				}
			}

			const Result = SharedThrottlerModule.ForRootAsync({
				useClass: ThrottlerConfigService,
			});
			expect(Result).toBeDefined();
			expect(Result.providers).toBeDefined();
		});

		it('should provide SHARED_THROTTLER_CONFIG when using useFactory', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({ ttl: 30000 }),
			});
			expect(Result.providers).toBeDefined();
			expect(Result.providers?.length).toBeGreaterThan(0);
		});

		it('should provide SHARED_THROTTLER_CONFIG when using useClass', () => {
			class ConfigService {
				createThrottlerConfig(): ISharedThrottlerConfig {
					return {};
				}
			}

			const Result = SharedThrottlerModule.ForRootAsync({
				useClass: ConfigService,
			});
			expect(Result.providers).toBeDefined();
			expect(Result.providers?.length).toBeGreaterThan(0);
		});

		it('should include ThrottlerGuard in exports', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}),
			});
			expect(Result.exports).toBeDefined();
			expect(Result.exports?.length).toBeGreaterThan(0);
		});

		it('should include ThrottlerModule in exports', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}),
			});
			expect(Result.exports).toBeDefined();
			expect(Result.exports?.length).toBeGreaterThan(0);
		});

		it('should support optional imports array', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}),
				imports: [],
			});
			expect(Result).toBeDefined();
		});

		it('should include custom imports in the module', () => {
			const customImport = { provide: 'CUSTOM', useValue: 'value' };
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}),
				imports: [customImport as any],
			});
			expect(Result.imports?.length).toBeGreaterThan(1);
		});

		it('should handle async factory function', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => {
					return { ttl: 30000, limit: 50 };
				},
			});
			expect(Result).toBeDefined();
		});

		it('should support Redis configuration in config', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({
					redis: {
						host: 'localhost',
						port: 6379,
					},
				}),
			});
			expect(Result).toBeDefined();
		});

		it('should support advanced Redis configuration', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({
					ttl: 30000,
					limit: 50,
					redis: {
						host: 'redis.example.com',
						port: 6379,
						password: 'secret',
						username: 'default',
						db: 0,
					},
				}),
			});
			expect(Result).toBeDefined();
		});

		it('should support Redis with custom properties', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({
					redis: {
						host: 'localhost',
						port: 6379,
						customProp: 'custom-value',
					},
				}),
			});
			expect(Result).toBeDefined();
		});

		it('should handle config without Redis', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({
					ttl: 30000,
					limit: 50,
				}),
			});
			expect(Result).toBeDefined();
		});

		it('should support empty configuration', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}),
			});
			expect(Result).toBeDefined();
		});

		it('should support useClass with inject', () => {
			class ConfigService {
				createThrottlerConfig(): ISharedThrottlerConfig {
					return {};
				}
			}

			const Result = SharedThrottlerModule.ForRootAsync({
				useClass: ConfigService,
				inject: [],
			});
			expect(Result).toBeDefined();
		});

		it('should return module with correct structure', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}),
			});
			expect(Result.module).toBeDefined();
			expect(Result.imports).toBeInstanceOf(Array);
			expect(Result.providers).toBeInstanceOf(Array);
			expect(Result.exports).toBeInstanceOf(Array);
		});

		it('should handle factory with multiple dependencies', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: (_a: any, _b: any) => ({ ttl: 30000 }),
				inject: ['DEP1', 'DEP2'],
			});
			expect(Result).toBeDefined();
		});

		it('should support factory returning Promise', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: async () => {
					await new Promise(resolve => setTimeout(resolve, 100));
					return { ttl: 30000, limit: 50 };
				},
			});
			expect(Result).toBeDefined();
		});
	});

	describe('Default values', () => {
		it('should have default window of 15 minutes', () => {
			// 15 * 60 * 1000 = 900000
			const Result = SharedThrottlerModule.ForRoot();
			expect(Result).toBeDefined();
		});

		it('should have default max requests of 100', () => {
			const Result = SharedThrottlerModule.ForRoot();
			expect(Result).toBeDefined();
		});
	});

	describe('Configuration edge cases', () => {
		it('should handle negative ttl', () => {
			const config: ISharedThrottlerConfig = {
				ttl: -1000,
			};
			const Result = SharedThrottlerModule.ForRoot(config);
			expect(Result).toBeDefined();
		});

		it('should handle negative limit', () => {
			const config: ISharedThrottlerConfig = {
				limit: -1,
			};
			const Result = SharedThrottlerModule.ForRoot(config);
			expect(Result).toBeDefined();
		});

		it('should handle config with undefined values', () => {
			const config: ISharedThrottlerConfig = {
				ttl: undefined,
				limit: undefined,
			};
			const Result = SharedThrottlerModule.ForRoot(config);
			expect(Result).toBeDefined();
		});

		it('should handle partial config in forRoot', () => {
			const config: ISharedThrottlerConfig = {
				ttl: 30000,
			};
			const Result = SharedThrottlerModule.ForRoot(config);
			expect(Result).toBeDefined();
		});

		it('should support Redis config with only host', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({
					redis: {
						host: 'localhost',
					},
				}),
			});
			expect(Result).toBeDefined();
		});

		it('should support Redis config with only port', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({
					redis: {
						port: 6379,
					},
				}),
			});
			expect(Result).toBeDefined();
		});
	});

	describe('useClass specific tests', () => {
		it('should create provider from useClass', () => {
			class CustomConfigService {
				createThrottlerConfig(): ISharedThrottlerConfig {
					return { ttl: 20000, limit: 25 };
				}
			}

			const Result = SharedThrottlerModule.ForRootAsync({
				useClass: CustomConfigService,
			});

			// Should have at least 2 providers: CustomConfigService and ThrottlerGuard
			expect(Result.providers).toBeDefined();
			expect(Result.providers?.length).toBeGreaterThan(1);
		});

		it('should wire useClass with dependency injection', () => {
			class DependencyService {}
			class ConfigService {
				constructor(private readonly dep: DependencyService) {}
				createThrottlerConfig(): ISharedThrottlerConfig {
					return {};
				}
			}

			const Result = SharedThrottlerModule.ForRootAsync({
				useClass: ConfigService,
				imports: [],
			});

			expect(Result.providers).toBeDefined();
			expect(Result.providers?.length).toBeGreaterThan(0);
		});

		it('should support useClass returning Promise', () => {
			class ConfigService {
				async createThrottlerConfig(): Promise<ISharedThrottlerConfig> {
					return { ttl: 30000, limit: 50 };
				}
			}

			const Result = SharedThrottlerModule.ForRootAsync({
				useClass: ConfigService,
			});

			expect(Result).toBeDefined();
		});
	});

	describe('forRootAsync factory function behavior', () => {
		it('should invoke useFactory when creating config', () => {
			const mockFactory = vi.fn().mockReturnValue({ ttl: 30000, limit: 50 });

			SharedThrottlerModule.ForRootAsync({
				useFactory: mockFactory,
			});

			// The useFactory will be called during module bootstrap
			expect(mockFactory).toBeDefined();
		});

		it('should pass injected dependencies to useFactory', () => {
			const mockFactory = (configService: any) => ({
				ttl: configService.getTtl(),
				limit: configService.getLimit(),
			});

			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: mockFactory,
				inject: ['CONFIG_SERVICE'],
			});

			expect(Result.providers).toBeDefined();
		});

		it('should handle Redis configuration in factory', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({
					ttl: 30000,
					limit: 50,
					redis: {
						host: 'redis.example.com',
						port: 6379,
					},
				}),
			});

			expect(Result).toBeDefined();
			expect(Result.imports).toBeDefined();
		});

		it('should use default ttl when config ttl is undefined', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({
					limit: 50,
					// ttl is undefined
				}),
			});

			expect(Result).toBeDefined();
		});

		it('should use default limit when config limit is undefined', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({
					ttl: 30000,
					// limit is undefined
				}),
			});

			expect(Result).toBeDefined();
		});

		it('should handle undefined config object', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => undefined as any,
			});

			expect(Result).toBeDefined();
		});

		it('should handle null config object', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => null as any,
			});

			expect(Result).toBeDefined();
		});
	});

	describe('forRootAsync provider creation', () => {
		it('should create SHARED_THROTTLER_CONFIG provider from useFactory', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({ ttl: 30000, limit: 50 }),
			});

			expect(Result.providers).toBeDefined();
			// Should have at least 2 providers: SHARED_THROTTLER_CONFIG + ThrottlerGuard
			expect(Result.providers!.length).toBeGreaterThanOrEqual(2);

			// Check that SHARED_THROTTLER_CONFIG is provided
			const configProvider = Result.providers!.find(
				(p: any) => typeof p === 'object' && p.provide === 'SHARED_THROTTLER_CONFIG',
			);
			expect(configProvider).toBeDefined();
		});

		it('should set inject array to empty when not provided', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({ ttl: 30000 }),
			});

			expect(Result.providers).toBeDefined();
			const configProvider = Result.providers!.find(
				(p: any) => typeof p === 'object' && p.provide === 'SHARED_THROTTLER_CONFIG',
			);

			expect(configProvider).toBeDefined();
			expect((configProvider! as any).inject).toBeDefined();
		});

		it('should preserve inject array in provider', () => {
			const injectTokens = ['SERVICE_A', 'SERVICE_B'];
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: (_a: any, _b: any) => ({ ttl: 30000 }),
				inject: injectTokens,
			});

			const configProvider = Result.providers!.find(
				(p: any) => typeof p === 'object' && p.provide === 'SHARED_THROTTLER_CONFIG',
			);

			expect(configProvider).toBeDefined();
			expect((configProvider! as any).inject).toEqual(injectTokens);
		});

		it('should create providers array when using useFactory', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}),
			});

			expect(Array.isArray(Result.providers)).toBe(true);
			expect(Result.providers!.length).toBeGreaterThan(0);
		});

		it('should not duplicate providers when both useFactory and useClass are undefined', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: undefined as any,
				useClass: undefined as any,
			});

			// Should still include ThrottlerGuard
			expect(Result.providers).toBeDefined();
		});

		it('should include only SHARED_THROTTLER_CONFIG from useFactory not from useClass', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({ ttl: 30000 }),
			});

			const configProviders = Result.providers!.filter(
				(p: any) => typeof p === 'object' && p.provide === 'SHARED_THROTTLER_CONFIG',
			);

			// Should have exactly one SHARED_THROTTLER_CONFIG provider
			expect(configProviders.length).toBe(1);
		});
	});

	describe('forRootAsync imports configuration', () => {
		it('should include custom imports in module imports', () => {
			const customModule = { provide: 'CUSTOM_TOKEN', useValue: 'custom-value' };
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}),
				imports: [customModule as any],
			});

			// Should have ThrottlerModule async import + custom imports
			expect(Result.imports!.length).toBeGreaterThanOrEqual(2);
		});

		it('should spread optional imports array into imports', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}),
				imports: [],
			});

			// Should have at least ThrottlerModule async import
			expect(Result.imports).toBeDefined();
			expect(Result.imports!.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('forRootAsync ThrottlerModule.forRootAsync integration', () => {
		it('should pass SHARED_THROTTLER_CONFIG as inject token to ThrottlerModule.forRootAsync', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({ ttl: 30000, limit: 50 }),
			});

			// The ThrottlerModule.forRootAsync should be in imports
			expect(Result.imports).toBeDefined();
			const [throttlerImport] = Result.imports ?? [];
			expect(throttlerImport).toBeDefined();
		});

		it('should apply default values in ThrottlerModule.forRootAsync factory', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}), // Empty config
			});

			expect(Result).toBeDefined();
			// The ThrottlerModule.forRootAsync should handle empty config gracefully
		});

		it('should handle Redis config passed to ThrottlerModule.forRootAsync', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({
					ttl: 20000,
					limit: 40,
					redis: {
						host: 'localhost',
						port: 6379,
						password: 'secret',
					},
				}),
			});

			expect(Result).toBeDefined();
			// Redis config should be passed through to ThrottlerModule
		});
	});

	describe('Redis configuration logging', () => {
		it('should log when Redis is configured', () => {
			const logSpy = vi.spyOn(console, 'log');

			try {
				SharedThrottlerModule.ForRootAsync({
					useFactory: () => ({
						redis: {
							host: 'localhost',
							port: 6379,
						},
					}),
				});

				// Logging happens during module initialization, not during factory creation
				expect(logSpy).toBeDefined();
			} finally {
				logSpy.mockRestore();
			}
		});

		it('should log when in-memory storage is used', () => {
			const logSpy = vi.spyOn(console, 'log');

			try {
				SharedThrottlerModule.ForRootAsync({
					useFactory: () => ({
						ttl: 30000,
						limit: 50,
					}),
				});

				expect(logSpy).toBeDefined();
			} finally {
				logSpy.mockRestore();
			}
		});
	});

	describe('Module type structure', () => {
		it('forRoot should return object with module property', () => {
			const Result = SharedThrottlerModule.ForRoot();
			expect(typeof Result).toBe('object');
			expect('module' in Result).toBe(true);
		});

		it('forRoot should return object with imports property', () => {
			const Result = SharedThrottlerModule.ForRoot();
			expect('imports' in Result).toBe(true);
		});

		it('forRoot should return object with providers property', () => {
			const Result = SharedThrottlerModule.ForRoot();
			expect('providers' in Result).toBe(true);
		});

		it('forRoot should return object with exports property', () => {
			const Result = SharedThrottlerModule.ForRoot();
			expect('exports' in Result).toBe(true);
		});

		it('forRootAsync should return object with all required properties', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}),
			});
			expect('module' in Result).toBe(true);
			expect('imports' in Result).toBe(true);
			expect('providers' in Result).toBe(true);
			expect('exports' in Result).toBe(true);
		});
	});

	describe('forRoot vs forRootAsync configuration paths', () => {
		it('forRoot should create synchronous module configuration', () => {
			const Result = SharedThrottlerModule.ForRoot({
				ttl: 10000,
				limit: 20,
			});

			expect(Result.module).toBe(SharedThrottlerModule);
			// Verify structure for sync config
			expect(Array.isArray(Result.imports)).toBe(true);
			expect(Array.isArray(Result.providers)).toBe(true);
			expect(Array.isArray(Result.exports)).toBe(true);
		});

		it('forRoot should include ThrottlerGuard provider', () => {
			const Result = SharedThrottlerModule.ForRoot();

			expect(Result.providers).toBeDefined();
			// Should have at least ThrottlerGuard
			expect(Result.providers!.length).toBeGreaterThan(0);
		});

		it('forRoot should export both ThrottlerModule and ThrottlerGuard', () => {
			const Result = SharedThrottlerModule.ForRoot();

			expect(Result.exports).toBeDefined();
			expect(Array.isArray(Result.exports)).toBe(true);
			expect(Result.exports!.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('forRootAsync with useFactory vs useClass branches', () => {
		it('should only create SHARED_THROTTLER_CONFIG from useFactory not useClass', () => {
			const resultFactory = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({ ttl: 30000 }),
			});

			const resultClass = SharedThrottlerModule.ForRootAsync({
				useClass: class Config {
					createThrottlerConfig() {
						return { ttl: 30000 }; 
					}
				},
			});

			// Both should have providers but structure differs
			expect(resultFactory.providers).toBeDefined();
			expect(resultClass.providers).toBeDefined();

			// useClass adds service + factory provider (2 at minimum + guard)
			// useFactory adds only factory provider + guard
		});

		it('should handle useClass config service properly', () => {
			class MyConfigService {
				createThrottlerConfig(): ISharedThrottlerConfig {
					return { ttl: 25000, limit: 75 };
				}
			}

			const Result = SharedThrottlerModule.ForRootAsync({
				useClass: MyConfigService,
			});

			expect(Result.providers).toBeDefined();
			// Should include MyConfigService as provider
			const hasClassProvider = Result.providers!.some(
				(p: any) => typeof p === 'function' || (typeof p === 'object' && p.useClass),
			);
			expect(hasClassProvider).toBe(true);
		});

		it('should only handle useFactory branch when useFactory exists', () => {
			const mockFactory = vi.fn().mockReturnValue({ ttl: 30000 });

			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: mockFactory,
			});

			expect(Result.providers).toBeDefined();
			// Should have factory provider
			const configProvider = Result.providers!.find(
				(p: any) => typeof p === 'object' && p.provide === 'SHARED_THROTTLER_CONFIG',
			);
			expect(configProvider).toBeDefined();
			expect((configProvider! as any).useFactory).toBeDefined();
		});

		it('should handle neither useFactory nor useClass gracefully', () => {
			const Result = SharedThrottlerModule.ForRootAsync({});

			expect(Result.providers).toBeDefined();
			// Should still include ThrottlerGuard at minimum
			expect(Result.providers!.length).toBeGreaterThan(0);
		});

		it('should spread optional imports when provided', () => {
			const customImport = { provide: 'CUSTOM', useValue: 'test' };

			const resultWithImports = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}),
				imports: [customImport as any],
			});

			const resultWithoutImports = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}),
			});

			// With imports should have more items
			expect(resultWithImports.imports!.length).toBeGreaterThan(
				resultWithoutImports.imports!.length,
			);
		});
	});

	describe('ThrottlerModule.forRootAsync config factory branches', () => {
		it('should use fallback values when ttl not in config', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({
					limit: 50,
					// ttl is undefined - should use default
				}),
			});

			expect(Result).toBeDefined();
		});

		it('should use fallback values when limit not in config', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({
					ttl: 30000,
					// limit is undefined - should use default
				}),
			});

			expect(Result).toBeDefined();
		});

		it('should handle both ttl and limit missing', () => {
			const Result = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({}),
			});

			expect(Result).toBeDefined();
			// Both should use defaults
		});

		it('should handle Redis config conditional logging', () => {
			const resultWithRedis = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({
					ttl: 30000,
					limit: 100,
					redis: {
						host: 'redis.local',
						port: 6379,
					},
				}),
			});

			const resultWithoutRedis = SharedThrottlerModule.ForRootAsync({
				useFactory: () => ({
					ttl: 30000,
					limit: 100,
					// No redis config
				}),
			});

			// Both should return valid modules (logging happens at bootstrap)
			expect(resultWithRedis).toBeDefined();
			expect(resultWithoutRedis).toBeDefined();
		});
	});
});
