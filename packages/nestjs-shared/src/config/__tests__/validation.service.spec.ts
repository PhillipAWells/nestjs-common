
import Joi from 'joi';
import { ValidationService } from '../validation.utils.js';
import { AppLogger } from '../../common/index.js';

describe('ValidationService', () => {
	let service: ValidationService;
	let mockAppLogger: any;

	beforeEach(() => {
		mockAppLogger = {
			createContextualLogger: () => ({
				debug: () => {},
				error: () => {},
				info: () => {},
			}),
		} as any;

		const mockModuleRef = {
			get: (token: any) => {
				if (token === AppLogger) return mockAppLogger;
				throw new Error('not found');
			},
		} as any;

		service = new ValidationService(mockModuleRef);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('createValidationSchema', () => {
		it('should create a Joi schema from config object', () => {
			const schemaConfig = {
				port: Joi.number().integer().min(1).max(65535),
				host: Joi.string().hostname(),
			};

			const result = service.createValidationSchema(schemaConfig);

			expect(result).toBeDefined();
			expect(typeof result.validate).toBe('function');
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

			const result = service.validateConfig(validConfig, schema);

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

			const result = service.validateConfig(invalidConfig, schema);

			expect(result.isValid).toBe(false);
			expect(result.errors).toBeDefined();
			expect(result.errors!.length).toBeGreaterThan(0);
		});

		it('should return invalid result when required fields are missing', () => {
			const schema = Joi.object({
				port: Joi.number().integer().min(1).max(65535).required(),
				host: Joi.string().hostname().required(),
			});

			const incompleteConfig = {
				port: 3000,
				// missing required host field
			};

			const result = service.validateConfig(incompleteConfig, schema);

			expect(result.isValid).toBe(false);
			expect(result.errors).toBeDefined();
			expect(result.errors!.some(e => e.includes('host'))).toBe(true);
		});

		it('should return invalid result for invalid enum values', () => {
			const schema = Joi.object({
				environment: Joi.string().valid('development', 'production', 'staging').required(),
			});

			const invalidConfig = {
				environment: 'testing', // invalid enum value
			};

			const result = service.validateConfig(invalidConfig, schema);

			expect(result.isValid).toBe(false);
			expect(result.errors).toBeDefined();
		});

		it('should return invalid result for out-of-range numbers', () => {
			const schema = Joi.object({
				port: Joi.number().integer().min(1).max(65535).required(),
				timeout: Joi.number().integer().min(0).max(60000).required(),
			});

			const invalidConfig = {
				port: 99999, // exceeds max
				timeout: -100, // below min
			};

			const result = service.validateConfig(invalidConfig, schema);

			expect(result.isValid).toBe(false);
			expect(result.errors).toBeDefined();
			expect(result.errors!.length).toBeGreaterThan(0);
		});

		it('should return invalid result for malformed URIs', () => {
			const schema = Joi.object({
				databaseUrl: Joi.string().uri().required(),
				apiEndpoint: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
			});

			const invalidConfig = {
				databaseUrl: 'not-a-valid-uri',
				apiEndpoint: 'ftp://invalid-scheme.com',
			};

			const result = service.validateConfig(invalidConfig, schema);

			expect(result.isValid).toBe(false);
			expect(result.errors).toBeDefined();
		});

		it('should return invalid result for malformed URLs', () => {
			const schema = Joi.object({
				webhookUrl: Joi.string().uri({ scheme: ['https'] }).required(),
			});

			const invalidConfig = {
				webhookUrl: 'not-a-url',
			};

			const result = service.validateConfig(invalidConfig, schema);

			expect(result.isValid).toBe(false);
			expect(result.errors).toBeDefined();
		});
	});

	describe('edge cases and error scenarios', () => {
		it('should handle config with additional unknown properties', () => {
			const schema = Joi.object({
				port: Joi.number().integer().min(1).max(65535).required(),
			});

			const configWithExtra = {
				port: 3000,
				unknownField: 'should be ignored',
				anotherExtra: 123,
			};

			const result = service.validateConfig(configWithExtra, schema);

			expect(result.isValid).toBe(true);
		});

		it('should handle empty object validation', () => {
			const schema = Joi.object({});

			const result = service.validateConfig({}, schema);

			expect(result.isValid).toBe(true);
		});

		it('should allow missing values for optional fields', () => {
			const schema = Joi.object({
				port: Joi.number().optional(),
				host: Joi.string().optional(),
			});

			const config = {
				port: undefined,
				host: undefined,
			};

			const result = service.validateConfig(config, schema);

			expect(result.isValid).toBe(true);
		});

		it('should provide detailed error messages', () => {
			const schema = Joi.object({
				port: Joi.number().integer().min(1).max(65535).required(),
			});

			const invalidConfig = {
				port: 'invalid-port',
			};

			const result = service.validateConfig(invalidConfig, schema);

			expect(result.isValid).toBe(false);
			expect(result.errors).toBeDefined();
			expect(result.errors!.length).toBeGreaterThan(0);
			expect(result.errors![0]).toContain('port');
		});

		it('should handle deeply nested validation errors', () => {
			const schema = Joi.object({
				database: Joi.object({
					host: Joi.string().required(),
					port: Joi.number().required(),
				}).required(),
			});

			const invalidConfig = {
				database: {
					host: 123,
					port: 'invalid',
				},
			};

			const result = service.validateConfig(invalidConfig, schema);

			expect(result.isValid).toBe(false);
			expect(result.errors).toBeDefined();
		});
	});

	describe('logging behavior', () => {
		it('should create schema without errors', () => {
			const schemaConfig = {
				port: Joi.number().required(),
			};

			const result = service.createValidationSchema(schemaConfig);

			expect(result).toBeDefined();
			expect(typeof result.validate).toBe('function');
		});

		it('should validate with different configurations', () => {
			const schema = Joi.object({
				port: Joi.number().required(),
			});

			const validResult = service.validateConfig({ port: 3000 }, schema);
			const invalidResult = service.validateConfig({ port: 'invalid' }, schema);

			expect(validResult.isValid).toBe(true);
			expect(invalidResult.isValid).toBe(false);
		});

		it('should distinguish between valid and invalid configs', () => {
			const schema = Joi.object({
				port: Joi.number().required(),
			});

			const validConfig = { port: 3000 };
			const invalidConfig = { port: 'invalid' };

			const validResult = service.validateConfig(validConfig, schema);
			const invalidResult = service.validateConfig(invalidConfig, schema);

			expect(validResult.isValid).toBe(true);
			expect(invalidResult.isValid).toBe(false);
		});
	});

	describe('multiple error scenarios', () => {
		it('should collect all validation errors at once', () => {
			const schema = Joi.object({
				port: Joi.number().integer().min(1).max(65535).required(),
				host: Joi.string().hostname().required(),
				timeout: Joi.number().min(0).required(),
			});

			const invalidConfig = {
				port: 99999,
				host: 'not-a-valid-host!!!',
				timeout: -100,
			};

			const result = service.validateConfig(invalidConfig, schema);

			expect(result.isValid).toBe(false);
			expect(result.errors).toBeDefined();
			expect(result.errors!.length).toBeGreaterThan(0);
		});

		it('should handle missing required fields', () => {
			const schema = Joi.object({
				port: Joi.number().required(),
				host: Joi.string().required(),
				username: Joi.string().required(),
			});

			const incompleteConfig = {
				port: 3000,
			};

			const result = service.validateConfig(incompleteConfig, schema);

			expect(result.isValid).toBe(false);
			expect(result.errors).toBeDefined();
			expect(result.errors!.length).toBeGreaterThan(0);
		});
	});

	describe('special field types', () => {
		it('should validate array fields', () => {
			const schema = Joi.object({
				allowedHosts: Joi.array().items(Joi.string()).required(),
			});

			const validConfig = {
				allowedHosts: ['localhost', 'example.com'],
			};

			const result = service.validateConfig(validConfig, schema);

			expect(result.isValid).toBe(true);
		});

		it('should reject invalid array items', () => {
			const schema = Joi.object({
				allowedHosts: Joi.array().items(Joi.string()).required(),
			});

			const invalidConfig = {
				allowedHosts: ['localhost', 123, 'example.com'],
			};

			const result = service.validateConfig(invalidConfig, schema);

			expect(result.isValid).toBe(false);
		});

		it('should validate boolean fields correctly', () => {
			const schema = Joi.object({
				debug: Joi.boolean().required(),
				secure: Joi.boolean().required(),
			});

			const validConfig = {
				debug: true,
				secure: false,
			};

			const result = service.validateConfig(validConfig, schema);

			expect(result.isValid).toBe(true);
		});

		it('should reject non-boolean values for boolean fields', () => {
			const schema = Joi.object({
				debug: Joi.boolean().required(),
			});

			const invalidConfig = {
				debug: 1,
			};

			const result = service.validateConfig(invalidConfig, schema);

			expect(result.isValid).toBe(false);
		});
	});
});
