import { Injectable, PipeTransform, ArgumentMetadata, BadRequestException, Logger } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';

/**
 * GraphQL Input Validation Pipe
 *
 * Specialized validation pipe for GraphQL input objects.
 * Validates nested objects, provides detailed field-level error messages,
 * and performs security checks for injection attempts.
 *
 * @example
 * ```typescript
 * @UsePipes(GraphqlInputValidationPipe)
 * @Mutation(() => User)
 * async updateUser(@Args('input') input: UpdateUserInput): Promise<User> {
 *   // Nested input validation with detailed errors
 * }
 * ```
 */
@Injectable()
export class GraphQLInputValidationPipe implements PipeTransform<any> {
	private readonly logger = new Logger(GraphQLInputValidationPipe.name);
	 
	private readonly MAX_INPUT_SIZE = 100_000;

	private readonly INJECTION_PATTERNS = [
		/['";\\-]{3,}/,  // Multiple special characters in a row
		/--\s*$/,         // SQL comment
		/[*;`]/,         // SQL wildcards or backticks
		/\/\*/,           // SQL comment start
		/xp_\w+/i,        // SQL Server extended procedures
		/<script/i,       // Script injection
		/javascript:/i,   // JavaScript protocol
		/onerror\s*=/i    // Event handler injection
	];

	/**
	 * Transforms and validates GraphQL input data
	 *
	 * @param value - The input value to validate
	 * @param metadata - Metadata about the argument
	 * @returns any - The validated and transformed value
	 */
	public async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
		const { metatype } = metadata;

		// Skip validation for primitive types and null/undefined
		if (!metatype || !this.shouldValidate(metatype) || value === null) {
			return value;
		}

		// Perform security checks before validation
		this.performSecurityChecks(value);

		// Transform plain object to class instance
		const object = plainToClass(metatype, value);

		// Validate with nested validation enabled
		const errors = await validate(object, {
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
			skipMissingProperties: false,
			stopAtFirstError: false
		});

		if (errors.length > 0) {
			const formattedErrors = this.formatDetailedErrors(errors);
			this.logger.warn(`Input validation failed: ${JSON.stringify(formattedErrors)}`);

			throw new BadRequestException({
				message: 'Input validation failed',
				code: 'VALIDATION_ERROR',
				errors: formattedErrors
			});
		}

		return object;
	}

	/**
	 * Performs security checks on input data to detect injection attempts
	 *
	 * @param value - The input value to check
	 * @throws BadRequestException if suspicious patterns detected
	 */
	private performSecurityChecks(value: any): void {
		// Check input size
		const inputSize = JSON.stringify(value).length;
		if (inputSize > this.MAX_INPUT_SIZE) {
			this.logger.warn(`Input size ${inputSize} exceeds maximum of ${this.MAX_INPUT_SIZE}`);
			throw new BadRequestException({
				message: 'Input data exceeds maximum size limit',
				code: 'INPUT_SIZE_EXCEEDED'
			});
		}

		// Recursively check string fields for injection patterns
		this.checkForInjectionPatterns(value);
	}

	/**
	 * Recursively checks object properties for injection patterns
	 *
	 * @param obj - The object to check
	 * @param path - The current path for logging
	 * @throws BadRequestException if injection pattern detected
	 */
	private checkForInjectionPatterns(obj: any, path = ''): void {
		if (typeof obj !== 'object' || obj === null) {
			if (typeof obj === 'string') {
				for (const pattern of this.INJECTION_PATTERNS) {
					if (pattern.test(obj)) {
						this.logger.warn(`Potential injection attack detected at ${path}`);
						throw new BadRequestException({
							message: 'Invalid characters or patterns detected in input',
							code: 'INJECTION_DETECTED'
						});
					}
				}
			}
			return;
		}

		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				const value = obj[key];
				const currentPath = path ? `${path}.${key}` : key;

				if (typeof value === 'string') {
					for (const pattern of this.INJECTION_PATTERNS) {
						if (pattern.test(value)) {
							this.logger.warn(`Potential injection attack detected at ${currentPath}`);
							throw new BadRequestException({
								message: 'Invalid characters or patterns detected in input',
								code: 'INJECTION_DETECTED'
							});
						}
					}
				}
				else if (typeof value === 'object' && value !== null) {
					this.checkForInjectionPatterns(value, currentPath);
				}
			}
		}
	}

	/**
	 * Determines if the metatype should be validated
	 *
	 * @param metatype - The type to check
	 * @returns boolean - True if validation should be performed
	 */
	private shouldValidate(metatype: any): boolean {
		const primitiveTypes = [String, Boolean, Number, Array, Object, Date];
		return !primitiveTypes.includes(metatype);
	}

	/**
	 * Formats validation errors with detailed field-level information
	 *
	 * @param errors - The validation errors
	 * @param parentPath - The parent path for nested errors
	 * @returns any[] - Detailed error objects
	 */
	private formatDetailedErrors(errors: ValidationError[], parentPath = ''): any[] {
		const formattedErrors: any[] = [];

		for (const error of errors) {
			const fieldPath = parentPath ? `${parentPath}.${error.property}` : error.property;

			// Add constraints for this field
			if (error.constraints) {
				formattedErrors.push({
					field: fieldPath,
					value: error.value,
					constraints: error.constraints
				});
			}

			// Handle nested validation errors
			if (error.children && error.children.length > 0) {
				const nestedErrors = this.formatDetailedErrors(error.children, fieldPath);
				formattedErrors.push(...nestedErrors);
			}
		}

		return formattedErrors;
	}
}
