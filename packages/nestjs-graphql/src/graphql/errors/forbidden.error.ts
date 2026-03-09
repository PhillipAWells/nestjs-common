import { GraphqlError } from './graphql-error.js';

/**
 * Forbidden Error
 *
 * Represents a 403 Forbidden error in GraphQL operations.
 * Used when authentication succeeded but authorization failed.
 *
 * @example
 * ```typescript
 * throw new ForbiddenError('Access denied');
 * ```
 */
export class ForbiddenError extends GraphqlError {
	/**
	 * Creates a new Forbidden error
	 *
	 * @param message - The error message
	 * @param context - Additional context information
	 */
	constructor(message = 'Access denied', context?: Record<string, any>) {
		const options: any = {
			code: 'AUTHORIZATION_FAILED',
			statusCode: 403,
		};
		if (context !== undefined) {
			options.context = context;
		}
		super(message, options);
	}
}
