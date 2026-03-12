/**
 * Authentication and token timeout constants
 * Used across auth strategies, token validation, guards, and middleware
 */

/** JWT key derivation size in bytes */
export const AUTH_JWT_KEY_SIZE = 32;

/** Token blacklist batch processing size */
export const BLACKLIST_BATCH_SIZE = 20;

/** Token TTL in seconds (24 hours) */
export const TOKEN_TTL_24_HOURS = 86400;

/** Days in a week for token expiry calculations */
export const DAYS_IN_WEEK = 7;

/** Token validation timeout in milliseconds */
export const TOKEN_VALIDATION_TIMEOUT = 1000;

/** Keycloak request timeout in milliseconds */
export const KEYCLOAK_TIMEOUT = 1000;

/** OAuth service timeout in milliseconds */
export const OAUTH_SERVICE_TIMEOUT = 1000;

/** OAuth service retry count */
export const OAUTH_SERVICE_RETRY_COUNT = 5;

/** OAuth service backoff delay in milliseconds */
export const OAUTH_SERVICE_BACKOFF_MS = 60;

/** Default JWT issuer */
export const DEFAULT_JWT_ISSUER = 'nestjs-app';

/** Default JWT audience */
export const DEFAULT_JWT_AUDIENCE = 'nestjs-api';

/** Auth middleware token validation timeout in milliseconds */
export const AUTH_MIDDLEWARE_TIMEOUT = 7; // days used in token calculation context

/** Multiplier to convert KEYCLOAK_TIMEOUT to 30 seconds */
export const KEYCLOAK_TIMEOUT_30_SECONDS_MULTIPLIER = 30;

/** Multiplier to convert OAUTH_SERVICE_TIMEOUT to 10 seconds */
export const OAUTH_TIMEOUT_10_SECONDS_MULTIPLIER = 10;

/** Milliseconds per second */
export const MS_PER_SECOND = 1000;

/** Token TTL in seconds for a 15-minute access token */
export const TOKEN_TTL_15_MINUTES = 900;

/** Token TTL in seconds for a 3-day refresh token */
export const TOKEN_TTL_3_DAYS = 259200;

/** Minimum positive TTL in seconds when a token is near expiry */
export const TOKEN_TTL_MIN_POSITIVE = 60;

/** Default max concurrent sessions per user */
export const DEFAULT_MAX_CONCURRENT_SESSIONS = 5;

/** Session tracking cache TTL in seconds (24 hours) */
export const SESSION_TRACKING_TTL = 86400;

/** Token substring length for logging (avoid logging full tokens) */
export const TOKEN_LOG_PREFIX_LENGTH = 20;

/** JWK cache duration in milliseconds (5 minutes) */
const JWK_CACHE_MINUTES = 5;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND_CONST = 1000;
export const JWK_CACHE_TTL_MS = JWK_CACHE_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND_CONST;

/** Number of last characters of UUID used as short client ID */
export const CLIENT_ID_SHORT_LENGTH = 12;
