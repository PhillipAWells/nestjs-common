import Joi from 'joi';
import { RedisOptions } from 'ioredis';
import {
	REDIS_MAX_PORT,
	REDIS_DEFAULT_PORT,
	REDIS_MIN_DB,
	REDIS_MAX_DB,
	REDIS_DEFAULT_DB,
	REDIS_MIN_PASSWORD_LENGTH,
	REDIS_DEFAULT_MAX_RETRIES,
	REDIS_DEFAULT_CONNECT_TIMEOUT,
	REDIS_MIN_TIMEOUT,
	REDIS_DEFAULT_COMMAND_TIMEOUT,
	REDIS_IPV4_FAMILY,
	REDIS_IPV6_FAMILY,
	REDIS_DEFAULT_FAMILY,
	REDIS_DEFAULT_KEEP_ALIVE,
	REDIS_DEFAULT_RETRY_DELAY,
	REDIS_DEFAULT_KEY_PREFIX,
} from './constants/redis.constants.js';

/**
 * Redis connection configuration interface
 */
export interface RedisConfig {
	host: string;
	port: number;
	password?: string;
	db?: number;
	keyPrefix?: string;
	enableReadyCheck?: boolean;
	maxRetriesPerRequest?: number;
	lazyConnect?: boolean;
	reconnectOnError?: (err: Error) => boolean;
	connectTimeout?: number;
	commandTimeout?: number;
	family?: number;
	keepAlive?: number;
}

/**
 * Redis connection options for cache-manager-redis-store
 */
export interface RedisConnectionOptions {
	host: string;
	port: number;
	password?: string;
	db?: number;
	ttl?: number;
	keyPrefix?: string;
	enableReadyCheck?: boolean;
	maxRetriesPerRequest?: number;
	lazyConnect?: boolean;
	reconnectOnError?: (err: Error) => boolean;
	connectTimeout?: number;
	commandTimeout?: number;
	family?: number;
	keepAlive?: number;
}

/**
 * Validate Redis configuration against Joi schema
 *
 * Validates all Redis environment variable configuration options and applies defaults.
 * Uses Joi for schema validation with strict type checking and range validation on
 * numeric values (ports, timeouts, etc.).
 *
 * @param config Configuration object containing Redis environment variables
 * @returns Validated configuration object with applied defaults
 * @throws Error if any configuration value fails validation (e.g., port out of range, invalid hostname)
 *
 * @example
 * ```typescript
 * const config = validateRedisConfig({
 *   REDIS_HOST: 'localhost',
 *   REDIS_PORT: '6379',
 *   REDIS_PASSWORD: 'secret',
 * });
 * ```
 */
export function validateRedisConfig(config: Record<string, any>): Record<string, any> {
	// Allow undefined values - they will use defaults
	const schema = Joi.object({
		REDIS_HOST: Joi.string().hostname().default('localhost'),
		REDIS_PORT: Joi.number().integer().min(1).max(REDIS_MAX_PORT).default(REDIS_DEFAULT_PORT),
		REDIS_PASSWORD: Joi.string().allow('').min(REDIS_MIN_PASSWORD_LENGTH).default(''),
		REDIS_DB: Joi.number().integer().min(REDIS_MIN_DB).max(REDIS_MAX_DB).default(REDIS_DEFAULT_DB),
		REDIS_MAX_RETRIES: Joi.number().integer().min(0).default(REDIS_DEFAULT_MAX_RETRIES),
		REDIS_CONNECT_TIMEOUT: Joi.number().integer().min(REDIS_MIN_TIMEOUT).default(REDIS_DEFAULT_CONNECT_TIMEOUT),
		REDIS_COMMAND_TIMEOUT: Joi.number().integer().min(REDIS_MIN_TIMEOUT).default(REDIS_DEFAULT_COMMAND_TIMEOUT),
		REDIS_FAMILY: Joi.number().integer().valid(REDIS_IPV4_FAMILY, REDIS_IPV6_FAMILY).default(REDIS_DEFAULT_FAMILY),
		REDIS_KEEP_ALIVE: Joi.number().integer().min(0).default(REDIS_DEFAULT_KEEP_ALIVE),
		REDIS_RETRY_DELAY: Joi.number().integer().min(0).default(REDIS_DEFAULT_RETRY_DELAY),
		REDIS_KEY_PREFIX: Joi.string().allow('').default(REDIS_DEFAULT_KEY_PREFIX),
	});

	const { error, value } = schema.validate(config, { allowUnknown: true });
	if (error) {
		throw new Error(`Redis configuration validation failed: ${error.message}`);
	}
	return value;
}

