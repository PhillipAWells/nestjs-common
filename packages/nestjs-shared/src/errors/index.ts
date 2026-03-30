// Error base classes and factories
export { BaseApplicationError, createError } from '../common/errors/index.js';
export { ERROR_CONFIGS } from '../common/errors/index.js';
export type { IErrorConfig, TErrorType } from '../common/errors/index.js';

// Typed HTTP error classes
export {
	BadRequestError,
	UnauthorizedError,
	ForbiddenError,
	NotFoundError,
	ConflictError,
	UnprocessableEntityError,
	InternalServerError,
	BadGatewayError,
	ServiceUnavailableError,
	GatewayTimeoutError,
} from '../common/errors/index.js';

// Error handling services
export { ErrorSanitizerService } from '../common/services/error-sanitizer.service.js';
export { ErrorCategorizerService } from '../common/services/error-categorizer.service.js';

// Exception filters
export { GlobalExceptionFilter } from '../common/filters/global-exception.filter.js';
export { HttpExceptionFilter } from '../common/filters/http-exception.filter.js';
