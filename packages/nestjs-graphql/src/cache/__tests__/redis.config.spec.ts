import { getRedisConfig, getRedisConnectionOptions } from '../redis.config.js';

describe('Redis Configuration Validation', () => {
	beforeEach(() => {
		// Clean up all Redis environment variables before each test
		delete process.env['REDIS_HOST'];
		delete process.env['REDIS_PORT'];
		delete process.env['REDIS_PASSWORD'];
		delete process.env['REDIS_DB'];
		delete process.env['REDIS_MAX_RETRIES'];
		delete process.env['REDIS_CONNECT_TIMEOUT'];
		delete process.env['REDIS_COMMAND_TIMEOUT'];
		delete process.env['REDIS_FAMILY'];
		delete process.env['REDIS_KEEP_ALIVE'];
		delete process.env['REDIS_RETRY_DELAY'];
		delete process.env['REDIS_KEY_PREFIX'];
		delete process.env['REDIS_ENABLE_READY_CHECK'];
		delete process.env['REDIS_LAZY_CONNECT'];
	});
	describe('REDIS_HOST', () => {
		it('should accept valid hostnames', () => {
			process.env['REDIS_HOST'] = 'localhost';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept valid IP addresses', () => {
			process.env['REDIS_HOST'] = '127.0.0.1';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should reject invalid hostnames', () => {
			process.env['REDIS_HOST'] = 'invalid..host';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});

		it('should reject empty hostnames', () => {
			process.env['REDIS_HOST'] = '';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});
	});

	describe('REDIS_PORT', () => {
		beforeEach(() => {
			process.env['REDIS_HOST'] = 'localhost';
		});

		it('should accept valid port numbers', () => {
			process.env['REDIS_PORT'] = '6379';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept port 1', () => {
			process.env['REDIS_PORT'] = '1';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept port 65535', () => {
			process.env['REDIS_PORT'] = '65535';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should reject port 0', () => {
			process.env['REDIS_PORT'] = '0';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});

		it('should reject port above 65535', () => {
			process.env['REDIS_PORT'] = '65536';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});

		it('should reject non-numeric ports', () => {
			process.env['REDIS_PORT'] = 'invalid';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});
	});

	describe('REDIS_PASSWORD', () => {
		beforeEach(() => {
			process.env['REDIS_HOST'] = 'localhost';
			process.env['REDIS_PORT'] = '6379';
		});

		it('should accept valid passwords with minimum length', () => {
			process.env['REDIS_PASSWORD'] = '12345678';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept undefined password', () => {
			delete process.env['REDIS_PASSWORD'];
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should reject passwords that are too short', () => {
			process.env['REDIS_PASSWORD'] = '1234567';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});

		it('should accept empty string password', () => {
			process.env['REDIS_PASSWORD'] = '';
			expect(() => getRedisConfig()).not.toThrow();
		});
	});

	describe('REDIS_DB', () => {
		beforeEach(() => {
			process.env['REDIS_HOST'] = 'localhost';
			process.env['REDIS_PORT'] = '6379';
		});

		it('should accept valid database numbers', () => {
			process.env['REDIS_DB'] = '0';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept database number 15', () => {
			process.env['REDIS_DB'] = '15';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should reject database numbers below 0', () => {
			process.env['REDIS_DB'] = '-1';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});

		it('should reject database numbers above 15', () => {
			process.env['REDIS_DB'] = '16';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});

		it('should reject non-integer database numbers', () => {
			process.env['REDIS_DB'] = '1.5';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});
	});

	describe('REDIS_KEY_PREFIX', () => {
		beforeEach(() => {
			process.env['REDIS_HOST'] = 'localhost';
			process.env['REDIS_PORT'] = '6379';
			process.env['REDIS_DB'] = '0';
		});

		it('should accept valid key prefixes', () => {
			process.env['REDIS_KEY_PREFIX'] = 'cache:';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept undefined key prefix', () => {
			delete process.env['REDIS_KEY_PREFIX'];
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept empty key prefix', () => {
			process.env['REDIS_KEY_PREFIX'] = '';
			expect(() => getRedisConfig()).not.toThrow();
		});
	});

	describe('REDIS_ENABLE_READY_CHECK', () => {
		beforeEach(() => {
			process.env['REDIS_HOST'] = 'localhost';
			process.env['REDIS_PORT'] = '6379';
			process.env['REDIS_DB'] = '0';
		});

		it('should accept boolean values', () => {
			process.env['REDIS_ENABLE_READY_CHECK'] = 'true';
			expect(() => getRedisConfig()).not.toThrow();

			process.env['REDIS_ENABLE_READY_CHECK'] = 'false';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept undefined value', () => {
			delete process.env['REDIS_ENABLE_READY_CHECK'];
			expect(() => getRedisConfig()).not.toThrow();
		});
	});

	describe('REDIS_MAX_RETRIES', () => {
		beforeEach(() => {
			process.env['REDIS_HOST'] = 'localhost';
			process.env['REDIS_PORT'] = '6379';
			process.env['REDIS_DB'] = '0';
		});

		it('should accept valid retry counts', () => {
			process.env['REDIS_MAX_RETRIES'] = '3';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept 0 retries', () => {
			process.env['REDIS_MAX_RETRIES'] = '0';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should reject negative retry counts', () => {
			process.env['REDIS_MAX_RETRIES'] = '-1';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});

		it('should reject non-integer retry counts', () => {
			process.env['REDIS_MAX_RETRIES'] = '1.5';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});
	});

	describe('REDIS_LAZY_CONNECT', () => {
		beforeEach(() => {
			process.env['REDIS_HOST'] = 'localhost';
			process.env['REDIS_PORT'] = '6379';
			process.env['REDIS_DB'] = '0';
		});

		it('should accept boolean values', () => {
			process.env['REDIS_LAZY_CONNECT'] = 'false';
			expect(() => getRedisConfig()).not.toThrow();

			process.env['REDIS_LAZY_CONNECT'] = 'true';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept undefined value', () => {
			delete process.env['REDIS_LAZY_CONNECT'];
			expect(() => getRedisConfig()).not.toThrow();
		});
	});

	describe('REDIS_CONNECT_TIMEOUT', () => {
		beforeEach(() => {
			process.env['REDIS_HOST'] = 'localhost';
			process.env['REDIS_PORT'] = '6379';
			process.env['REDIS_DB'] = '0';
		});

		it('should accept valid timeout values', () => {
			process.env['REDIS_CONNECT_TIMEOUT'] = '60000';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept minimum timeout', () => {
			process.env['REDIS_CONNECT_TIMEOUT'] = '100';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should reject timeout below minimum', () => {
			process.env['REDIS_CONNECT_TIMEOUT'] = '99';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});

		it('should reject non-integer timeout', () => {
			process.env['REDIS_CONNECT_TIMEOUT'] = '100.5';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});
	});

	describe('REDIS_COMMAND_TIMEOUT', () => {
		beforeEach(() => {
			process.env['REDIS_HOST'] = 'localhost';
			process.env['REDIS_PORT'] = '6379';
			process.env['REDIS_DB'] = '0';
		});

		it('should accept valid timeout values', () => {
			process.env['REDIS_COMMAND_TIMEOUT'] = '5000';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept minimum timeout', () => {
			process.env['REDIS_COMMAND_TIMEOUT'] = '100';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should reject timeout below minimum', () => {
			process.env['REDIS_COMMAND_TIMEOUT'] = '99';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});
	});

	describe('REDIS_FAMILY', () => {
		beforeEach(() => {
			process.env['REDIS_HOST'] = 'localhost';
			process.env['REDIS_PORT'] = '6379';
			process.env['REDIS_DB'] = '0';
		});

		it('should accept IPv4 family', () => {
			process.env['REDIS_FAMILY'] = '4';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept IPv6 family', () => {
			process.env['REDIS_FAMILY'] = '6';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should reject invalid family values', () => {
			process.env['REDIS_FAMILY'] = '8';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});
	});

	describe('REDIS_KEEP_ALIVE', () => {
		beforeEach(() => {
			process.env['REDIS_HOST'] = 'localhost';
			process.env['REDIS_PORT'] = '6379';
			process.env['REDIS_DB'] = '0';
		});

		it('should accept valid keep alive values', () => {
			process.env['REDIS_KEEP_ALIVE'] = '30000';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept 0 keep alive', () => {
			process.env['REDIS_KEEP_ALIVE'] = '0';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should reject negative keep alive values', () => {
			process.env['REDIS_KEEP_ALIVE'] = '-1';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});
	});

	describe('REDIS_RETRY_DELAY', () => {
		beforeEach(() => {
			process.env['REDIS_HOST'] = 'localhost';
			process.env['REDIS_PORT'] = '6379';
			process.env['REDIS_DB'] = '0';
		});

		it('should accept valid retry delay values', () => {
			process.env['REDIS_RETRY_DELAY'] = '100';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should accept 0 retry delay', () => {
			process.env['REDIS_RETRY_DELAY'] = '0';
			expect(() => getRedisConfig()).not.toThrow();
		});

		it('should reject negative retry delay values', () => {
			process.env['REDIS_RETRY_DELAY'] = '-1';
			expect(() => getRedisConfig()).toThrow('Redis configuration validation failed');
		});
	});

	describe('getRedisConfig', () => {
		beforeEach(() => {
			// Set up minimal valid environment
			process.env['REDIS_HOST'] = 'localhost';
			process.env['REDIS_PORT'] = '6379';
			process.env['REDIS_DB'] = '0';
		});

		afterEach(() => {
			// Clean up environment variables
			delete process.env['REDIS_HOST'];
			delete process.env['REDIS_PORT'];
			delete process.env['REDIS_DB'];
			delete process.env['REDIS_PASSWORD'];
			delete process.env['REDIS_KEY_PREFIX'];
			delete process.env['REDIS_ENABLE_READY_CHECK'];
			delete process.env['REDIS_MAX_RETRIES'];
			delete process.env['REDIS_LAZY_CONNECT'];
			delete process.env['REDIS_CONNECT_TIMEOUT'];
			delete process.env['REDIS_COMMAND_TIMEOUT'];
			delete process.env['REDIS_FAMILY'];
			delete process.env['REDIS_KEEP_ALIVE'];
			delete process.env['REDIS_RETRY_DELAY'];
		});

		it('should return valid IRedisConfig object', () => {
			const config = getRedisConfig();
			expect(config).toHaveProperty('host', 'localhost');
			expect(config).toHaveProperty('port', 6379);
			expect(config).toHaveProperty('db', 0);
			expect(config).toHaveProperty('keyPrefix', 'cache:');
			expect(config).toHaveProperty('enableReadyCheck', true);
			expect(config).toHaveProperty('maxRetriesPerRequest', 3);
			expect(config).toHaveProperty('lazyConnect', false);
			expect(config).toHaveProperty('connectTimeout', 60000);
			expect(config).toHaveProperty('commandTimeout', 5000);
			expect(config).toHaveProperty('family', 4);
			expect(config).toHaveProperty('keepAlive', 30000);
		});

		it('should handle password correctly', () => {
			process.env['REDIS_PASSWORD'] = 'testpassword';
			const config = getRedisConfig();
			expect(config).toHaveProperty('password', 'testpassword');
		});

		it('should handle undefined password', () => {
			const config = getRedisConfig();
			expect(config).toHaveProperty('password', undefined);
		});

		it('should parse numeric values correctly', () => {
			process.env['REDIS_PORT'] = '6380';
			process.env['REDIS_DB'] = '5';
			process.env['REDIS_MAX_RETRIES'] = '10';
			const config = getRedisConfig();
			expect(config).toHaveProperty('port', 6380);
			expect(config).toHaveProperty('db', 5);
			expect(config).toHaveProperty('maxRetriesPerRequest', 10);
		});

		it('should parse boolean values correctly', () => {
			process.env['REDIS_ENABLE_READY_CHECK'] = 'false';
			process.env['REDIS_LAZY_CONNECT'] = 'true';
			const config = getRedisConfig();
			expect(config).toHaveProperty('enableReadyCheck', false);
			expect(config).toHaveProperty('lazyConnect', true);
		});
	});

	describe('getRedisConnectionOptions', () => {
		beforeEach(() => {
			process.env['REDIS_HOST'] = 'localhost';
			process.env['REDIS_PORT'] = '6379';
			process.env['REDIS_DB'] = '0';
		});

		afterEach(() => {
			delete process.env['REDIS_HOST'];
			delete process.env['REDIS_PORT'];
			delete process.env['REDIS_DB'];
			delete process.env['REDIS_CACHE_TTL'];
		});

		it('should return valid IRedisConnectionOptions object', () => {
			const options = getRedisConnectionOptions();
			expect(options).toHaveProperty('host', 'localhost');
			expect(options).toHaveProperty('port', 6379);
			expect(options).toHaveProperty('db', 0);
			expect(options).toHaveProperty('ttl', 3600);
		});

		it('should handle custom TTL', () => {
			process.env['REDIS_CACHE_TTL'] = '7200';
			const options = getRedisConnectionOptions();
			expect(options).toHaveProperty('ttl', 7200);
		});
	});

	describe('Complete Valid Configuration', () => {
		beforeEach(() => {
			process.env['REDIS_HOST'] = 'localhost';
			process.env['REDIS_PORT'] = '6379';
			process.env['REDIS_PASSWORD'] = 'securepassword123';
			process.env['REDIS_DB'] = '0';
			process.env['REDIS_KEY_PREFIX'] = 'myapp:';
			process.env['REDIS_ENABLE_READY_CHECK'] = 'true';
			process.env['REDIS_MAX_RETRIES'] = '3';
			process.env['REDIS_LAZY_CONNECT'] = 'false';
			process.env['REDIS_CONNECT_TIMEOUT'] = '60000';
			process.env['REDIS_COMMAND_TIMEOUT'] = '5000';
			process.env['REDIS_FAMILY'] = '4';
			process.env['REDIS_KEEP_ALIVE'] = '30000';
			process.env['REDIS_RETRY_DELAY'] = '100';
		});

		afterEach(() => {
			delete process.env['REDIS_HOST'];
			delete process.env['REDIS_PORT'];
			delete process.env['REDIS_PASSWORD'];
			delete process.env['REDIS_DB'];
			delete process.env['REDIS_KEY_PREFIX'];
			delete process.env['REDIS_ENABLE_READY_CHECK'];
			delete process.env['REDIS_MAX_RETRIES'];
			delete process.env['REDIS_LAZY_CONNECT'];
			delete process.env['REDIS_CONNECT_TIMEOUT'];
			delete process.env['REDIS_COMMAND_TIMEOUT'];
			delete process.env['REDIS_FAMILY'];
			delete process.env['REDIS_KEEP_ALIVE'];
			delete process.env['REDIS_RETRY_DELAY'];
		});

		it('should accept complete valid configuration', () => {
			expect(() => getRedisConfig()).not.toThrow();
			const config = getRedisConfig();
			expect(config).toBeDefined();
			expect(typeof config).toBe('object');
		});
	});
});
