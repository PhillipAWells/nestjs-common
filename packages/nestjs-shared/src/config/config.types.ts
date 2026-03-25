/**
 * Application Configuration Interface
 * Defines top-level application configuration for port, environment, CORS, file uploads, logging, and optional GraphQL settings.
 */
export interface AppConfig {
	/** Server port number */
	port: number;
	/** Node environment (development, production, test) */
	nodeEnv: string;
	/** CORS origin URL */
	corsOrigin: string;
	/** Maximum file size in bytes */
	maxFileSize: number;
	/** Storage path for uploads */
	storagePath: string;
	/** Log level (debug, info, warn, error, fatal) */
	logLevel: string;
	/** Optional GraphQL configuration */
	graphql?: {
		/** Enable GraphQL Playground */
		playground: boolean;
		/** Enable schema introspection */
		introspection: boolean;
	};
}

/**
 * Database Configuration Interface
 * Defines MongoDB/database connection parameters and connection pool options.
 */
export interface DatabaseConfig {
	/** Database connection URI */
	uri: string;
	/** Optional connection options */
	options?: {
		/** Use new URL parser */
		useNewUrlParser?: boolean;
		/** Use unified topology */
		useUnifiedTopology?: boolean;
		/** Connection pool size */
		maxPoolSize?: number;
		/** Server selection timeout in milliseconds */
		serverSelectionTimeoutMS?: number;
		/** Socket timeout in milliseconds */
		socketTimeoutMS?: number;
	};
}

/**
 * Cache Configuration Interface
 * Defines Redis cache connection parameters, timeouts, retry behavior, and performance settings.
 */
export interface CacheConfig {
	/** Redis host */
	host: string;
	/** Redis port */
	port: number;
	/** Optional Redis password for authentication */
	password?: string;
	/** Redis database number */
	db: number;
	/** Time-to-live (TTL) in seconds for cache entries */
	ttl: number;
	/** Key prefix for all cache entries */
	keyPrefix: string;
	/** Connection timeout in milliseconds */
	connectTimeout: number;
	/** Command timeout in milliseconds */
	commandTimeout: number;
	/** Keep-alive interval in milliseconds */
	keepAlive: number;
	/** Delay between connection retry attempts in milliseconds */
	retryDelay: number;
	/** Maximum number of connection retry attempts */
	maxRetries: number;
	/** Enable ready check before issuing commands */
	enableReadyCheck: boolean;
	/** Defer connection until first command */
	lazyConnect: boolean;
	/** Address family (4 for IPv4, 6 for IPv6) */
	family: number;
	/** Enable Redis metrics collection */
	enableMetrics: boolean;
}

/**
 * Authentication Configuration Interface
 * Defines JWT token signing and validation parameters.
 */
export interface AuthConfig {
	/** JWT token configuration */
	jwt: {
		/** Secret key for signing tokens */
		secret: string;
		/** Token expiration time (e.g., '15m', '1h', '7d') */
		expiresIn: string;
		/** Refresh token expiration time */
		refreshExpiresIn?: string;
		/** Token issuer claim */
		issuer?: string;
		/** Token audience claim */
		audience?: string;
	};
}

/**
 * Generic Configuration Validation Result
 * Indicates validation outcome and collects any errors or warnings encountered.
 */
export interface ValidationResult {
	/** Whether validation passed */
	isValid: boolean;
	/** Array of validation error messages */
	errors?: string[];
	/** Array of validation warning messages */
	warnings?: string[];
}

/**
 * Configuration Schema Definition
 * Object map defining validation rules for configuration values.
 */
export interface ConfigSchema {
	/** Joi schema definition for configuration keys */
	[key: string]: any;
}

/**
 * Environment Configuration Options
 * Options for loading and validating environment variables from files and process.env.
 */
export interface EnvironmentOptions {
	/** Joi schema for validating environment variables */
	validationSchema?: ConfigSchema;
	/** Options passed to Joi schema validation */
	validationOptions?: {
		/** Allow unknown environment variables */
		allowUnknown?: boolean;
		/** Strip unknown environment variables */
		stripUnknown?: boolean;
	};
	/** Skip loading from .env files */
	ignoreEnvFile?: boolean;
	/** Skip reading from process.env */
	ignoreEnvVars?: boolean;
	/** Path(s) to .env files to load */
	envFilePath?: string | string[];
}
