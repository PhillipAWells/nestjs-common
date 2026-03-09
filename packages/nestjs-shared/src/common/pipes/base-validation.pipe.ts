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
		if (!metatype || !this.shouldValidate(metatype)) {
			return value;
		}

		// Transform plain object to class instance
		const object = plainToClass(metatype, value, this.getTransformOptions());

		// Validate the object
		const errors = await validate(object, this.getValidationOptions());

		if (errors.length > 0) {
			this.handleValidationErrors(errors);
			// If handleValidationErrors doesn't throw, format and throw
			throw new BadRequestException(this.formatValidationErrors(errors));
		}

		return object;
	}

	/**
	 * Determines if the metatype should be validated
	 *
	 * @param metatype - The type to check
	 * @returns boolean - True if validation should be performed
	 */
	protected shouldValidate(metatype: any): boolean {
		const types = [String, Boolean, Number, Array, Object];
		return !types.includes(metatype);
	}

	/**
	 * Gets validation options for class-validator
	 *
	 * @returns Validation options
	 */
	protected getValidationOptions(): any {
		return {};
	}

	/**
	 * Gets transformation options for class-transformer
	 *
	 * @returns Transformation options
	 */
	protected getTransformOptions(): ClassTransformOptions {
		return {};
	}

	/**
	 * Handles validation errors before formatting
	 *
	 * Subclasses can override this to add logging, metrics, etc.
	 *
	 * @param _errors - The validation errors (unused in base implementation)
	 */
	protected handleValidationErrors(_errors: ValidationError[]): void {
		// Default: no-op, subclasses can add logging/metrics
	}

	/**
	 * Formats validation errors for the response
	 *
	 * @param errors - The validation errors
	 * @returns Formatted error response
	 */
	protected abstract formatValidationErrors(errors: ValidationError[]): any;
}
