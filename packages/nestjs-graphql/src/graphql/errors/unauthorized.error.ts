import { GraphqlError } from './graphql-error.js';

/**
 * Unauthorized Error
 *
 * Represents a 401 Unauthorized error in GraphQL operations.
 * Used when authentication is required but not provided.
 *
 * @example
 * ```typescript
 * throw new UnauthorizedError('Authentication required');
 * ```
 */
export class UnauthorizedError extends GraphqlError {
	constructor(message = 'Authentication required', context: Record<string, any> | undefined) {
		super(message, {
			code: 'AUTHENTICATION_REQUIRED',
			statusCode: 401,
			context,
		});
	}
}
