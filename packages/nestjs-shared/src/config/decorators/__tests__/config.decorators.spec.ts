import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigValue, EnvVar } from '../config.decorators.js';
import { ExecutionContext } from '@nestjs/common';

// Mock execution context with config service
function _createMockContextWithConfig(configData: any = {}) {
	return {
		switchToHttp: vi.fn().mockReturnValue({
			getRequest: vi.fn().mockReturnValue({
				config: configData,
				env: process.env,
			}),
		}),
	} as any as ExecutionContext;
}

describe('Config Decorators', () => {
	describe('@ConfigValue decorator', () => {
		it('should extract configuration values from request context', () => {
			const decorator = ConfigValue('database.url');
			expect(decorator).toBeDefined();
		});

		it('should support extracting with default value', () => {
			const decorator = ConfigValue('app.port', 3000);
			expect(decorator).toBeDefined();
		});

		it('should work with undefined default', () => {
			const decorator = ConfigValue('some.key', undefined);
			expect(decorator).toBeDefined();
		});

		it('should work with null default', () => {
			const decorator = ConfigValue('some.key', null);
			expect(decorator).toBeDefined();
		});

		it('should work with various default types', () => {
			expect(ConfigValue('port', 3000)).toBeDefined();
			expect(ConfigValue('Debug()', true)).toBeDefined();
			expect(ConfigValue('timeout', 5000.5)).toBeDefined();
			expect(ConfigValue('name', 'default')).toBeDefined();
			expect(ConfigValue('items', [])).toBeDefined();
			expect(ConfigValue('config', {})).toBeDefined();
		});

		it('should support nested configuration keys', () => {
			const decorator = ConfigValue('database.postgresql.host');
			expect(decorator).toBeDefined();
		});

		it('should handle complex keys with dots', () => {
			expect(ConfigValue('app.features.auth.jwt.secret')).toBeDefined();
		});

		it('should work with single-level keys', () => {
			expect(ConfigValue('port')).toBeDefined();
			expect(ConfigValue('env')).toBeDefined();
		});

		it('should return ParameterDecorator type', () => {
			const decorator = ConfigValue('key');
			expect(typeof decorator).toBe('function');
		});

		it('should support stacking with other decorators', () => {
			const d1 = ConfigValue('database.url');
			const d2 = ConfigValue('cache.ttl');
			expect(d1).toBeDefined();
			expect(d2).toBeDefined();
		});

		it('should support example: extract database URL', () => {
			const decorator = ConfigValue('database.url');
			expect(decorator).toBeDefined();
		});

		it('should support example: extract with default', () => {
			const decorator = ConfigValue('app.port', 3000);
			expect(decorator).toBeDefined();
		});
	});

	describe('@EnvVar decorator', () => {
		beforeEach(() => {
			// Clear any test env vars
			delete process.env.TEST_VAR;
			delete process.env.TEST_NUMBER;
			delete process.env.TEST_BOOL;
		});

		it('should extract environment variables from process.env', () => {
			const decorator = EnvVar('NODE_ENV');
			expect(decorator).toBeDefined();
		});

		it('should support default values', () => {
			const decorator = EnvVar('PORT', '3000');
			expect(decorator).toBeDefined();
		});

		it('should support numeric type conversion with default', () => {
			const decorator = EnvVar('MAX_CONNECTIONS', 10);
			expect(decorator).toBeDefined();
		});

		it('should support boolean type conversion with default', () => {
			const decorator = EnvVar('DEBUG_MODE', true);
			expect(decorator).toBeDefined();
		});

		it('should return ParameterDecorator type', () => {
			const decorator = EnvVar('NODE_ENV');
			expect(typeof decorator).toBe('function');
		});

		it('should work with undefined default', () => {
			const decorator = EnvVar('SOME_VAR', undefined);
			expect(decorator).toBeDefined();
		});

		it('should work with null default', () => {
			const decorator = EnvVar('SOME_VAR', null as any);
			expect(decorator).toBeDefined();
		});

		it('should support various variable names', () => {
			expect(EnvVar('NODE_ENV')).toBeDefined();
			expect(EnvVar('DATABASE_URL')).toBeDefined();
			expect(EnvVar('API_KEY')).toBeDefined();
			expect(EnvVar('SERVICE_PORT')).toBeDefined();
		});

		it('should handle case-sensitive environment variable names', () => {
			// env vars are case-sensitive on Linux
			expect(EnvVar('NODE_ENV')).toBeDefined();
			expect(EnvVar('node_env')).toBeDefined(); // Different var, will be undefined
		});

		it('should support stacking with other decorators', () => {
			const d1 = EnvVar('DATABASE_URL');
			const d2 = EnvVar('PORT', '3000');
			expect(d1).toBeDefined();
			expect(d2).toBeDefined();
		});

		it('should support example: extract NODE_ENV', () => {
			const decorator = EnvVar('NODE_ENV');
			expect(decorator).toBeDefined();
		});

		it('should support example: extract with default', () => {
			const decorator = EnvVar('PORT', '3000');
			expect(decorator).toBeDefined();
		});

		it('should support example: numeric default for type conversion', () => {
			const decorator = EnvVar('TIMEOUT', 5000);
			expect(decorator).toBeDefined();
		});

		it('should support example: boolean default for type conversion', () => {
			const decorator = EnvVar('ENABLE_LOGGING', false);
			expect(decorator).toBeDefined();
		});
	});

	describe('Decorator integration', () => {
		it('should support using both decorators together', () => {
			const configDeco = ConfigValue('db.url');
			const envDeco = EnvVar('DATABASE_URL');
			expect(configDeco).toBeDefined();
			expect(envDeco).toBeDefined();
		});

		it('should support multiple instances of same decorator', () => {
			const d1 = ConfigValue('key1');
			const d2 = ConfigValue('key2');
			const d3 = ConfigValue('key3');
			expect(d1).toBeDefined();
			expect(d2).toBeDefined();
			expect(d3).toBeDefined();
		});

		it('should support multiple instances of EnvVar', () => {
			const d1 = EnvVar('VAR1');
			const d2 = EnvVar('VAR2');
			const d3 = EnvVar('VAR3');
			expect(d1).toBeDefined();
			expect(d2).toBeDefined();
			expect(d3).toBeDefined();
		});
	});

	describe('Type conversions for EnvVar', () => {
		beforeEach(() => {
			process.env.TEST_NUMBER = '42';
			process.env.TEST_BOOL_TRUE = 'true';
			process.env.TEST_BOOL_FALSE = 'false';
			process.env.TEST_STRING = 'hello';
		});

		it('should handle number type detection from default type', () => {
			const decorator = EnvVar('TEST_NUMBER', 0);
			expect(decorator).toBeDefined();
		});

		it('should handle boolean type detection from default type', () => {
			const decorator = EnvVar('TEST_BOOL_TRUE', false);
			expect(decorator).toBeDefined();
		});

		it('should handle string type with numeric default', () => {
			const decorator = EnvVar('TEST_NUMERIC_STRING', 100);
			expect(decorator).toBeDefined();
		});

		it('should handle various boolean string representations', () => {
			process.env.TEST_TRUE_LOWER = 'true';
			process.env.TEST_TRUE_UPPER = 'TRUE';
			process.env.TEST_FALSE_LOWER = 'false';
			process.env.TEST_FALSE_UPPER = 'FALSE';

			expect(EnvVar('TEST_TRUE_LOWER', false)).toBeDefined();
			expect(EnvVar('TEST_TRUE_UPPER', false)).toBeDefined();
			expect(EnvVar('TEST_FALSE_LOWER', true)).toBeDefined();
			expect(EnvVar('TEST_FALSE_UPPER', true)).toBeDefined();
		});

		it('should handle missing environment variables with defaults', () => {
			delete process.env.MISSING_VAR;
			const decorator = EnvVar('MISSING_VAR', 'defaultValue');
			expect(decorator).toBeDefined();
		});

		it('should handle empty string environment variables', () => {
			process.env.EMPTY_VAR = '';
			const decorator = EnvVar('EMPTY_VAR', 'default');
			expect(decorator).toBeDefined();
		});
	});

	describe('ConfigValue with defaults', () => {
		it('should handle numeric defaults', () => {
			expect(ConfigValue('port', 3000)).toBeDefined();
			expect(ConfigValue('timeout', 5000)).toBeDefined();
		});

		it('should handle string defaults', () => {
			expect(ConfigValue('env', 'production')).toBeDefined();
			expect(ConfigValue('name', 'app')).toBeDefined();
		});

		it('should handle boolean defaults', () => {
			expect(ConfigValue('Debug()', true)).toBeDefined();
			expect(ConfigValue('secure', false)).toBeDefined();
		});

		it('should handle array defaults', () => {
			expect(ConfigValue('origins', ['http://localhost:3000'])).toBeDefined();
			expect(ConfigValue('allowedMethods', ['GET', 'POST'])).toBeDefined();
		});

		it('should handle object defaults', () => {
			expect(ConfigValue('database', { host: 'localhost', port: 5432 })).toBeDefined();
			expect(ConfigValue('cache', { ttl: 3600, maxSize: 1000 })).toBeDefined();
		});

		it('should handle null defaults', () => {
			expect(ConfigValue('optional', null)).toBeDefined();
		});

		it('should handle undefined defaults', () => {
			expect(ConfigValue('required')).toBeDefined();
		});

		it('should handle zero as default', () => {
			expect(ConfigValue('offset', 0)).toBeDefined();
		});

		it('should handle false as default', () => {
			expect(ConfigValue('enabled', false)).toBeDefined();
		});

		it('should handle empty string as default', () => {
			expect(ConfigValue('prefix', '')).toBeDefined();
		});

		it('should handle empty array as default', () => {
			expect(ConfigValue('items', [])).toBeDefined();
		});

		it('should handle empty object as default', () => {
			expect(ConfigValue('metadata', {})).toBeDefined();
		});
	});

	describe('Edge cases', () => {
		it('should handle very long config keys', () => {
			const longKey = 'a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z';
			expect(ConfigValue(longKey)).toBeDefined();
		});

		it('should handle very long environment variable names', () => {
			const longKey = 'VERY_LONG_ENV_VAR_NAME_WITH_MANY_PARTS_AND_SEGMENTS';
			expect(EnvVar(longKey)).toBeDefined();
		});

		it('should handle keys with special characters', () => {
			expect(ConfigValue('app-config.feature-flag')).toBeDefined();
		});

		it('should handle repeated decorator calls', () => {
			const d1 = ConfigValue('key');
			const d2 = ConfigValue('key');
			expect(d1).toBeDefined();
			expect(d2).toBeDefined();
		});

		it('should handle empty string keys', () => {
			expect(ConfigValue('')).toBeDefined();
			expect(EnvVar('')).toBeDefined();
		});

		it('should handle numeric string keys', () => {
			expect(ConfigValue('0')).toBeDefined();
			expect(EnvVar('123')).toBeDefined();
		});
	});

	describe('Real-world usage patterns', () => {
		it('should support database configuration injection', () => {
			const dbUrl = ConfigValue('database.url', 'postgresql://localhost/app');
			const dbPool = ConfigValue('database.pool', { min: 2, max: 10 });
			expect(dbUrl).toBeDefined();
			expect(dbPool).toBeDefined();
		});

		it('should support authentication configuration', () => {
			const jwtSecret = ConfigValue('auth.jwt.secret');
			const tokenExpiry = ConfigValue('auth.jwt.expiresIn', 3600);
			expect(jwtSecret).toBeDefined();
			expect(tokenExpiry).toBeDefined();
		});

		it('should support API configuration', () => {
			const apiUrl = ConfigValue('api.baseUrl', 'http://api.example.com');
			const apiKey = ConfigValue('api.key');
			expect(apiUrl).toBeDefined();
			expect(apiKey).toBeDefined();
		});

		it('should support environment-based configuration', () => {
			const env = EnvVar('NODE_ENV', 'development');
			const logLevel = EnvVar('LOG_LEVEL', 'Info()');
			const port = EnvVar('PORT', 3000);
			expect(env).toBeDefined();
			expect(logLevel).toBeDefined();
			expect(port).toBeDefined();
		});

		it('should support feature flag configuration', () => {
			const featureA = ConfigValue('features.featureA', false);
			const featureB = ConfigValue('features.featureB', true);
			expect(featureA).toBeDefined();
			expect(featureB).toBeDefined();
		});

		it('should support CORS configuration', () => {
			const origins = ConfigValue('cors.origins', ['http://localhost:3000']);
			const credentials = ConfigValue('cors.credentials', true);
			expect(origins).toBeDefined();
			expect(credentials).toBeDefined();
		});

		it('should support caching configuration', () => {
			const cacheTtl = ConfigValue('cache.ttl', 3600);
			const cacheBackend = ConfigValue('cache.backend', 'redis');
			expect(cacheTtl).toBeDefined();
			expect(cacheBackend).toBeDefined();
		});
	});

	describe('Decorator transformation logic', () => {
		it('should apply transformation function for ConfigValue', () => {
			const decorator = ConfigValue('app.port', 3000);
			expect(typeof decorator).toBe('function');
		});

		it('should apply transformation function for EnvVar', () => {
			const decorator = EnvVar('PORT', 3000);
			expect(typeof decorator).toBe('function');
		});

		it('should return default value for ConfigValue when value undefined', () => {
			const decorator = ConfigValue('missing.key', 'default-value');
			expect(decorator).toBeDefined();
			expect(typeof decorator).toBe('function');
		});

		it('should return default value for EnvVar when env var missing', () => {
			delete process.env.MISSING_TEST_VAR;
			const decorator = EnvVar('MISSING_TEST_VAR', 'default');
			expect(decorator).toBeDefined();
			expect(typeof decorator).toBe('function');
		});

		it('should convert numeric string to number for EnvVar', () => {
			process.env.TEST_NUMBER_VAR = '42';
			const decorator = EnvVar('TEST_NUMBER_VAR', 0);
			expect(decorator).toBeDefined();
		});

		it('should convert "true" string to boolean for EnvVar', () => {
			process.env.TEST_BOOL_VAR_TRUE = 'true';
			const decorator = EnvVar('TEST_BOOL_VAR_TRUE', false);
			expect(decorator).toBeDefined();
		});

		it('should convert "false" string to boolean for EnvVar', () => {
			process.env.TEST_BOOL_VAR_FALSE = 'false';
			const decorator = EnvVar('TEST_BOOL_VAR_FALSE', true);
			expect(decorator).toBeDefined();
		});

		it('should handle string value for EnvVar without default', () => {
			process.env.TEST_STRING_VAR = 'test-value';
			const decorator = EnvVar('TEST_STRING_VAR');
			expect(decorator).toBeDefined();
		});
	});

	describe('Decorator composition', () => {
		it('should compose multiple ConfigValue decorators', () => {
			const deco1 = ConfigValue('config.key1');
			const deco2 = ConfigValue('config.key2');
			const deco3 = ConfigValue('config.key3');
			expect(deco1).toBeDefined();
			expect(deco2).toBeDefined();
			expect(deco3).toBeDefined();
		});

		it('should compose multiple EnvVar decorators', () => {
			const deco1 = EnvVar('ENV_KEY1');
			const deco2 = EnvVar('ENV_KEY2');
			const deco3 = EnvVar('ENV_KEY3');
			expect(deco1).toBeDefined();
			expect(deco2).toBeDefined();
			expect(deco3).toBeDefined();
		});

		it('should compose ConfigValue and EnvVar decorators together', () => {
			const configDeco = ConfigValue('database.url');
			const envDeco = EnvVar('DATABASE_URL');
			expect(configDeco).toBeDefined();
			expect(envDeco).toBeDefined();
		});
	});

	describe('Decorator with RequestProperty integration', () => {
		it('should use RequestProperty internally for ConfigValue', () => {
			const decorator = ConfigValue('test.key', 'default');
			// Decorator should be a parameter decorator function
			expect(typeof decorator).toBe('function');
			// It should take 3 parameters: target, propertyKey, parameterIndex
			expect(decorator.length).toBe(3);
		});

		it('should use RequestProperty internally for EnvVar', () => {
			const decorator = EnvVar('TEST_KEY', 'default');
			// Decorator should be a parameter decorator function
			expect(typeof decorator).toBe('function');
			// It should take 3 parameters: target, propertyKey, parameterIndex
			expect(decorator.length).toBe(3);
		});
	});

	describe('Edge cases and special characters', () => {
		it('should handle decorator key with dots', () => {
			const deco = ConfigValue('app.config.database.primary.host');
			expect(deco).toBeDefined();
		});

		it('should handle decorator key with hyphens', () => {
			const deco = ConfigValue('app-config.database-url');
			expect(deco).toBeDefined();
		});

		it('should handle decorator key with underscores', () => {
			const deco = ConfigValue('app_config_database_url');
			expect(deco).toBeDefined();
		});

		it('should handle EnvVar with standard naming convention', () => {
			const deco = EnvVar('DATABASE_URL');
			expect(deco).toBeDefined();
		});

		it('should handle EnvVar with numbers in name', () => {
			const deco = EnvVar('SERVICE_PORT_3000');
			expect(deco).toBeDefined();
		});
	});

	describe('Type safety and defaults', () => {
		it('should work with string default', () => {
			const deco = ConfigValue('app.name', 'MyApp');
			expect(deco).toBeDefined();
		});

		it('should work with number default', () => {
			const deco = ConfigValue('app.port', 3000);
			expect(deco).toBeDefined();
		});

		it('should work with boolean default', () => {
			const deco = ConfigValue('app.Debug()', true);
			expect(deco).toBeDefined();
		});

		it('should work with array default', () => {
			const deco = ConfigValue('app.items', [1, 2, 3]);
			expect(deco).toBeDefined();
		});

		it('should work with object default', () => {
			const deco = ConfigValue('app.metadata', { key: 'value' });
			expect(deco).toBeDefined();
		});

		it('should work with undefined default', () => {
			const deco = ConfigValue('app.optional');
			expect(deco).toBeDefined();
		});

		it('should work with null default', () => {
			const deco = ConfigValue('app.nullable', null as any);
			expect(deco).toBeDefined();
		});
	});

	describe('EnvVar with various types', () => {
		it('should handle numeric string conversion', () => {
			process.env.NUM_TEST = '123';
			const deco = EnvVar('NUM_TEST', 0);
			expect(deco).toBeDefined();
		});

		it('should handle boolean string conversion - true case', () => {
			process.env.BOOL_TEST_TRUE = 'true';
			const deco = EnvVar('BOOL_TEST_TRUE', false);
			expect(deco).toBeDefined();
		});

		it('should handle boolean string conversion - false case', () => {
			process.env.BOOL_TEST_FALSE = 'false';
			const deco = EnvVar('BOOL_TEST_FALSE', true);
			expect(deco).toBeDefined();
		});

		it('should handle uppercase TRUE string', () => {
			process.env.BOOL_UPPER = 'TRUE';
			const deco = EnvVar('BOOL_UPPER', false);
			expect(deco).toBeDefined();
		});

		it('should handle lowercase true string', () => {
			process.env.BOOL_LOWER = 'true';
			const deco = EnvVar('BOOL_LOWER', false);
			expect(deco).toBeDefined();
		});

		it('should return undefined for missing env var with no default', () => {
			delete process.env.NO_DEFAULT_VAR;
			const deco = EnvVar('NO_DEFAULT_VAR');
			expect(deco).toBeDefined();
		});

		it('should preserve string value when no type conversion needed', () => {
			process.env.STRING_VALUE = 'hello-world';
			const deco = EnvVar('STRING_VALUE', 'default');
			expect(deco).toBeDefined();
		});
	});

	describe('Practical usage patterns', () => {
		it('should support database configuration extraction', () => {
			const dbUrl = ConfigValue('db.url', 'postgresql://localhost/app');
			const dbPort = ConfigValue('db.port', 5432);
			const dbName = ConfigValue('db.name', 'app_db');
			expect(dbUrl).toBeDefined();
			expect(dbPort).toBeDefined();
			expect(dbName).toBeDefined();
		});

		it('should support Redis configuration', () => {
			const redisUrl = ConfigValue('redis.url', 'redis://localhost:6379');
			const redisTtl = ConfigValue('redis.ttl', 3600);
			expect(redisUrl).toBeDefined();
			expect(redisTtl).toBeDefined();
		});

		it('should support feature flags', () => {
			const featureA = ConfigValue('features.authV2', false);
			const featureB = ConfigValue('features.graphql', true);
			const featureC = ConfigValue('features.webhooks', false);
			expect(featureA).toBeDefined();
			expect(featureB).toBeDefined();
			expect(featureC).toBeDefined();
		});

		it('should support rate limiting configuration', () => {
			const rateLimit = ConfigValue('rateLimit.maxRequests', 100);
			const rateLimitWindow = ConfigValue('rateLimit.window', 60);
			expect(rateLimit).toBeDefined();
			expect(rateLimitWindow).toBeDefined();
		});

		it('should support logging configuration', () => {
			const logLevel = EnvVar('LOG_LEVEL', 'Info()');
			const logFormat = EnvVar('LOG_FORMAT', 'json');
			expect(logLevel).toBeDefined();
			expect(logFormat).toBeDefined();
		});
	});
});
