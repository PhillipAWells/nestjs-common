import { GraphqlError } from './graphql-error.js';

/**
 * Validation Error
 *
 * Represents input validation errors in GraphQL operations.
 * Includes field-level validation details.
 *
 * @example
 * ```typescript
 * throw new ValidationError('Invalid input data', {
 *   fields: [{ field: 'email', message: 'Invalid email format' }]
 * });
 * ```
 */
export class ValidationError extends GraphqlError {
	/**
	 * Creates a new Validation error
	 *
	 * @param message - The error message
	 * @param context - Additional context with validation details
	 */
	constructor(message = 'Validation failed', context: Record<string, any> | undefined) {
		super(message, {
			code: 'VALIDATION_ERROR',
			statusCode: 400,
			context,
		});
	}
}
