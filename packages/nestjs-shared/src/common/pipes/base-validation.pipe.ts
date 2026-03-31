import {
	PipeTransform,
	Injectable,
	ArgumentMetadata,
	BadRequestException,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToClass, ClassTransformOptions } from 'class-transformer';

/**
 * Base Validation Pipe
 *
 * Abstract base class for validation pipes that provides core validation logic
 * while allowing subclasses to customize error formatting and validation options.
 *
 * @example
 * ```typescript
 * export class MyValidationPipe extends BaseValidationPipe {
 *   protected formatValidationErrors(errors: ValidationError[]): any {
 *     // Custom error formatting
 *     return errors.map(error => ({
 *       field: error.property,
 *       message: Object.values(error.constraints || {}).join(', ')
 *     }));
 *   }
 * }
 * ```
 */
@Injectable()
export abstract class BaseValidationPipe implements PipeTransform<any> {
	/**
	 * Transforms and validates input data
	 *
	 * @param value - The input value to validate
	 * @param metadata - Metadata about the argument
	 * @returns any - The validated and transformed value
	 */
	public async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
		const { metatype } = metadata;

		// Skip validation for primitive types
		if (!metatype || !this.ShouldValidate(metatype)) {
			return value;
		}

		// Transform plain object to class instance
		const Object = plainToClass(metatype, value, this.GetTransformOptions());

		// Validate the object
		const Errors = await validate(Object, this.GetValidationOptions());

		if (Errors.length > 0) {
			this.HandleValidationErrors(Errors);
			// If handleValidationErrors doesn't throw, format and throw
			throw new BadRequestException(this.FormatValidationErrors(Errors));
		}

		return Object;
	}

	/**
	 * Determines if the metatype should be validated
	 *
	 * @param metatype - The type to check
	 * @returns boolean - True if validation should be performed
	 */
	protected ShouldValidate(metatype: any): boolean {
		const Types = [String, Boolean, Number, Array, Object];
		return !Types.includes(metatype);
	}

	/**
	 * Gets validation options for class-validator
	 *
	 * @returns Validation options
	 */
	protected GetValidationOptions(): any {
		return {};
	}

	/**
	 * Gets transformation options for class-transformer
	 *
	 * @returns Transformation options
	 */
	protected GetTransformOptions(): ClassTransformOptions {
		return {};
	}

	/**
	 * Handles validation errors before formatting
	 *
	 * Subclasses can override this to add logging, metrics, etc.
	 *
	 * @param _errors - The validation errors (unused in base implementation)
	 */
	protected HandleValidationErrors(_errors: ValidationError[]): void {
		// Default: no-op, subclasses can add logging/metrics
	}

	/**
	 * Formats validation errors for the response
	 *
	 * @param errors - The validation errors
	 * @returns Formatted error response
	 */
	protected abstract FormatValidationErrors(errors: ValidationError[]): any;
}
