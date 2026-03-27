import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Base options for decorator factories
 */

export interface BaseDecoratorOptions {
	/**
	 * Transform function to apply to the extracted value
	 */
	transform?: (value: unknown) => unknown;

	/**
	 * Validation function to check the extracted value
	 */
	validate?: (value: unknown) => boolean;
}

/**
 * Options for conditional decorators (metadata-based)
 */
export interface ConditionalDecoratorOptions extends BaseDecoratorOptions {
	/**
	 * Metadata key to set
	 */
	key: string;

	/**
	 * Metadata value to set
	 */
	value: any;
}

/**
 * Options for validating decorators
 */
export interface ValidatingDecoratorOptions extends BaseDecoratorOptions {
	/**
	 * Whether to throw an error if validation fails
	 */
	throwOnInvalid?: boolean;

	/**
	 * Error message for validation failures
	 */
	errorMessage?: string;
}

/**
 * Options for transforming decorators
 */
export interface TransformingDecoratorOptions extends BaseDecoratorOptions {
	/**
	 * Whether to apply transformation even if value is undefined/null
	 */
	transformUndefined?: boolean;
}

/**
 * Gets the request object from HTTP execution context
 * @param ctx - The execution context
 * @returns The request object
 */
export function GetRequestFromContext(ctx: ExecutionContext): Request {
	return ctx.switchToHttp().getRequest<Request>();
}

/**
 * Base factory for creating parameter decorators that extend RequestProperty functionality
 * @param extractor - Function that extracts the value from request
 * @param options - Configuration options
 * @returns Parameter decorator function
 * @example
 * ```typescript
 * // With explicit type parameter
 * const MyDecorator = CreateRequestPropertyDecorator<string>(
 *   (req) => req.headers['x-custom-id'],
 *   { transform: (v) => (v as string).toUpperCase() }
 * );
 * ```
 */
export function CreateRequestPropertyDecorator<T = any>(
	extractor: (request: Request, ctx: ExecutionContext) => T,
	options: BaseDecoratorOptions = {},
): ParameterDecorator {
	return createParamDecorator(
		(_data: unknown, ctx: ExecutionContext): T => {
			const request = GetRequestFromContext(ctx);
			let value: unknown = extractor(request, ctx);

			// Apply validation if provided
			if (options.validate && !options.validate(value)) {
				throw new Error('Validation failed for extracted value');
			}

			// Apply transformation if provided
			if (options.transform) {
				value = options.transform(value);
			}

			return value as T;
		},
	)();
}

/**
 * Factory for creating conditional decorators that set metadata
 * @param options - Configuration options
 * @returns Method decorator function
 */
export function CreateConditionalDecorator(options: ConditionalDecoratorOptions): MethodDecorator {
	return SetMetadata(options.key, options.value);
}

/**
 * Factory for creating validating decorators
 * @param extractor - Function that extracts the value from request
 * @param options - Configuration options
 * @returns Parameter decorator function
 * @example
 * ```typescript
 * // With explicit type parameter
 * const ValidatedId = CreateValidatingDecorator<string>(
 *   (req) => req.params.id,
 *   { validate: (v) => typeof v === 'string' && v.length > 0 }
 * );
 * ```
 */
export function CreateValidatingDecorator<T = any>(
	extractor: (request: Request, ctx: ExecutionContext) => T,
	options: ValidatingDecoratorOptions = {},
): ParameterDecorator {
	return createParamDecorator(
		(_data: unknown, ctx: ExecutionContext): T => {
			const request = GetRequestFromContext(ctx);
			let value: unknown = extractor(request, ctx);

			// Apply validation if provided
			if (options.validate) {
				const isValid = options.validate(value);
				if (!isValid && options.throwOnInvalid) {
					throw new Error(options.errorMessage ?? 'Validation failed for extracted value');
				}
			}

			// Apply transformation if provided
			if (options.transform) {
				value = options.transform(value);
			}

			return value as T;
		},
	)();
}

/**
 * Factory for creating transforming decorators
 * @param extractor - Function that extracts the value from request
 * @param options - Configuration options
 * @returns Parameter decorator function
 * @example
 * ```typescript
 * // With explicit type parameter
 * const LowercaseQuery = CreateTransformingDecorator<string>(
 *   (req) => req.query.search as string,
 *   { transform: (v) => (v as string).toLowerCase() }
 * );
 * ```
 */
export function CreateTransformingDecorator<T = any>(
	extractor: (request: Request, ctx: ExecutionContext) => T,
	options: TransformingDecoratorOptions = {},
): ParameterDecorator {
	return createParamDecorator(
		(_data: unknown, ctx: ExecutionContext): T => {
			const request = GetRequestFromContext(ctx);
			let value: unknown = extractor(request, ctx);

			// Apply transformation if provided
			if (options.transform && (value !== undefined || options.transformUndefined)) {
				value = options.transform(value);
			}

			return value as T;
		},
	)();
}
