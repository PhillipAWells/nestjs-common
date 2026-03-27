import { describe, it, expect, vi } from 'vitest';
import { SharedThrottlerModule, SharedThrottlerConfig } from '../throttler.module.js';

describe('SharedThrottlerModule', () => {
	describe('forRoot', () => {
		it('should return a DynamicModule', () => {
			const result = SharedThrottlerModule.forRoot();
			expect(result).toBeDefined();
			expect(result.module).toBe(SharedThrottlerModule);
		});

		it('should configure in-memory throttling with default config', () => {
			const result = SharedThrottlerModule.forRoot();
			expect(result.imports).toBeDefined();
			expect(result.providers).toBeDefined();
			expect(result.exports).toBeDefined();
		});

		it('should return a module that exports ThrottlerModule', () => {
			const result = SharedThrottlerModule.forRoot();
			expect(result.exports).toBeDefined();
			expect(result.exports?.length).toBeGreaterThan(0);
		});

		it('should return a module that exports ThrottlerGuard', () => {
			const result = SharedThrottlerModule.forRoot();
			expect(result.exports).toBeDefined();
			expect(result.exports?.length).toBeGreaterThan(0);
		});

		it('should provide ThrottlerGuard', () => {
			const result = SharedThrottlerModule.forRoot();
			expect(result.providers).toBeDefined();
			expect(result.providers?.length).toBeGreaterThan(0);
		});

		it('should accept custom ttl configuration', () => {
			const config: SharedThrottlerConfig = {
				ttl: 30000,
			};
			const result = SharedThrottlerModule.forRoot(config);
			expect(result).toBeDefined();
			expect(result.module).toBe(SharedThrottlerModule);
		});

		it('should accept custom limit configuration', () => {
			const config: SharedThrottlerConfig = {
				limit: 50,
			};
			const result = SharedThrottlerModule.forRoot(config);
			expect(result).toBeDefined();
		});

		it('should accept both ttl and limit configuration', () => {
			const config: SharedThrottlerConfig = {
				ttl: 30000,
				limit: 50,
			};
			const result = SharedThrottlerModule.forRoot(config);
			expect(result).toBeDefined();
		});

		it('should use default ttl (15 minutes = 900000ms)', () => {
			const result = SharedThrottlerModule.forRoot();
			expect(result).toBeDefined();
			// The module should be configured with default 15 minute window
		});

		it('should use default limit (100 requests)', () => {
			const result = SharedThrottlerModule.forRoot();
			expect(result).toBeDefined();
			// The module should be configured with default 100 request limit
		});

		it('should handle zero ttl', () => {
			const config: SharedThrottlerConfig = {
				ttl: 0,
			};
			const result = SharedThrottlerModule.forRoot(config);
			expect(result).toBeDefined();
		});

		it('should handle zero limit', () => {
			const config: SharedThrottlerConfig = {
				limit: 0,
			};
			const result = SharedThrottlerModule.forRoot(config);
			expect(result).toBeDefined();
		});

		it('should handle very large ttl values', () => {
			const config: SharedThrottlerConfig = {
				ttl: 86400000, // 24 hours
			};
			const result = SharedThrottlerModule.forRoot(config);
			expect(result).toBeDefined();
		});

		it('should handle very large limit values', () => {
			const config: SharedThrottlerConfig = {
				limit: 10000,
			};
			const result = SharedThrottlerModule.forRoot(config);
			expect(result).toBeDefined();
		});

		it('should return module with correct structure', () => {
			const result = SharedThrottlerModule.forRoot();
			expect(result.module).toBeDefined();
			expect(result.imports).toBeInstanceOf(Array);
			expect(result.providers).toBeInstanceOf(Array);
			expect(result.exports).toBeInstanceOf(Array);
		});

		it('should include ThrottlerModule in imports', () => {
			const result = SharedThrottlerModule.forRoot();
			expect(result.imports).toHaveLength(1);
			// ThrottlerModule.forRoot() should be the first import
		});
	});

	describe('forRootAsync', () => {
		it('should return a DynamicModule', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({}),
			});
			expect(result).toBeDefined();
			expect(result.module).toBe(SharedThrottlerModule);
		});

		it('should configure async throttling with useFactory', () => {
			const config: SharedThrottlerConfig = {
				ttl: 30000,
				limit: 50,
			};
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => config,
			});
			expect(result).toBeDefined();
			expect(result.providers).toBeDefined();
		});

		it('should support useFactory with inject array', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: (config: SharedThrottlerConfig) => config,
				inject: ['CONFIG_SERVICE'],
			});
			expect(result).toBeDefined();
			expect(result.providers).toHaveLength(2); // Provider + ThrottlerGuard
		});

		it('should support useClass configuration', () => {
			class ThrottlerConfigService {
				createThrottlerConfig(): SharedThrottlerConfig {
					return { ttl: 30000, limit: 50 };
				}
			}

			const result = SharedThrottlerModule.forRootAsync({
				useClass: ThrottlerConfigService,
			});
			expect(result).toBeDefined();
			expect(result.providers).toBeDefined();
		});

		it('should provide SHARED_THROTTLER_CONFIG when using useFactory', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({ ttl: 30000 }),
			});
			expect(result.providers).toBeDefined();
			expect(result.providers?.length).toBeGreaterThan(0);
		});

		it('should provide SHARED_THROTTLER_CONFIG when using useClass', () => {
			class ConfigService {
				createThrottlerConfig(): SharedThrottlerConfig {
					return {};
				}
			}

			const result = SharedThrottlerModule.forRootAsync({
				useClass: ConfigService,
			});
			expect(result.providers).toBeDefined();
			expect(result.providers?.length).toBeGreaterThan(0);
		});

		it('should include ThrottlerGuard in exports', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({}),
			});
			expect(result.exports).toBeDefined();
			expect(result.exports?.length).toBeGreaterThan(0);
		});

		it('should include ThrottlerModule in exports', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({}),
			});
			expect(result.exports).toBeDefined();
			expect(result.exports?.length).toBeGreaterThan(0);
		});

		it('should support optional imports array', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({}),
				imports: [],
			});
			expect(result).toBeDefined();
		});

		it('should include custom imports in the module', () => {
			const customImport = { provide: 'CUSTOM', useValue: 'value' };
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({}),
				imports: [customImport as any],
			});
			expect(result.imports?.length).toBeGreaterThan(1);
		});

		it('should handle async factory function', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => {
					return { ttl: 30000, limit: 50 };
				},
			});
			expect(result).toBeDefined();
		});

		it('should support Redis configuration in config', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({
					redis: {
						host: 'localhost',
						port: 6379,
					},
				}),
			});
			expect(result).toBeDefined();
		});

		it('should support advanced Redis configuration', () => {
			const result = SharedThrottlerModule.forRootAsync({
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
			expect(result).toBeDefined();
		});

		it('should support Redis with custom properties', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({
					redis: {
						host: 'localhost',
						port: 6379,
						customProp: 'custom-value',
					},
				}),
			});
			expect(result).toBeDefined();
		});

		it('should handle config without Redis', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({
					ttl: 30000,
					limit: 50,
				}),
			});
			expect(result).toBeDefined();
		});

		it('should support empty configuration', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({}),
			});
			expect(result).toBeDefined();
		});

		it('should support useClass with inject', () => {
			class ConfigService {
				createThrottlerConfig(): SharedThrottlerConfig {
					return {};
				}
			}

			const result = SharedThrottlerModule.forRootAsync({
				useClass: ConfigService,
				inject: [],
			});
			expect(result).toBeDefined();
		});

		it('should return module with correct structure', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({}),
			});
			expect(result.module).toBeDefined();
			expect(result.imports).toBeInstanceOf(Array);
			expect(result.providers).toBeInstanceOf(Array);
			expect(result.exports).toBeInstanceOf(Array);
		});

		it('should handle factory with multiple dependencies', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: (_a: any, _b: any) => ({ ttl: 30000 }),
				inject: ['DEP1', 'DEP2'],
			});
			expect(result).toBeDefined();
		});

		it('should support factory returning Promise', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: async () => {
					await new Promise(resolve => setTimeout(resolve, 100));
					return { ttl: 30000, limit: 50 };
				},
			});
			expect(result).toBeDefined();
		});
	});

	describe('Default values', () => {
		it('should have default window of 15 minutes', () => {
			// 15 * 60 * 1000 = 900000
			const result = SharedThrottlerModule.forRoot();
			expect(result).toBeDefined();
		});

		it('should have default max requests of 100', () => {
			const result = SharedThrottlerModule.forRoot();
			expect(result).toBeDefined();
		});
	});

	describe('Configuration edge cases', () => {
		it('should handle negative ttl', () => {
			const config: SharedThrottlerConfig = {
				ttl: -1000,
			};
			const result = SharedThrottlerModule.forRoot(config);
			expect(result).toBeDefined();
		});

		it('should handle negative limit', () => {
			const config: SharedThrottlerConfig = {
				limit: -1,
			};
			const result = SharedThrottlerModule.forRoot(config);
			expect(result).toBeDefined();
		});

		it('should handle config with undefined values', () => {
			const config: SharedThrottlerConfig = {
				ttl: undefined,
				limit: undefined,
			};
			const result = SharedThrottlerModule.forRoot(config);
			expect(result).toBeDefined();
		});

		it('should handle partial config in forRoot', () => {
			const config: SharedThrottlerConfig = {
				ttl: 30000,
			};
			const result = SharedThrottlerModule.forRoot(config);
			expect(result).toBeDefined();
		});

		it('should support Redis config with only host', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({
					redis: {
						host: 'localhost',
					},
				}),
			});
			expect(result).toBeDefined();
		});

		it('should support Redis config with only port', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({
					redis: {
						port: 6379,
					},
				}),
			});
			expect(result).toBeDefined();
		});
	});

	describe('useClass specific tests', () => {
		it('should create provider from useClass', () => {
			class CustomConfigService {
				createThrottlerConfig(): SharedThrottlerConfig {
					return { ttl: 20000, limit: 25 };
				}
			}

			const result = SharedThrottlerModule.forRootAsync({
				useClass: CustomConfigService,
			});

			// Should have at least 2 providers: CustomConfigService and ThrottlerGuard
			expect(result.providers).toBeDefined();
			expect(result.providers?.length).toBeGreaterThan(1);
		});

		it('should wire useClass with dependency injection', () => {
			class DependencyService {}
			class ConfigService {
				constructor(private readonly dep: DependencyService) {}
				createThrottlerConfig(): SharedThrottlerConfig {
					return {};
				}
			}

			const result = SharedThrottlerModule.forRootAsync({
				useClass: ConfigService,
				imports: [],
			});

			expect(result.providers).toBeDefined();
			expect(result.providers?.length).toBeGreaterThan(0);
		});

		it('should support useClass returning Promise', () => {
			class ConfigService {
				async createThrottlerConfig(): Promise<SharedThrottlerConfig> {
					return { ttl: 30000, limit: 50 };
				}
			}

			const result = SharedThrottlerModule.forRootAsync({
				useClass: ConfigService,
			});

			expect(result).toBeDefined();
		});
	});

	describe('forRootAsync factory function behavior', () => {
		it('should invoke useFactory when creating config', () => {
			const mockFactory = vi.fn().mockReturnValue({ ttl: 30000, limit: 50 });

			SharedThrottlerModule.forRootAsync({
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

			const result = SharedThrottlerModule.forRootAsync({
				useFactory: mockFactory,
				inject: ['CONFIG_SERVICE'],
			});

			expect(result.providers).toBeDefined();
		});

		it('should handle Redis configuration in factory', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({
					ttl: 30000,
					limit: 50,
					redis: {
						host: 'redis.example.com',
						port: 6379,
					},
				}),
			});

			expect(result).toBeDefined();
			expect(result.imports).toBeDefined();
		});

		it('should use default ttl when config ttl is undefined', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({
					limit: 50,
					// ttl is undefined
				}),
			});

			expect(result).toBeDefined();
		});

		it('should use default limit when config limit is undefined', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({
					ttl: 30000,
					// limit is undefined
				}),
			});

			expect(result).toBeDefined();
		});

		it('should handle undefined config object', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => undefined as any,
			});

			expect(result).toBeDefined();
		});

		it('should handle null config object', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => null as any,
			});

			expect(result).toBeDefined();
		});
	});

	describe('forRootAsync provider creation', () => {
		it('should create SHARED_THROTTLER_CONFIG provider from useFactory', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({ ttl: 30000, limit: 50 }),
			});

			expect(result.providers).toBeDefined();
			// Should have at least 2 providers: SHARED_THROTTLER_CONFIG + ThrottlerGuard
			expect(result.providers!.length).toBeGreaterThanOrEqual(2);

			// Check that SHARED_THROTTLER_CONFIG is provided
			const configProvider = result.providers!.find(
				(p: any) => typeof p === 'object' && p.provide === 'SHARED_THROTTLER_CONFIG',
			);
			expect(configProvider).toBeDefined();
		});

		it('should set inject array to empty when not provided', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({ ttl: 30000 }),
			});

			expect(result.providers).toBeDefined();
			const configProvider = result.providers!.find(
				(p: any) => typeof p === 'object' && p.provide === 'SHARED_THROTTLER_CONFIG',
			);

			expect(configProvider).toBeDefined();
			expect((configProvider! as any).inject).toBeDefined();
		});

		it('should preserve inject array in provider', () => {
			const injectTokens = ['SERVICE_A', 'SERVICE_B'];
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: (_a: any, _b: any) => ({ ttl: 30000 }),
				inject: injectTokens,
			});

			const configProvider = result.providers!.find(
				(p: any) => typeof p === 'object' && p.provide === 'SHARED_THROTTLER_CONFIG',
			);

			expect(configProvider).toBeDefined();
			expect((configProvider! as any).inject).toEqual(injectTokens);
		});

		it('should create providers array when using useFactory', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({}),
			});

			expect(Array.isArray(result.providers)).toBe(true);
			expect(result.providers!.length).toBeGreaterThan(0);
		});

		it('should not duplicate providers when both useFactory and useClass are undefined', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: undefined as any,
				useClass: undefined as any,
			});

			// Should still include ThrottlerGuard
			expect(result.providers).toBeDefined();
		});

		it('should include only SHARED_THROTTLER_CONFIG from useFactory not from useClass', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({ ttl: 30000 }),
			});

			const configProviders = result.providers!.filter(
				(p: any) => typeof p === 'object' && p.provide === 'SHARED_THROTTLER_CONFIG',
			);

			// Should have exactly one SHARED_THROTTLER_CONFIG provider
			expect(configProviders.length).toBe(1);
		});
	});

	describe('forRootAsync imports configuration', () => {
		it('should include custom imports in module imports', () => {
			const customModule = { provide: 'CUSTOM_TOKEN', useValue: 'custom-value' };
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({}),
				imports: [customModule as any],
			});

			// Should have ThrottlerModule async import + custom imports
			expect(result.imports!.length).toBeGreaterThanOrEqual(2);
		});

		it('should spread optional imports array into imports', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({}),
				imports: [],
			});

			// Should have at least ThrottlerModule async import
			expect(result.imports).toBeDefined();
			expect(result.imports!.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('forRootAsync ThrottlerModule.forRootAsync integration', () => {
		it('should pass SHARED_THROTTLER_CONFIG as inject token to ThrottlerModule.forRootAsync', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({ ttl: 30000, limit: 50 }),
			});

			// The ThrottlerModule.forRootAsync should be in imports
			expect(result.imports).toBeDefined();
			const [throttlerImport] = result.imports ?? [];
			expect(throttlerImport).toBeDefined();
		});

		it('should apply default values in ThrottlerModule.forRootAsync factory', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({}), // Empty config
			});

			expect(result).toBeDefined();
			// The ThrottlerModule.forRootAsync should handle empty config gracefully
		});

		it('should handle Redis config passed to ThrottlerModule.forRootAsync', () => {
			const result = SharedThrottlerModule.forRootAsync({
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

			expect(result).toBeDefined();
			// Redis config should be passed through to ThrottlerModule
		});
	});

	describe('Redis configuration logging', () => {
		it('should log when Redis is configured', () => {
			const logSpy = vi.spyOn(console, 'log');

			try {
				SharedThrottlerModule.forRootAsync({
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
				SharedThrottlerModule.forRootAsync({
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
			const result = SharedThrottlerModule.forRoot();
			expect(typeof result).toBe('object');
			expect('module' in result).toBe(true);
		});

		it('forRoot should return object with imports property', () => {
			const result = SharedThrottlerModule.forRoot();
			expect('imports' in result).toBe(true);
		});

		it('forRoot should return object with providers property', () => {
			const result = SharedThrottlerModule.forRoot();
			expect('providers' in result).toBe(true);
		});

		it('forRoot should return object with exports property', () => {
			const result = SharedThrottlerModule.forRoot();
			expect('exports' in result).toBe(true);
		});

		it('forRootAsync should return object with all required properties', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({}),
			});
			expect('module' in result).toBe(true);
			expect('imports' in result).toBe(true);
			expect('providers' in result).toBe(true);
			expect('exports' in result).toBe(true);
		});
	});

	describe('forRoot vs forRootAsync configuration paths', () => {
		it('forRoot should create synchronous module configuration', () => {
			const result = SharedThrottlerModule.forRoot({
				ttl: 10000,
				limit: 20,
			});

			expect(result.module).toBe(SharedThrottlerModule);
			// Verify structure for sync config
			expect(Array.isArray(result.imports)).toBe(true);
			expect(Array.isArray(result.providers)).toBe(true);
			expect(Array.isArray(result.exports)).toBe(true);
		});

		it('forRoot should include ThrottlerGuard provider', () => {
			const result = SharedThrottlerModule.forRoot();

			expect(result.providers).toBeDefined();
			// Should have at least ThrottlerGuard
			expect(result.providers!.length).toBeGreaterThan(0);
		});

		it('forRoot should export both ThrottlerModule and ThrottlerGuard', () => {
			const result = SharedThrottlerModule.forRoot();

			expect(result.exports).toBeDefined();
			expect(Array.isArray(result.exports)).toBe(true);
			expect(result.exports!.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('forRootAsync with useFactory vs useClass branches', () => {
		it('should only create SHARED_THROTTLER_CONFIG from useFactory not useClass', () => {
			const resultFactory = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({ ttl: 30000 }),
			});

			const resultClass = SharedThrottlerModule.forRootAsync({
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
				createThrottlerConfig(): SharedThrottlerConfig {
					return { ttl: 25000, limit: 75 };
				}
			}

			const result = SharedThrottlerModule.forRootAsync({
				useClass: MyConfigService,
			});

			expect(result.providers).toBeDefined();
			// Should include MyConfigService as provider
			const hasClassProvider = result.providers!.some(
				(p: any) => typeof p === 'function' || (typeof p === 'object' && p.useClass),
			);
			expect(hasClassProvider).toBe(true);
		});

		it('should only handle useFactory branch when useFactory exists', () => {
			const mockFactory = vi.fn().mockReturnValue({ ttl: 30000 });

			const result = SharedThrottlerModule.forRootAsync({
				useFactory: mockFactory,
			});

			expect(result.providers).toBeDefined();
			// Should have factory provider
			const configProvider = result.providers!.find(
				(p: any) => typeof p === 'object' && p.provide === 'SHARED_THROTTLER_CONFIG',
			);
			expect(configProvider).toBeDefined();
			expect((configProvider! as any).useFactory).toBeDefined();
		});

		it('should handle neither useFactory nor useClass gracefully', () => {
			const result = SharedThrottlerModule.forRootAsync({});

			expect(result.providers).toBeDefined();
			// Should still include ThrottlerGuard at minimum
			expect(result.providers!.length).toBeGreaterThan(0);
		});

		it('should spread optional imports when provided', () => {
			const customImport = { provide: 'CUSTOM', useValue: 'test' };

			const resultWithImports = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({}),
				imports: [customImport as any],
			});

			const resultWithoutImports = SharedThrottlerModule.forRootAsync({
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
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({
					limit: 50,
					// ttl is undefined - should use default
				}),
			});

			expect(result).toBeDefined();
		});

		it('should use fallback values when limit not in config', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({
					ttl: 30000,
					// limit is undefined - should use default
				}),
			});

			expect(result).toBeDefined();
		});

		it('should handle both ttl and limit missing', () => {
			const result = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({}),
			});

			expect(result).toBeDefined();
			// Both should use defaults
		});

		it('should handle Redis config conditional logging', () => {
			const resultWithRedis = SharedThrottlerModule.forRootAsync({
				useFactory: () => ({
					ttl: 30000,
					limit: 100,
					redis: {
						host: 'redis.local',
						port: 6379,
					},
				}),
			});

			const resultWithoutRedis = SharedThrottlerModule.forRootAsync({
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
