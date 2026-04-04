
import { describe, it, expect } from 'vitest';
import Joi from 'joi';
import {
	CreateValidationSchema,
	ValidateConfig,
	CreateStringSchema,
	CreateNumberSchema,
	CreateBooleanSchema,
	CreateUriSchema,
	CreatePortSchema,
	CreateEnvironmentSchema,
	CreateJwtExpirationSchema,
} from '../validation.utils.js';

describe('Validation Utilities', () => {
	describe('createValidationSchema', () => {
		it('should create a Joi schema from config object', () => {
			const schemaConfig = {
				port: Joi.number().integer().min(1).max(65535),
				host: Joi.string().hostname(),
			};

			const result = CreateValidationSchema(schemaConfig);

			expect(result).toHaveProperty('validate');
		});
	});

	describe('validateConfig', () => {
		it('should return valid result for valid config', () => {
			const schema = Joi.object({
				port: Joi.number().integer().min(1).max(65535).required(),
				host: Joi.string().hostname().required(),
			});

			const validConfig = {
				port: 3000,
				host: 'localhost',
			};

			const result = ValidateConfig(validConfig, schema);

			expect(result.isValid).toBe(true);
			expect(result.errors).toBeUndefined();
		});

		it('should return invalid result for invalid config', () => {
			const schema = Joi.object({
				port: Joi.number().integer().min(1).max(65535).required(),
				host: Joi.string().hostname().required(),
			});

			const invalidConfig = {
				port: 'invalid',
				host: 123,
			};

			const result = ValidateConfig(invalidConfig, schema);

			expect(result.isValid).toBe(false);
			expect(result.errors).toBeDefined();
			expect(result.errors!.length).toBeGreaterThan(0);
		});
	});

	describe('createStringSchema', () => {
		it('should create string schema with min/max length', () => {
			const schema = CreateStringSchema({ min: 1, max: 10 });

			expect(schema).toHaveProperty('validate');
		});

		it('should create required string schema', () => {
			const schema = CreateStringSchema({ required: true });

			expect(schema).toHaveProperty('validate');
		});

		it('should create string schema with default value', () => {
			const schema = CreateStringSchema({ default: 'default-value' });

			expect(schema).toHaveProperty('validate');
		});

		it('should create string schema with pattern', () => {
			const schema = CreateStringSchema({ pattern: /^[a-z]+$/ });

			expect(schema).toHaveProperty('validate');
		});
	});

	describe('createNumberSchema', () => {
		it('should create number schema with min/max', () => {
			const schema = CreateNumberSchema({ min: 1, max: 100 });

			expect(schema).toHaveProperty('validate');
		});

		it('should create integer number schema', () => {
			const schema = CreateNumberSchema({ integer: true });

			expect(schema).toHaveProperty('validate');
		});

		it('should create number schema with default value', () => {
			const schema = CreateNumberSchema({ default: 42 });

			expect(schema).toHaveProperty('validate');
		});
	});

	describe('createBooleanSchema', () => {
		it('should create boolean schema', () => {
			const schema = CreateBooleanSchema();

			expect(schema).toHaveProperty('validate');
		});

		it('should create required boolean schema', () => {
			const schema = CreateBooleanSchema({ required: true });

			expect(schema).toHaveProperty('validate');
		});

		it('should create boolean schema with default value', () => {
			const schema = CreateBooleanSchema({ default: true });

			expect(schema).toHaveProperty('validate');
		});
	});

	describe('createUriSchema', () => {
		it('should create URI schema', () => {
			const schema = CreateUriSchema();

			expect(schema).toHaveProperty('validate');
		});

		it('should create required URI schema', () => {
			const schema = CreateUriSchema({ required: true });

			expect(schema).toHaveProperty('validate');
		});

		it('should create URI schema with default value', () => {
			const schema = CreateUriSchema({ default: 'http://example.com' });

			expect(schema).toHaveProperty('validate');
		});
	});

	describe('createPortSchema', () => {
		it('should create port schema with default 3000', () => {
			const schema = CreatePortSchema();

			expect(schema).toHaveProperty('validate');
		});

		it('should create port schema with custom default', () => {
			const schema = CreatePortSchema(8080);

			expect(schema).toHaveProperty('validate');
		});
	});

	describe('createEnvironmentSchema', () => {
		it('should create environment schema with default development', () => {
			const schema = CreateEnvironmentSchema();

			expect(schema).toHaveProperty('validate');
		});

		it('should create environment schema with custom allowed values', () => {
			const schema = CreateEnvironmentSchema(['prod', 'staging'], 'prod');

			expect(schema).toHaveProperty('validate');
		});
	});

	describe('createJwtExpirationSchema', () => {
		it('should create JWT expiration schema with default 15m', () => {
			const schema = CreateJwtExpirationSchema();

			expect(schema).toHaveProperty('validate');
		});

		it('should create JWT expiration schema with custom default', () => {
			const schema = CreateJwtExpirationSchema('1h');

			expect(schema).toHaveProperty('validate');
		});
	});
});
