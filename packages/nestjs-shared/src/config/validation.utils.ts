import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import Joi from 'joi';
import type { ConfigSchema, ValidationResult } from './config.types.js';
import { AppLogger } from '../common/index.js';
import { LazyModuleRefService } from '../common/utils/lazy-getter.types.js';

/**
 * Configuration Validation Service
 * Provides validation utilities with logging
 */
@Injectable()
export class ValidationService implements LazyModuleRefService {
	private _contextualLogger: AppLogger | undefined;

	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	private get logger(): AppLogger {
		if (!this._contextualLogger) {
			const baseLogger = this.Module.get(AppLogger, { strict: false });
			this._contextualLogger = baseLogger.createContextualLogger(ValidationService.name);
		}
		return this._contextualLogger;
	}

	/**
	 * Create a validation schema for environment variables
	 * @param schema Joi schema definition
	 * @returns Compiled Joi schema
	 */
	public createValidationSchema(schema: ConfigSchema): Joi.ObjectSchema {
		this.logger.debug('Creating validation schema');
		const joiSchema = Joi.object(schema);
		this.logger.debug('Validation schema created successfully');
		return joiSchema;
	}

	/**
	 * Validate configuration against a schema
	 * @param config Configuration object to validate
	 * @param schema Joi validation schema
	 * @returns Validation result
	 */
	public validateConfig(config: any, schema: Joi.ObjectSchema): ValidationResult {
		this.logger.debug('Starting configuration validation');
		const { error } = schema.validate(config, {
			allowUnknown: true,
			stripUnknown: false,
		});

		if (error) {
			this.logger.error(`Configuration validation failed with ${error.details.length} errors`);
			this.logger.debug(`Validation errors: ${error.details.map(detail => detail.message).join(', ')}`);
			return {
				isValid: false,
				errors: error.details.map(detail => detail.message),
			};
		}

		this.logger.info('Configuration validation passed');
		return {
			isValid: true,
		};
	}
}

/**
 * Create a validation schema for environment variables
 * @param schema Joi schema definition
 * @returns Compiled Joi schema
 */
export function CreateValidationSchema(schema: ConfigSchema): Joi.ObjectSchema {
	return Joi.object(schema);
}

/**
 * Validate configuration against a schema
 * @param config Configuration object to validate
 * @param schema Joi validation schema
 * @returns Validation result
 */
export function ValidateConfig(config: any, schema: Joi.ObjectSchema): ValidationResult {
	const { error } = schema.validate(config, {
		allowUnknown: true,
		stripUnknown: false,
	});

	if (error) {
		return {
			isValid: false,
			errors: error.details.map(detail => detail.message),
		};
	}

	return {
		isValid: true,
	};
}

/**
 * Create a string validation schema with common patterns
 * @param options Validation options
 * @returns Joi string schema
 */
export function CreateStringSchema(options: {
	min?: number;
	max?: number;
	required?: boolean;
	pattern?: RegExp;
	default?: string;
	description?: string;
} = {}): Joi.StringSchema {
	let schema = Joi.string();

	if (options.min !== undefined) {
		schema = schema.min(options.min);
	}

	if (options.max !== undefined) {
		schema = schema.max(options.max);
	}

	if (options.pattern) {
		schema = schema.pattern(options.pattern);
	}

	if (options.required) {
		schema = schema.required();
	}

	if (options.default !== undefined) {
		schema = schema.default(options.default);
	}

	if (options.description) {
		schema = schema.description(options.description);
	}

	return schema;
}

/**
 * Create a number validation schema with common patterns
 * @param options Validation options
 * @returns Joi number schema
 */
export function CreateNumberSchema(options: {
	min?: number;
	max?: number;
	integer?: boolean;
	required?: boolean;
	default?: number;
	description?: string;
} = {}): Joi.NumberSchema {
	let schema = Joi.number();

	if (options.integer) {
		schema = schema.integer();
	}

	if (options.min !== undefined) {
		schema = schema.min(options.min);
	}

	if (options.max !== undefined) {
		schema = schema.max(options.max);
	}

	if (options.required) {
		schema = schema.required();
	}

	if (options.default !== undefined) {
		schema = schema.default(options.default);
	}

	if (options.description) {
		schema = schema.description(options.description);
	}

	return schema;
}

/**
 * Create a boolean validation schema
 * @param options Validation options
 * @returns Joi boolean schema
 */
export function CreateBooleanSchema(options: {
	required?: boolean;
	default?: boolean;
	description?: string;
} = {}): Joi.BooleanSchema {
	let schema = Joi.boolean();

	if (options.required) {
		schema = schema.required();
	}

	if (options.default !== undefined) {
		schema = schema.default(options.default);
	}

	if (options.description) {
		schema = schema.description(options.description);
	}

	return schema;
}

/**
 * Create a URI validation schema
 * @param options Validation options
 * @returns Joi string schema with URI validation
 */
export function CreateUriSchema(options: {
	required?: boolean;
	default?: string;
	description?: string;
} = {}): Joi.StringSchema {
	let schema = Joi.string().uri();

	if (options.required) {
		schema = schema.required();
	}

	if (options.default !== undefined) {
		schema = schema.default(options.default);
	}

	if (options.description) {
		schema = schema.description(options.description);
	}

	return schema;
}

/**
 * Create validation schema for port numbers
 * @param defaultValue Default port value
 * @param description Field description
 * @returns Joi number schema for ports
 */
// eslint-disable-next-line no-magic-numbers
export function CreatePortSchema(defaultValue: number = 3000, description?: string): Joi.NumberSchema {
	return CreateNumberSchema({
		min: 1,
		max: 65535,
		integer: true,
		default: defaultValue,
		description: description ?? 'Port number',
	});
}

/**
 * Create validation schema for environment variables
 * @param allowedValues Array of allowed environment values
 * @param defaultValue Default environment value
 * @param description Field description
 * @returns Joi string schema for environment
 */
export function CreateEnvironmentSchema(
	allowedValues: string[] = ['development', 'production', 'test'],
	defaultValue: string = 'development',
	description?: string,
): Joi.StringSchema {
	return CreateStringSchema({
		required: false,
		default: defaultValue,
		description: description ?? 'Environment',
	}).valid(...allowedValues);
}

/**
 * Create validation schema for JWT expiration times
 * @param defaultValue Default expiration time
 * @param description Field description
 * @returns Joi string schema for JWT expiration
 */
export function CreateJwtExpirationSchema(
	defaultValue: string = '15m',
	description?: string,
): Joi.StringSchema {
	return CreateStringSchema({
		pattern: /^\d+[smhd]$/,
		default: defaultValue,
		description: description ?? 'JWT expiration time (e.g., 15m, 1h, 7d)',
	});
}
