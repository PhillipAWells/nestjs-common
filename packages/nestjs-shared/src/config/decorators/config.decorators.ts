import { RequestProperty } from '../../common/index.js';

/**
 * Configuration Value decorator
 *
 * Extracts configuration values from the application config service.
 * The config service must be available in the request context.
 *
 * @param key - Configuration key to extract
 * @param defaultValue - Default value if key not found
 * @returns Parameter decorator
 *
 * @example
 * // Extract database URL
 * @Get('config')
 * getConfig(@ConfigValue('database.url') dbUrl: string) {}
 *
 * @example
 * // Extract with default
 * @Get('config')
 * getConfig(@ConfigValue('app.port', 3000) port: number) {}
 */
export function ConfigValue<T = any>(key: string, defaultValue?: T): any {
	return RequestProperty(`config.${key}`, {
		defaultValue,
		transform: (value: T) => value ?? defaultValue,
	});
}

/**
 * Environment Variable decorator
 *
 * Extracts environment variables from process.env.
 * Provides a convenient way to inject environment variables into parameters.
 *
 * @param key - Environment variable name
 * @param defaultValue - Default value if environment variable not set
 * @returns Parameter decorator
 *
 * @example
 * // Extract NODE_ENV
 * @Get('env')
 * getEnv(@EnvVar('NODE_ENV') nodeEnv: string) {}
 *
 * @example
 * // Extract with default
 * @Get('env')
 * getEnv(@EnvVar('PORT', '3000') port: string) {}
 */
export function EnvVar<T = string>(key: string, defaultValue?: T): any {
	return RequestProperty(`env.${key}`, {
		defaultValue,
		transform: (value: T) => {
			// Get from process.env
			const EnvValue = process.env[key];
			if (EnvValue !== undefined) {
				// Basic type conversion for common types
				if (typeof defaultValue === 'number') {
					return Number(EnvValue);
				}
				if (typeof defaultValue === 'boolean') {
					return EnvValue.toLowerCase() === 'true';
				}
				return EnvValue;
			}
			return value ?? defaultValue;
		},
	});
}
