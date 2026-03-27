
import { CreateRateLimitConfig, RateLimitConfig } from '../rate-limit-config.factory.js';

describe('RateLimitConfigFactory', () => {
	it('should create default rate limit config', () => {
		const config = CreateRateLimitConfig();
		expect(config.auth).toBeDefined();
		expect(config.api).toBeDefined();
	});

	it('should include auth limits', () => {
		const config = CreateRateLimitConfig();
		expect(config.auth.login).toBeDefined();
		expect(config.auth.login!.limit).toBeGreaterThan(0);
		expect(config.auth.login!.ttl).toBeGreaterThan(0);
	});

	it('should include api limits', () => {
		const config = CreateRateLimitConfig();
		expect(config.api.default).toBeDefined();
		expect(config.api.default!.limit).toBeGreaterThan(0);
	});

	it('should allow merging custom limits', () => {
		const custom: RateLimitConfig = {
			auth: {
				login: { ttl: 30000, limit: 3 },
			},
			api: {},
			custom: {
				upload: { ttl: 60000, limit: 5 },
			},
		};
		const config = CreateRateLimitConfig(custom);
		expect(config['custom']?.upload).toBeDefined();
	});

	it('should preserve defaults when merging partial config', () => {
		const partial: RateLimitConfig = {
			auth: {
				login: { ttl: 30000, limit: 1 },
			},
			api: {},
		};
		const config = CreateRateLimitConfig(partial);
		expect(config.auth.login!.limit).toBe(1);
		expect(config.auth.register).toBeDefined(); // Should still exist
	});

	describe('DeepMerge function branches', () => {
		it('should handle null overrides', () => {
			const config = CreateRateLimitConfig(null as any);
			expect(config.auth).toBeDefined();
			expect(config.api).toBeDefined();
		});

		it('should handle undefined overrides', () => {
			const config = CreateRateLimitConfig(undefined);
			expect(config.auth).toBeDefined();
			expect(config.api).toBeDefined();
		});

		it('should merge nested objects (auth)', () => {
			const overrides: RateLimitConfig = {
				auth: {
					login: { ttl: 30000, limit: 2 },
					register: { ttl: 45000, limit: 1 },
				},
				api: {},
			};
			const config = CreateRateLimitConfig(overrides);
			expect(config.auth.login!.ttl).toBe(30000);
			expect(config.auth.login!.limit).toBe(2);
			expect(config.auth.register!.ttl).toBe(45000);
			expect(config.auth.register!.limit).toBe(1);
			expect(config.auth.refreshToken).toBeDefined(); // Should still exist
		});

		it('should merge nested objects (api)', () => {
			const overrides: RateLimitConfig = {
				auth: {},
				api: {
					default: { ttl: 30000, limit: 50 },
					search: { ttl: 120000, limit: 20 },
				},
			};
			const config = CreateRateLimitConfig(overrides);
			expect(config.api.default!.ttl).toBe(30000);
			expect(config.api.default!.limit).toBe(50);
			expect(config.api.search!.ttl).toBe(120000);
			expect(config.api.search!.limit).toBe(20);
		});

		it('should not recurse into arrays', () => {
			const overrides: RateLimitConfig = {
				auth: {},
				api: {},
				items: [1, 2, 3],
			};
			const config = CreateRateLimitConfig(overrides);
			expect(config['items']).toEqual([1, 2, 3]);
		});

		it('should overwrite primitive values', () => {
			const overrides: RateLimitConfig = {
				auth: {},
				api: {},
				timeout: 5000,
				name: 'custom-limiter',
			};
			const config = CreateRateLimitConfig(overrides);
			expect(config['timeout']).toBe(5000);
			expect(config['name']).toBe('custom-limiter');
		});

		it('should overwrite null values with primitives', () => {
			const overrides: RateLimitConfig = {
				auth: {},
				api: {},
				nullValue: null,
			};
			const config = CreateRateLimitConfig(overrides);
			expect(config['nullValue']).toBeNull();
		});

		it('should handle mixed object and primitive overrides', () => {
			const overrides: RateLimitConfig = {
				auth: {
					login: { ttl: 20000, limit: 5 },
				},
				api: {},
				custom: {
					endpoint1: { ttl: 60000, limit: 100 },
					endpoint2: { ttl: 30000, limit: 50 },
				},
				timeout: 10000,
			};
			const config = CreateRateLimitConfig(overrides);
			expect(config.auth.login!.ttl).toBe(20000);
			expect(config['custom'].endpoint1.ttl).toBe(60000);
			expect(config['timeout']).toBe(10000);
		});

		it('should handle deep nesting', () => {
			const overrides: RateLimitConfig = {
				auth: {},
				api: {},
				level1: {
					level2: {
						level3: {
							value: 'nested',
						},
					},
				},
			};
			const config = CreateRateLimitConfig(overrides);
			expect(config['level1'].level2.level3.value).toBe('nested');
		});

		it('should not merge source keys that dont exist in target', () => {
			const overrides: RateLimitConfig = {
				auth: {},
				api: {},
				newKey: { someValue: true },
			};
			const config = CreateRateLimitConfig(overrides);
			expect(config['newKey']).toEqual({ someValue: true });
		});

		it('should handle empty object overrides', () => {
			const overrides: RateLimitConfig = {
				auth: {},
				api: {},
			};
			const config = CreateRateLimitConfig(overrides);
			// Should preserve all defaults
			expect(config.auth.login).toBeDefined();
			expect(config.auth.register).toBeDefined();
			expect(config.auth.refreshToken).toBeDefined();
			expect(config.api.default).toBeDefined();
			expect(config.api.search).toBeDefined();
		});

		it('should handle complete override', () => {
			const overrides: RateLimitConfig = {
				auth: {
					login: { ttl: 10000, limit: 1 },
					register: { ttl: 20000, limit: 2 },
					refreshToken: { ttl: 30000, limit: 3 },
				},
				api: {
					default: { ttl: 40000, limit: 4 },
					search: { ttl: 50000, limit: 5 },
				},
			};
			const config = CreateRateLimitConfig(overrides);
			expect(config.auth.login!.limit).toBe(1);
			expect(config.auth.register!.limit).toBe(2);
			expect(config.auth.refreshToken!.limit).toBe(3);
			expect(config.api.default!.limit).toBe(4);
			expect(config.api.search!.limit).toBe(5);
		});

		it('should handle partial auth overrides', () => {
			const overrides: RateLimitConfig = {
				auth: {
					login: { ttl: 25000, limit: 3 },
				},
				api: {},
			};
			const config = CreateRateLimitConfig(overrides);
			expect(config.auth.login!.ttl).toBe(25000);
			expect(config.auth.login!.limit).toBe(3);
			expect(config.auth.register!.limit).toBe(3); // Default
			expect(config.auth.refreshToken!.limit).toBe(10); // Default
		});

		it('should handle partial api overrides', () => {
			const overrides: RateLimitConfig = {
				auth: {},
				api: {
					search: { ttl: 90000, limit: 25 },
				},
			};
			const config = CreateRateLimitConfig(overrides);
			expect(config.api.search!.ttl).toBe(90000);
			expect(config.api.search!.limit).toBe(25);
			expect(config.api.default!.limit).toBe(100); // Default
		});

		it('should not modify original defaults', () => {
			const overrides: RateLimitConfig = {
				auth: {
					login: { ttl: 10000, limit: 1 },
				},
				api: {},
			};
			const config1 = CreateRateLimitConfig(overrides);
			const config2 = CreateRateLimitConfig();

			expect(config2.auth.login!.limit).toBe(5); // Should be original default
			expect(config1.auth.login!.limit).toBe(1); // Should be overridden
		});

		it('should handle multiple levels of nesting with mixed types', () => {
			const overrides: RateLimitConfig = {
				auth: {
					login: { ttl: 15000, limit: 4 },
				},
				api: {},
				custom: {
					deepLevel: {
						data: { value: 123 },
						name: 'test',
					},
				},
			};
			const config = CreateRateLimitConfig(overrides);
			expect(config['custom'].deepLevel.data.value).toBe(123);
			expect(config['custom'].deepLevel.name).toBe('test');
		});
	});
});
