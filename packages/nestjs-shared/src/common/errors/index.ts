export { BaseApplicationError } from './base-application-error.js';
export { CreateError as createError, ERROR_CONFIGS, type IErrorConfig, type TErrorType } from './error-factory.js';

import { CreateError, ERROR_CONFIGS } from './error-factory.js';

// Predefined error classes
export const BadRequestError = CreateError(ERROR_CONFIGS.BAD_REQUEST);
export const UnauthorizedError = CreateError(ERROR_CONFIGS.UNAUTHORIZED);
export const ForbiddenError = CreateError(ERROR_CONFIGS.FORBIDDEN);
export const NotFoundError = CreateError(ERROR_CONFIGS.NOT_FOUND);
export const ConflictError = CreateError(ERROR_CONFIGS.CONFLICT);
export const UnprocessableEntityError = CreateError(ERROR_CONFIGS.UNPROCESSABLE_ENTITY);
export const InternalServerError = CreateError(ERROR_CONFIGS.INTERNAL_SERVER_ERROR);
export const BadGatewayError = CreateError(ERROR_CONFIGS.BAD_GATEWAY);
export const ServiceUnavailableError = CreateError(ERROR_CONFIGS.SERVICE_UNAVAILABLE);
export const GatewayTimeoutError = CreateError(ERROR_CONFIGS.GATEWAY_TIMEOUT);
