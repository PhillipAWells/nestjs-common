/**
 * HTTP Status Code Constants
 * Standard HTTP status codes used across error handling and responses
 */

/** HTTP 200 OK status code */
export const HTTP_STATUS_OK = 200;

/** HTTP 400 Bad Request status code */
export const HTTP_STATUS_BAD_REQUEST = 400;

/** HTTP 401 Unauthorized status code */
export const HTTP_STATUS_UNAUTHORIZED = 401;

/** HTTP 403 Forbidden status code */
export const HTTP_STATUS_FORBIDDEN = 403;

/** HTTP 404 Not Found status code */
export const HTTP_STATUS_NOT_FOUND = 404;

/** HTTP 429 Too Many Requests (rate limit) status code */
export const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

/** HTTP 422 Unprocessable Entity status code */
export const HTTP_STATUS_UNPROCESSABLE_ENTITY = 422;

/** HTTP 500 Internal Server Error status code */
export const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

/** HTTP 502 Bad Gateway status code */
export const HTTP_STATUS_BAD_GATEWAY = 502;

/** HTTP 503 Service Unavailable status code */
export const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;

/** HTTP 504 Gateway Timeout status code */
export const HTTP_STATUS_GATEWAY_TIMEOUT = 504;

/** MongoDB duplicate key error code (treated as HTTP 11000) */
export const MONGODB_DUPLICATE_KEY_ERROR = 11000;
