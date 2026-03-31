import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Base options for decorator factories
 */

export interface IBaseDecoratorOptions {
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
export interface IConditionalDecoratorOptions extends IBaseDecoratorOptions {
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
export interface IValidatingDecoratorOptions extends IBaseDecoratorOptions {
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
export interface ITransformingDecoratorOptions extends IBaseDecoratorOptions {
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
	options: IBaseDecoratorOptions = {},
): ParameterDecorator {
	return createParamDecorator(
		(_data: unknown, ctx: ExecutionContext): T => {
			const Request = GetRequestFromContext(ctx);
			let Value: unknown = extractor(Request, ctx);

			// Apply validation if provided
			if (options.validate && !options.validate(Value)) {
				throw new Error('Validation failed for extracted value');
			}

			// Apply transformation if provided
			if (options.transform) {
				Value = options.transform(Value);
			}

			return Value as T;
		},
	)();
}

/**
 * Factory for creating conditional decorators that set metadata
 * @param options - Configuration options
 * @returns Method decorator function
 */
export function CreateConditionalDecorator(options: IConditionalDecoratorOptions): MethodDecorator {
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
	options: IValidatingDecoratorOptions = {},
): ParameterDecorator {
	return createParamDecorator(
		(_data: unknown, ctx: ExecutionContext): T => {
			const Request = GetRequestFromContext(ctx);
			let Value: unknown = extractor(Request, ctx);

			// Apply validation if provided
			if (options.validate) {
				const IsValid = options.validate(Value);
				if (!IsValid && options.throwOnInvalid) {
					throw new Error(options.errorMessage ?? 'Validation failed for extracted value');
				}
			}

			// Apply transformation if provided
			if (options.transform) {
				Value = options.transform(Value);
			}

			return Value as T;
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
	options: ITransformingDecoratorOptions = {},
): ParameterDecorator {
	return createParamDecorator(
		(_data: unknown, ctx: ExecutionContext): T => {
			const Request = GetRequestFromContext(ctx);
			let Value: unknown = extractor(Request, ctx);

			// Apply transformation if provided
			if (options.transform && (Value !== undefined || options.transformUndefined)) {
				Value = options.transform(Value);
			}

			return Value as T;
		},
	)();
}
