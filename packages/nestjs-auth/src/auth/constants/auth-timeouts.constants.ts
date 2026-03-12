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
