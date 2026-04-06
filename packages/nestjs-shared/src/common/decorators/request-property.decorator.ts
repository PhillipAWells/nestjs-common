import { createParamDecorator, ExecutionContext, Logger } from '@nestjs/common';
import type { AppLogger } from '../services/logger.service.js';
import { ObjectGetPropertyByPath } from '@pawells/typescript-common';
import { GetErrorMessage } from '../utils/error.utils.js';

// Logger instance for decorator warnings
// Note: We can't use AppLogger directly here since decorators don't have DI context
// Instead, we use a Logger instance from @nestjs/common
const _LoggerInstance = new Logger('RequestPropertyDecorator');
let AppLoggerInstance: AppLogger | undefined;

/**
 * Options for the RequestProperty decorator
 */

export interface IRequestPropertyOptions {
	/**
    * Default value to return if the property is not found
    */
	defaultValue?: any;

	/**
    * Whether to throw an error if the property is not found (overrides defaultValue)
    */
	required?: boolean;

	/**
    * Transform function to apply to the extracted value
    */
	transform?: (value: any) => any;

	/**
    * Fallback paths to try if the primary path is not found
    */
	fallbackPaths?: string[];

	/**
    * Whether to log missing properties (for debugging)
    */
	logMissing?: boolean;
}

/**
 * Sets the AppLogger instance for use in the decorator
 * This should be called during module initialization
 * @param logger - The AppLogger instance
 * @internal
 */
export function SetRequestPropertyDecoratorLogger(logger: AppLogger): void {
	AppLoggerInstance = logger;
}

/**
 * Logs a warning message using AppLogger if available, falls back to NestJS Logger
 * This ensures observability capture when AppLogger is initialized
 * @param message - The message to log
 */
function LogWarning(message: string): void {
	// Try to use AppLogger if available, otherwise use NestJS Logger
	if (AppLoggerInstance) {
		AppLoggerInstance.warn(message);
	} else {
		// Fallback to NestJS Logger when AppLogger is not yet initialized
		Logger.warn(message);
	}
}

/**
 * Generic Request Property Decorator Factory
 *
 * Extracts any property from the HTTP request object using dot notation paths.
 * Supports nested property access, type safety, and transformations.
 *
 * @param path - Dot-notation path to the property (e.g., 'user', 'query.id', 'body.data.name')
 * @param options - Configuration options
 * @returns Parameter decorator function
 *
 * @example
 * // Extract user from request
 * @Get()
 * getProfile(@RequestProperty('user') user: IUser) {}
 *
 * @example
 * // Extract nested property with default
 * @Get()
 * getData(@RequestProperty('query.limit', { defaultValue: 10 }) limit: number) {}
 *
 * @example
 * // Extract with transformation
 * @Post()
 * createItem(@RequestProperty('body', { transform: (data) => validateData(data) }) data: ValidatedData) {}
 *
 * @example
 * // Required property (throws if missing)
 * @Get()
 * getUser(@RequestProperty('user', { required: true }) user: IUser) {}
 */
export function RequestProperty<T = any>(
	path: string,
	options: IRequestPropertyOptions = {},
): ParameterDecorator {
	return createParamDecorator(
		(_data: unknown, ctx: ExecutionContext): T => {
			const Request = ctx.switchToHttp().getRequest();

			// Try primary path first
			let Value = ObjectGetPropertyByPath(Request, path);

			// Try fallback paths if primary path didn't work
			if (Value === undefined && options.fallbackPaths) {
				for (const FallbackPath of options.fallbackPaths) {
					Value = ObjectGetPropertyByPath(Request, FallbackPath);
					if (Value !== undefined) {
						if (options.logMissing) {
							LogWarning(`RequestProperty: Primary path '${path}' not found, using fallback '${FallbackPath}'`);
						}
						break;
					}
				}
			}

			// Handle missing values
			if (Value === undefined) {
				if (options.required) {
					throw new Error(`Required property '${path}' not found in HTTP request`);
				}
				if (options.logMissing) {
					LogWarning(`RequestProperty: Property '${path}' not found, using default value`);
				}
				Value = options.defaultValue;
			}

			// Apply transformation if provided
			if (options.transform && Value !== undefined) {
				try {
					Value = options.transform(Value);
				} catch (error) {
					throw new Error(
						`RequestProperty transform failed for path '${path}': ${GetErrorMessage(error)}`,
						{ cause: error },
					);
				}
			}

			return Value as T;
		},
	)();
}
