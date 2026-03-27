export { BaseApplicationError } from './base-application-error.js';
export { createError, ERROR_CONFIGS, type ErrorConfig, type ErrorType } from './error-factory.js';

import { createError, ERROR_CONFIGS } from './error-factory.js';

// Predefined error classes
export const BadRequestError = createError(ERROR_CONFIGS.BAD_REQUEST);
export const UnauthorizedError = createError(ERROR_CONFIGS.UNAUTHORIZED);
export const ForbiddenError = createError(ERROR_CONFIGS.FORBIDDEN);
export const NotFoundError = createError(ERROR_CONFIGS.NOT_FOUND);
export const ConflictError = createError(ERROR_CONFIGS.CONFLICT);
export const UnprocessableEntityError = createError(ERROR_CONFIGS.UNPROCESSABLE_ENTITY);
export const InternalServerError = createError(ERROR_CONFIGS.INTERNAL_SERVER_ERROR);
export const BadGatewayError = createError(ERROR_CONFIGS.BAD_GATEWAY);
export const ServiceUnavailableError = createError(ERROR_CONFIGS.SERVICE_UNAVAILABLE);
export const GatewayTimeoutError = createError(ERROR_CONFIGS.GATEWAY_TIMEOUT);
