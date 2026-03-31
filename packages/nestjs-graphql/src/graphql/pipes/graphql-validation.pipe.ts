import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ValidationError } from 'class-validator';
import { AppLogger, BaseValidationPipe } from '@pawells/nestjs-shared/common';
import type { IContextualLogger } from '@pawells/nestjs-shared/common';

/**
 * GraphQL Validation Pipe
 *
 * Validates GraphQL input types using class-validator decorators.
 * Extends BaseValidationPipe with GraphQL-specific validation options and error formatting.
 *
 * @example
 * ```typescript
 * @UsePipes(GraphqlValidationPipe)
 * @Mutation(() => IUser, { name: 'CreateUser' })
 * async createUser(@Args('input') input: CreateUserInput): Promise<IUser> {
 *   // Input will be validated automatically
 * }
 * ```
 */
@Injectable()
export class GraphQLValidationPipe extends BaseValidationPipe {
	// eslint-disable-next-line @typescript-eslint/prefer-readonly
	private ModuleRef?: ModuleRef;

	private get AppLogger(): AppLogger | undefined {
		return this.ModuleRef?.get(AppLogger, { strict: false });
	}

	private get Logger(): IContextualLogger | undefined {
		return this.AppLogger?.createContextualLogger(GraphQLValidationPipe.name);
	}

	constructor(moduleRef?: ModuleRef) {
		super();
		this.ModuleRef = moduleRef;
	}

	/**
	 * Gets validation options with GraphQL-specific settings
	 *
	 * @returns Validation options for class-validator
	 */
	protected override GetValidationOptions(): any {
		return {
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		};
	}

	/**
	 * Handles validation errors by logging them
	 *
	 * @param errors - The validation errors
	 */
	protected override HandleValidationErrors(errors: ValidationError[]): void {
		const FormattedErrors = this.FormatValidationErrors(errors);
		this.Logger?.warn(`Validation failed: ${JSON.stringify(FormattedErrors)}`);
	}

	/**
	 * Formats validation errors for GraphQL responses
	 *
	 * @param errors - The validation errors
	 * @returns any - Structured error response
	 */
	protected override FormatValidationErrors(errors: ValidationError[]): any {
		return {
			message: 'Validation failed',
			errors: errors.map(error => ({
				field: error.property,
				value: error.value,
				constraints: error.constraints,
				children: error.children?.length ? this.FormatValidationErrors(error.children) : undefined,
			})),
		};
	}
}
