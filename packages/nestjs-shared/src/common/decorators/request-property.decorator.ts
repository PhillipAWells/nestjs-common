import { createParamDecorator, ExecutionContext, Logger } from '@nestjs/common';
import type { AppLogger } from '../services/logger.service.js';
import { ObjectGetPropertyByPath } from '@pawells/typescript-common';

// Logger instance for decorator warnings
// Note: We can't use AppLogger directly here since decorators don't have DI context
// Instead, we use a Logger instance from @nestjs/common
const logger = new Logger('RequestPropertyDecorator');
let appLogger: AppLogger | undefined;

/**
 * Options for the RequestProperty decorator
 */

export interface RequestPropertyOptions {
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
	appLogger = logger;
}

/**
 * Logs a warning message using AppLogger if available, falls back to NestJS Logger
 * This ensures observability capture when AppLogger is initialized
 * @param message - The message to log
 */
function logWarning(message: string): void {
	// Try to use AppLogger if available, otherwise use NestJS Logger
	if (appLogger) {
		appLogger.warn(message);
	} else {
		// Fallback to NestJS Logger when AppLogger is not yet initialized
		logger.warn(message);
	}
}

/**
 * Utility function to safely get nested properties using dot notation
 * @param obj - The object to extract from
 * @param path - Dot-notation path (e.g., 'user.profile.name')
 * @returns The extracted value or undefined if not found
 */
// Removed - using ObjectGetPropertyByPath directly from @pawells/typescript-common

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
 * getProfile(@RequestProperty('user') user: User) {}
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
 * getUser(@RequestProperty('user', { required: true }) user: User) {}
 */
export function RequestProperty<T = any>(
	path: string,
	options: RequestPropertyOptions = {},
): ParameterDecorator {
	return createParamDecorator(
		(_data: unknown, ctx: ExecutionContext): T => {
			const request = ctx.switchToHttp().getRequest();

			// Try primary path first
			let value = ObjectGetPropertyByPath(request, path);

			// Try fallback paths if primary path didn't work
			if (value === undefined && options.fallbackPaths) {
				for (const fallbackPath of options.fallbackPaths) {
					value = ObjectGetPropertyByPath(request, fallbackPath);
					if (value !== undefined) {
						if (options.logMissing) {
							logWarning(`RequestProperty: Primary path '${path}' not found, using fallback '${fallbackPath}'`);
						}
						break;
					}
				}
			}

			// Handle missing values
			if (value === undefined) {
				if (options.required) {
					throw new Error(`Required property '${path}' not found in HTTP request`);
				}
				if (options.logMissing) {
					logWarning(`RequestProperty: Property '${path}' not found, using default value`);
				}
				value = options.defaultValue;
			}

			// Apply transformation if provided
			if (options.transform && value !== undefined) {
				try {
					value = options.transform(value);
				} catch (error) {
					throw new Error(
						`RequestProperty transform failed for path '${path}': ${error instanceof Error ? error.message : String(error)}`,
						{ cause: error },
					);
				}
			}

			return value as T;
		},
	)();
}
