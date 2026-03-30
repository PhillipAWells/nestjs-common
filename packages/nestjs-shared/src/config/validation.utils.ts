import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import Joi from 'joi';
import type { IConfigSchema, IValidationResult } from './config.types.js';
import { AppLogger } from '../common/index.js';
import { ILazyModuleRefService } from '../common/utils/lazy-getter.types.js';

/**
 * Configuration Validation Service
 * Provides validation utilities with logging
 */
@Injectable()
export class ValidationService implements ILazyModuleRefService {
	private _ContextualLogger: AppLogger | undefined;

	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	private get Logger(): AppLogger {
		if (!this._ContextualLogger) {
			const baseLogger = this.Module.get(AppLogger, { strict: false });
			this._ContextualLogger = baseLogger.createContextualLogger(ValidationService.name);
		}
		return this._ContextualLogger;
	}

	/**
	 * Create a validation schema for environment variables.
	 * @param schema - Joi schema definition object with validation rules
	 * @returns Compiled Joi ObjectSchema ready for validation
	 */
	public createValidationSchema(schema: IConfigSchema): Joi.ObjectSchema {
		this.Logger.debug('Creating validation schema');
		const joiSchema = Joi.object(schema);
		this.Logger.debug('Validation schema created successfully');
		return joiSchema;
	}

	/**
	 * Validate configuration against a schema.
	 * @param config - Configuration object to validate
	 * @param schema - Joi validation schema
	 * @returns IValidationResult with isValid flag and optional errors array
	 */
	public validateConfig(config: any, schema: Joi.ObjectSchema): IValidationResult {
		this.Logger.debug('Starting configuration validation');
		const { error } = schema.validate(config, {
			allowUnknown: true,
			stripUnknown: false,
		});

		if (error) {
			this.Logger.error(`Configuration validation failed with ${error.details.length} errors`);
			this.Logger.debug(`Validation errors: ${error.details.map(detail => detail.message).join(', ')}`);
			return {
				isValid: false,
				errors: error.details.map(detail => detail.message),
			};
		}

		this.Logger.info('Configuration validation passed');
		return {
			isValid: true,
		};
	}
}

/**
 * Create a validation schema for environment variables.
 * Utility function to compile a configuration object into a Joi validation schema.
 * @param schema - Joi schema definition object with validation rules
 * @returns Compiled Joi ObjectSchema ready for validation
 */
export function CreateValidationSchema(schema: IConfigSchema): Joi.ObjectSchema {
	return Joi.object(schema);
}

/**
 * Validate configuration against a schema.
 * Utility function to validate a configuration object using a Joi schema.
 * @param config - Configuration object to validate
 * @param schema - Joi validation schema
 * @returns IValidationResult with isValid flag and optional errors array
 */
export function ValidateConfig(config: any, schema: Joi.ObjectSchema): IValidationResult {
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
 * Create a string validation schema with common patterns.
 * Utility to build Joi string schemas with min/max length, pattern matching, and defaults.
 * @param options - String schema options
 * @param options.min - Minimum string length
 * @param options.max - Maximum string length
 * @param options.required - Whether the field is required
 * @param options.pattern - Regular expression pattern to match
 * @param options.default - Default value if not provided
 * @param options.description - Human-readable description
 * @returns Configured Joi StringSchema
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
 * Create a number validation schema with common patterns.
 * Utility to build Joi number schemas with min/max bounds, integer constraint, and defaults.
 * @param options - Number schema options
 * @param options.min - Minimum numeric value
 * @param options.max - Maximum numeric value
 * @param options.integer - Whether value must be an integer
 * @param options.required - Whether the field is required
 * @param options.default - Default value if not provided
 * @param options.description - Human-readable description
 * @returns Configured Joi NumberSchema
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
 * Create a boolean validation schema.
 * Utility to build Joi boolean schemas with required flag and defaults.
 * @param options - Boolean schema options
 * @param options.required - Whether the field is required
 * @param options.default - Default value if not provided
 * @param options.description - Human-readable description
 * @returns Configured Joi BooleanSchema
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
 * Create a URI validation schema.
 * Utility to build Joi string schemas that validate RFC 3986 URIs.
 * @param options - URI schema options
 * @param options.required - Whether the field is required
 * @param options.default - Default value if not provided
 * @param options.description - Human-readable description
 * @returns Configured Joi StringSchema with URI validation
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
 * Create validation schema for port numbers.
 * Utility to build Joi number schemas for TCP/UDP port validation (1-65535).
 * @param defaultValue - Default port number (default: 3000)
 * @param description - Human-readable description
 * @returns Configured Joi NumberSchema for port validation
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
 * Create validation schema for environment variables.
 * Utility to build Joi string schemas that restrict values to a whitelist of environments.
 * @param allowedValues - Array of allowed environment values (default: development, production, test)
 * @param defaultValue - Default environment value (default: development)
 * @param description - Human-readable description
 * @returns Configured Joi StringSchema with environment validation
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
 * Create validation schema for JWT expiration times.
 * Utility to build Joi string schemas that validate JWT expiration duration format (e.g., 15m, 1h, 7d).
 * @param defaultValue - Default expiration time (default: 15m)
 * @param description - Human-readable description
 * @returns Configured Joi StringSchema with JWT expiration validation
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
