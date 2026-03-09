import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

class ConfigValidationError extends Error {
	constructor(message: string, public errors: string[]) {
		super(message);
		this.name = 'ConfigValidationError';
	}
}

@Injectable()
export class ConfigLoaderService {
	private readonly logger = new Logger(ConfigLoaderService.name);

	/**
    * Loads configuration from file with logging
    */
	// eslint-disable-next-line require-await
	public async loadFromFile(filePath: string): Promise<Record<string, any>> {
		this.logger.debug('Loading configuration from file', JSON.stringify({ filePath }));

		try {
			const absolutePath = path.resolve(filePath);
			const content = fs.readFileSync(absolutePath, 'utf-8');
			const config = JSON.parse(content);

			this.logger.log('Configuration file loaded successfully', JSON.stringify({
				filePath: absolutePath,
				keysCount: Object.keys(config).length,
			}));

			return config;
		} catch (error) {
			this.logger.error('Failed to load configuration file', JSON.stringify({
				filePath,
				error: error instanceof Error ? error.message : String(error),
			}));
			throw error;
		}
	}

	/**
    * Loads environment variables with logging
    */
	public loadFromEnvironment(): Record<string, string | undefined> {
		const envVars = { ...process.env };
		const configKeys = Object.keys(envVars).filter(key => key.startsWith('APP_') || key.startsWith('DB_') || key.startsWith('CACHE_') || key.startsWith('AUTH_'));

		this.logger.debug('Loading environment variables', JSON.stringify({
			totalEnvVars: Object.keys(envVars).length,
			configVars: configKeys.length,
		}));

		this.logger.log('Environment variables loaded', JSON.stringify({
			configVariablesCount: configKeys.length,
		}));

		return envVars;
	}

	/**
   * Validates configuration with logging
   */
	public validateConfiguration(config: Record<string, any>, schema: Record<string, any>): void {
		this.logger.debug('Starting configuration validation', JSON.stringify({
			configKeys: Object.keys(config).length,
			schemaKeys: Object.keys(schema).length,
		}));

		const errors: string[] = [];
		const requiredFields = Object.keys(schema).filter(key => schema[key].required);
		const optionalFields = Object.keys(schema).filter(key => !schema[key].required);

		// Check required fields
		for (const field of requiredFields) {
			if (!(field in config) || config[field] === undefined || config[field] === null) {
				errors.push(`${field} is required but missing`);
			}
		}

		// Check types and constraints
		for (const [field, value] of Object.entries(config)) {
			if (field in schema) {
				const fieldSchema = schema[field];
				if (fieldSchema.type && typeof value !== fieldSchema.type) {
					errors.push(`${field} must be of type ${fieldSchema.type}, got ${typeof value}`);
				}
				if (fieldSchema.minLength && typeof value === 'string' && value.length < fieldSchema.minLength) {
					errors.push(`${field} must be at least ${fieldSchema.minLength} characters long`);
				}
			}
		}

		if (errors.length > 0) {
			this.logger.error('Configuration validation failed', JSON.stringify({
				errors,
				requiredFields: requiredFields.length,
				optionalFields: optionalFields.length,
			}));
			throw new ConfigValidationError('Configuration validation failed', errors);
		}

		this.logger.log('Configuration validation successful', JSON.stringify({
			validatedFields: Object.keys(config).length,
			requiredFields: requiredFields.length,
			optionalFields: optionalFields.length,
		}));
	}

	/**
   * Applies default values with logging
   */
	public applyDefaults(config: Record<string, any>, defaults: Record<string, any>): Record<string, any> {
		const result = { ...config };
		let defaultsApplied = 0;

		for (const [key, defaultValue] of Object.entries(defaults)) {
			if (!(key in result) || result[key] === undefined) {
				result[key] = defaultValue;
				defaultsApplied++;
				this.logger.debug('Applied default value', JSON.stringify({ key, defaultValue }));
			}
		}

		if (defaultsApplied > 0) {
			this.logger.log('Default values applied', JSON.stringify({ defaultsApplied }));
		}

		return result;
	}

	/**
   * Logs configuration schema
   */
	public logConfigurationSchema(schema: Record<string, any>): void {
		const required = Object.keys(schema).filter(key => schema[key].required);
		const optional = Object.keys(schema).filter(key => !schema[key].required);

		this.logger.log('Configuration schema loaded', JSON.stringify({
			totalFields: Object.keys(schema).length,
			requiredFields: required.length,
			optionalFields: optional.length,
			requiredFieldNames: required,
		}));
	}

	/**
   * Logs final configuration summary (without sensitive data)
   */
	public logConfigurationSummary(config: Record<string, any>): void {
		const sanitized = { ...config };

		// Remove sensitive fields
		const sensitiveFields = ['password', 'secret', 'key', 'token', 'api_key', 'private_key'];
		for (const key of Object.keys(sanitized)) {
			if (sensitiveFields.some(sensitive => key.toLowerCase().includes(sensitive))) {
				sanitized[key] = '[REDACTED]';
			}
		}

		this.logger.log('Configuration loaded successfully', JSON.stringify({
			totalKeys: Object.keys(config).length,
			environment: process.env['NODE_ENV'] ?? 'development',
			config: sanitized,
		}));
	}
}
