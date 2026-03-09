import { Injectable, Logger } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { BaseValidationPipe } from '@pawells/nestjs-shared/common';

/**
 * GraphQL Validation Pipe
 *
 * Validates GraphQL input types using class-validator decorators.
 * Extends BaseValidationPipe with GraphQL-specific validation options and error formatting.
 *
 * @example
 * ```typescript
 * @UsePipes(GraphqlValidationPipe)
 * @Mutation(() => User)
 * async createUser(@Args('input') input: CreateUserInput): Promise<User> {
 *   // Input will be validated automatically
 * }
 * ```
 */
@Injectable()
export class GraphQLValidationPipe extends BaseValidationPipe {
	private readonly logger = new Logger(GraphQLValidationPipe.name);

	/**
	 * Gets validation options with GraphQL-specific settings
	 *
	 * @returns Validation options for class-validator
	 */
	protected override getValidationOptions(): any {
		return {
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true
		};
	}

	/**
	 * Handles validation errors by logging them
	 *
	 * @param errors - The validation errors
	 */
	protected override handleValidationErrors(errors: ValidationError[]): void {
		const formattedErrors = this.formatValidationErrors(errors);
		this.logger.warn(`Validation failed: ${JSON.stringify(formattedErrors)}`);
	}

	/**
	 * Formats validation errors for GraphQL responses
	 *
	 * @param errors - The validation errors
	 * @returns any - Structured error response
	 */
	protected override formatValidationErrors(errors: ValidationError[]): any {
		return {
			message: 'Validation failed',
			errors: errors.map(error => ({
				field: error.property,
				value: error.value,
				constraints: error.constraints,
				children: error.children?.length ? this.formatValidationErrors(error.children) : undefined
			}))
		};
	}
}
