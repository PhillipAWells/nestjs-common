import { Injectable } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { BaseValidationPipe } from './base-validation.pipe.js';

/**
 * HTTP Validation Pipe
 *
 * Validates incoming HTTP request data using class-validator and transforms using class-transformer.
 * Extends BaseValidationPipe with HTTP-specific error formatting.
 *
 * @example
 * ```typescript
 * // In a controller
 * @UsePipes(ValidationPipe)
 * @Post()
 * async createUser(@Body() createUserDto: CreateUserDto): Promise<User> {
 *   // DTO will be validated automatically
 * }
 * ```
 */
@Injectable()
export class ValidationPipe extends BaseValidationPipe {
	/**
	 * Formats validation errors as string array for HTTP responses
	 *
	 * @param errors - The validation errors
	 * @returns string[] - Array of error messages
	 */
	/**
	 * Formats validation errors as string array for HTTP responses
	 *
	 * @param errors - The validation errors
	 * @returns string[] - Array of error messages
	 */
	protected formatValidationErrors(errors: ValidationError[]): string[] {
		const result: string[] = [];

		const processError = (error: ValidationError, parentPath: string = ''): void => {
			const currentPath = parentPath ? `${parentPath}.${error.property}` : error.property;

			// If error has constraints, add them to result
			if (error.constraints && Object.keys(error.constraints).length > 0) {
				const messages = Object.values(error.constraints).join(', ');
				result.push(`${currentPath}: ${messages}`);
			}

			// If error has children, recurse
			if (error.children && error.children.length > 0) {
				error.children.forEach(childError =>
					processError(childError, currentPath),
				);
			}

			// Skip fields with no constraints and no children — no message to add
			// (do not add empty entries like "email: ")
		};

		errors.forEach(error => processError(error));

		return result;
	}
}
