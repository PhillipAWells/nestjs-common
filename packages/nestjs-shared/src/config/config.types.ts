/**
 * Application Configuration Interface
 */
export interface AppConfig {
	port: number;
	nodeEnv: string;
	corsOrigin: string;
	maxFileSize: number;
	storagePath: string;
	logLevel: string;
	graphql?: {
		playground: boolean;
		introspection: boolean;
	};
}

/**
 * Database Configuration Interface
 */
export interface DatabaseConfig {
	uri: string;
	options?: {
		useNewUrlParser?: boolean;
		useUnifiedTopology?: boolean;
		maxPoolSize?: number;
		serverSelectionTimeoutMS?: number;
		socketTimeoutMS?: number;
	};
}

/**
 * Cache Configuration Interface
 */
export interface CacheConfig {
	host: string;
	port: number;
	password?: string;
	db: number;
	ttl: number;
	keyPrefix: string;
	connectTimeout: number;
	commandTimeout: number;
	keepAlive: number;
	retryDelay: number;
	maxRetries: number;
	enableReadyCheck: boolean;
	lazyConnect: boolean;
	family: number;
	enableMetrics: boolean;
}

/**
 * Authentication Configuration Interface
 */
export interface AuthConfig {
	jwt: {
		secret: string;
		expiresIn: string;
		refreshExpiresIn?: string;
		issuer?: string;
		audience?: string;
	};
}

/**
 * Generic Configuration Validation Result
 */
export interface ValidationResult {
	isValid: boolean;
	errors?: string[];
	warnings?: string[];
}

/**
 * Configuration Schema Definition
 */
export interface ConfigSchema {
	[key: string]: any;
}

/**
 * Environment Configuration Options
 */
export interface EnvironmentOptions {
	validationSchema?: ConfigSchema;
	validationOptions?: {
		allowUnknown?: boolean;
		stripUnknown?: boolean;
	};
	ignoreEnvFile?: boolean;
	ignoreEnvVars?: boolean;
	envFilePath?: string | string[];
}
