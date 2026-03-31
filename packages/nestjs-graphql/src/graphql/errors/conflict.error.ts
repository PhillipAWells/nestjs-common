import { GraphqlError } from './graphql-error.js';

/**
 * Conflict Error
 *
 * Represents a 409 Conflict error in GraphQL operations.
 * Used when an operation conflicts with the current state.
 *
 * @example
 * ```typescript
 * throw new ConflictError('IUser already exists');
 * ```
 */
export class ConflictError extends GraphqlError {
	constructor(message = 'Resource conflict', context?: Record<string, any>) {
		const Options: any = {
			code: 'CONFLICT',
			statusCode: 409,
		};
		if (context !== undefined) {
			Options.context = context;
		}
		super(message, Options);
	}
}
