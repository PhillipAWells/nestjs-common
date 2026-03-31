/**
 * GraphQL Error Classes and Factories
 *
 * Standardized error types for GraphQL resolvers with:
 * - Automatic error code mapping
 * - Consistent error response formatting
 * - Base and GraphQL-specific error classes
 * - Backward compatibility aliases
 *
 * @packageDocumentation
 */

// Re-export base errors from nestjs-common
export {
	BaseApplicationError,
	createError,
	ERROR_CONFIGS as BaseErrorConfigs,
	type IErrorConfig,
	type TErrorType,
	BadRequestError as BaseBadRequestError,
	UnauthorizedError as BaseUnauthorizedError,
	ForbiddenError as BaseForbiddenError,
	NotFoundError as BaseNotFoundError,
	ConflictError as BaseConflictError,
	UnprocessableEntityError as BaseUnprocessableEntityError,
	InternalServerError as BaseInternalServerError,
	BadGatewayError as BaseBadGatewayError,
	ServiceUnavailableError as BaseServiceUnavailableError,
	GatewayTimeoutError as BaseGatewayTimeoutError,
} from '@pawells/nestjs-shared/common';

// GraphQL-specific error factory
export { CreateGraphQLError as createGraphQLError, GRAPHQL_ERROR_CONFIGS, type IGraphQLErrorConfig, type TGraphQLErrorType } from './graphql-error-factory.js';

// Legacy GraphqlError for backward compatibility
export { GraphqlError } from './graphql-error.js';

// Factory-generated GraphQL error classes
import { CreateGraphQLError, GRAPHQL_ERROR_CONFIGS } from './graphql-error-factory.js';

export const UnauthorizedError = CreateGraphQLError(GRAPHQL_ERROR_CONFIGS.UNAUTHENTICATED);
export const ForbiddenError = CreateGraphQLError(GRAPHQL_ERROR_CONFIGS.FORBIDDEN);
export const NotFoundError = CreateGraphQLError(GRAPHQL_ERROR_CONFIGS.NOT_FOUND);
export const BadRequestError = CreateGraphQLError(GRAPHQL_ERROR_CONFIGS.BAD_USER_INPUT);
export const ConflictError = CreateGraphQLError(GRAPHQL_ERROR_CONFIGS.CONFLICT);
export const InternalServerError = CreateGraphQLError(GRAPHQL_ERROR_CONFIGS.INTERNAL_SERVER_ERROR);
export const RateLimitError = CreateGraphQLError(GRAPHQL_ERROR_CONFIGS.RATE_LIMIT_EXCEEDED);

// Additional GraphQL-specific errors
export const IValidationError = CreateGraphQLError(GRAPHQL_ERROR_CONFIGS.VALIDATION_ERROR);

// Backward compatibility aliases (deprecated - use the factory-generated classes above)
export { NotFoundError as LegacyNotFoundError } from './not-found.error.js';
export { IValidationError as LegacyValidationError } from './validation.error.js';
export { UnauthorizedError as LegacyUnauthorizedError } from './unauthorized.error.js';
export { ForbiddenError as LegacyForbiddenError } from './forbidden.error.js';
export { ConflictError as LegacyConflictError } from './conflict.error.js';
export { RateLimitError as LegacyRateLimitError } from './rate-limit.error.js';
