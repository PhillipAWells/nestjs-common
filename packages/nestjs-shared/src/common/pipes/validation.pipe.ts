import { Injectable } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { BaseValidationPipe } from './base-validation.pipe.js';

/**
 * HTTP Validation Pipe.
 * Validates incoming HTTP request data using class-validator and transforms using class-transformer.
 * Extends BaseValidationPipe with HTTP-specific error formatting.
 *
 * @remarks
 * - Automatically applied as a global pipe in CommonModule
 * - Supports nested object validation with path prefixes
 * - Recursively processes validation errors with depth traversal
 * - Formats errors as string array for consistent HTTP responses
 *
 * @example
 * ```typescript
 * // Automatically applied globally; decorator is optional
 * @Post()
 * async createUser(@Body() createUserDto: CreateUserDto): Promise<IUser> {
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
	protected FormatValidationErrors(errors: ValidationError[]): string[] {
		const Result: string[] = [];

		const ProcessError = (error: ValidationError, parentPath: string = ''): void => {
			const CurrentPath = parentPath ? `${parentPath}.${error.property}` : error.property;

			// If error has constraints, add them to result
			if (error.constraints && Object.keys(error.constraints).length > 0) {
				const Messages = Object.values(error.constraints).join(', ');
				Result.push(`${CurrentPath}: ${Messages}`);
			}

			// If error has children, recurse
			if (error.children && error.children.length > 0) {
				error.children.forEach((childError: ValidationError) =>
					ProcessError(childError, CurrentPath),
				);
			}

			// Skip fields with no constraints and no children — no message to add
			// (do not add empty entries like "email: ")
		};

		errors.forEach(error => ProcessError(error));

		return Result;
	}
}
