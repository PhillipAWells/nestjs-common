import { GraphqlError } from './graphql-error.js';

/**
 * Conflict Error
 *
 * Represents a 409 Conflict error in GraphQL operations.
 * Used when an operation conflicts with the current state.
 *
 * @example
 * ```typescript
 * throw new ConflictError('User already exists');
 * ```
 */
export class ConflictError extends GraphqlError {
	constructor(message = 'Resource conflict', context?: Record<string, any>) {
		const options: any = {
			code: 'CONFLICT',
			statusCode: 409,
		};
		if (context !== undefined) {
			options.context = context;
		}
		super(message, options);
	}
}

/**
 * Rate Limit Error
 *
 * Represents a 429 Too Many Requests error in GraphQL operations.
 * Used when rate limiting is exceeded.
 *
 * @example
 * ```typescript
 * throw new RateLimitError('Rate limit exceeded', { retryAfter: 60 });
 * ```
 */
export class RateLimitError extends GraphqlError {
	constructor(message = 'Rate limit exceeded', context?: Record<string, any>) {
		const options: any = {
			code: 'RATE_LIMIT_EXCEEDED',
			statusCode: 429,
		};
		if (context !== undefined) {
			options.context = context;
		}
		super(message, options);
	}
}