/**
 * Get Redis configuration from environment variables with defaults
 * @returns RedisConfig object
 */
export function getRedisConfig(): RedisConfig {
	// Validate environment variables - Joi will handle optional fields properly
	const envVars: Record<string, any> = {
		REDIS_HOST: process.env['REDIS_HOST'],
		REDIS_PORT: process.env['REDIS_PORT'],
		REDIS_PASSWORD: process.env['REDIS_PASSWORD'],
		REDIS_DB: process.env['REDIS_DB'],
		REDIS_MAX_RETRIES: process.env['REDIS_MAX_RETRIES'],
		REDIS_CONNECT_TIMEOUT: process.env['REDIS_CONNECT_TIMEOUT'],
		REDIS_COMMAND_TIMEOUT: process.env['REDIS_COMMAND_TIMEOUT'],
		REDIS_FAMILY: process.env['REDIS_FAMILY'],
		REDIS_KEEP_ALIVE: process.env['REDIS_KEEP_ALIVE'],
		REDIS_RETRY_DELAY: process.env['REDIS_RETRY_DELAY'],
		REDIS_KEY_PREFIX: process.env['REDIS_KEY_PREFIX'],
	};

	validateRedisConfig(envVars);

	return {
		host: process.env['REDIS_HOST'] ?? 'localhost',
		port: parseInt(process.env['REDIS_PORT'] ?? `${REDIS_DEFAULT_PORT}`, 10),
		password: process.env['REDIS_PASSWORD'] ?? undefined,
		db: parseInt(process.env['REDIS_DB'] ?? `${REDIS_DEFAULT_DB}`, 10),
		keyPrefix: process.env['REDIS_KEY_PREFIX'] ?? REDIS_DEFAULT_KEY_PREFIX,
		enableReadyCheck: process.env['REDIS_ENABLE_READY_CHECK'] !== 'false',
		maxRetriesPerRequest: parseInt(process.env['REDIS_MAX_RETRIES'] ?? `${REDIS_DEFAULT_MAX_RETRIES}`, 10),
		lazyConnect: process.env['REDIS_LAZY_CONNECT'] === 'true',
		reconnectOnError: (err: Error) => {
			const targetErrors = ['READONLY', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];
			return targetErrors.some(errorType => err.message.includes(errorType));
		},
		connectTimeout: parseInt(process.env['REDIS_CONNECT_TIMEOUT'] ?? `${REDIS_DEFAULT_CONNECT_TIMEOUT}`, 10),
		commandTimeout: parseInt(process.env['REDIS_COMMAND_TIMEOUT'] ?? `${REDIS_DEFAULT_COMMAND_TIMEOUT}`, 10),
		family: parseInt(process.env['REDIS_FAMILY'] ?? `${REDIS_DEFAULT_FAMILY}`, 10),
		keepAlive: parseInt(process.env['REDIS_KEEP_ALIVE'] ?? `${REDIS_DEFAULT_KEEP_ALIVE}`, 10),
	} as RedisConfig;
}

/**
 * Get Redis connection options for cache-manager-redis-store
 * @returns RedisConnectionOptions object
 */
export function getRedisConnectionOptions(): RedisConnectionOptions {
	const config = getRedisConfig();
	return {
		...config,
		ttl: parseInt(process.env['REDIS_CACHE_TTL'] ?? '3600', 10),
	};
}

/**
 * Create RedisOptions for ioredis client
 * @param config RedisConfig
 * @returns RedisOptions
 */
export function createRedisOptions(config: RedisConfig): RedisOptions {
	return {
		host: config.host,
		port: config.port,
		password: config.password,
		db: config.db,
		keyPrefix: config.keyPrefix,
		enableReadyCheck: config.enableReadyCheck,
		maxRetriesPerRequest: config.maxRetriesPerRequest,
		lazyConnect: config.lazyConnect,
		reconnectOnError: config.reconnectOnError,
		connectTimeout: config.connectTimeout,
		commandTimeout: config.commandTimeout,
		family: config.family,
		keepAlive: config.keepAlive,
	} as RedisOptions;
}
