import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '../config.service.js';
import { AppLogger } from '../../common/index.js';

describe('ConfigService', () => {
	let service: ConfigService;
	let mockModuleRef: any;
	let mockNestConfigService: any;

	beforeEach(() => {
		const configObject = {
			'test-key': 'test-value',
			port: 3000,
			nodeEnv: 'test',
		};

		mockNestConfigService = {
			get: (key: string, defaultValue?: any) => {
				return (configObject as any)[key] ?? defaultValue;
			},
			getOrThrow: (key: string) => {
				const Value = (configObject as any)[key];
				if (Value === undefined) {
					throw new Error(`Configuration key not found: ${key}`);
				}
				return Value;
			},
		} as any;

		const mockAppLogger = {
			CreateContextualLogger: () => ({
				Debug: () => {},
				debug: () => {},
				Warn: () => {},
				warn: () => {},
				Info: () => {},
				info: () => {},
				Error: () => {},
				error: () => {},
			}),
			createContextualLogger: () => ({
				Debug: () => {},
				debug: () => {},
				Warn: () => {},
				warn: () => {},
				Info: () => {},
				info: () => {},
				Error: () => {},
				error: () => {},
			}),
			Debug: () => {},
			debug: () => {},
			Warn: () => {},
			warn: () => {},
			Info: () => {},
			info: () => {},
			Error: () => {},
			error: () => {},
		} as any;

		mockModuleRef = {
			get: (token: any) => {
				if (token === NestConfigService) return mockNestConfigService;
				if (token === AppLogger) return mockAppLogger;
				return undefined;
			},
		};

		service = new ConfigService(mockModuleRef);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getString', () => {
		it('should return string value when key exists', () => {
			const Result = service.GetString('test-key');

			expect(Result).toBe('test-value');
		});

		it('should return default value when key does not exist', () => {
			const Result = service.GetString('non-existent', 'default-value');

			expect(Result).toBe('default-value');
		});
	});

	describe('getNumber', () => {
		it('should return number value when key exists', () => {
			const Result = service.GetNumber('port');

			expect(Result).toBe(3000);
		});

		it('should return default when key does not exist', () => {
			const Result = service.GetNumber('unknown-port', 5000);

			expect(Result).toBe(5000);
		});

		it('should return undefined for invalid number conversion', () => {
			const Result = service.GetNumber('test-key'); // 'test-value' is not a number

			expect(Result).toBeUndefined();
		});

		it('should handle zero as valid number', () => {
			const zeroNestConfig = { get: () => 0, getOrThrow: () => 0 };
			const zeroModuleRef = { get: (token: any) => (token === NestConfigService ? zeroNestConfig : mockModuleRef.get(token)) };
			const configService = new ConfigService(zeroModuleRef as any);

			const Result = configService.GetNumber('zero-value');

			expect(Result).toBe(0);
		});

		it('should handle negative numbers', () => {
			const negativeNestConfig = { get: () => -123, getOrThrow: () => -123 };
			const negativeModuleRef = { get: (token: any) => (token === NestConfigService ? negativeNestConfig : mockModuleRef.get(token)) };
			const configService = new ConfigService(negativeModuleRef as any);

			const Result = configService.GetNumber('negative-value');

			expect(Result).toBe(-123);
		});
	});

	describe('get', () => {
		it('should return value when key exists', () => {
			const Result = service.Get('test-key');

			expect(Result).toBe('test-value');
		});

		it('should return default when key does not exist', () => {
			const Result = service.Get('non-existent', 'default');

			expect(Result).toBe('default');
		});

		it('should return undefined when key does not exist and no default provided', () => {
			const Result = service.Get('non-existent');

			expect(Result).toBeUndefined();
		});
	});

	describe('getOrThrow', () => {
		it('should return value when key exists', () => {
			const Result = service.GetOrThrow('test-key');

			expect(Result).toBe('test-value');
		});

		it('should throw Error() when key does not exist', () => {
			expect(() => {
				service.GetOrThrow('non-existent');
			}).toThrow('Configuration key not found: non-existent');
		});
	});

	describe('validate', () => {
		it('should validate configuration with required fields present', () => {
			const schema = {
				'test-key': { required: true },
				port: { required: true },
			};

			expect(() => {
				service.Validate(schema);
			}).not.toThrow();
		});

		it('should throw Error() when required field is missing', () => {
			const schemaWithMissing = {
				'test-key': { required: true },
				'missing-field': { required: true },
			};

			expect(() => {
				service.Validate(schemaWithMissing);
			}).toThrow('Missing required configuration fields');
		});

		it('should handle optional fields correctly', () => {
			const schema = {
				'test-key': { required: true },
				'optional-field': { required: false },
			};

			expect(() => {
				service.Validate(schema);
			}).not.toThrow();
		});

		it('should handle schema with no required fields', () => {
			const schema = {
				'optional-1': { required: false },
				'optional-2': { required: false },
			};

			expect(() => {
				service.Validate(schema);
			}).not.toThrow();
		});

		it('should handle empty schema', () => {
			const schema = {};

			expect(() => {
				service.Validate(schema);
			}).not.toThrow();
		});
	});

	describe('Logger property', () => {
		it('should provide contextual logger on first access', () => {
			// Create a fresh service instance to test lazy logger initialization
			const mockAppLogger = {
				CreateContextualLogger: () => ({
					Debug: () => {},
					debug: () => {},
					Info: () => {},
					info: () => {},
					Error: () => {},
					error: () => {},
				}),
			} as any;

			const _localMockNestConfigService = {
				get: () => undefined,
				getOrThrow: () => {
					throw new Error('Not found');
				},
			} as any;

			const freshMockModuleRef = {
				get: (token: any) => {
					if (token === AppLogger) return mockAppLogger;
					return undefined;
				},
			} as unknown as ModuleRef;

			const freshService = new ConfigService(freshMockModuleRef);

			const { Logger } = freshService;

			expect(Logger).toBeDefined();
			expect(typeof Logger.Debug).toBe('function');
			expect(typeof Logger.debug).toBe('function');
			expect(typeof Logger.error).toBe('function');
		});

		it('should memoize logger on subsequent accesses', () => {
			const logger1 = service.Logger;
			const logger2 = service.Logger;

			expect(logger1).toBe(logger2);
		});
	});

	describe('getString edge cases', () => {
		it('should return undefined when value is undefined', () => {
			const Result = service.GetString('non-existent');

			expect(Result).toBeUndefined();
		});

		it('should convert numeric value to string', () => {
			const numericNestConfig = { get: () => 42, getOrThrow: () => 42 };
			const numericModuleRef = { get: (token: any) => (token === NestConfigService ? numericNestConfig : mockModuleRef.get(token)) };
			const configService = new ConfigService(numericModuleRef as any);

			const Result = configService.GetString('number-value');

			expect(Result).toBe('42');
		});

		it('should convert boolean to string', () => {
			const boolNestConfig = { get: () => true, getOrThrow: () => true };
			const boolModuleRef = { get: (token: any) => (token === NestConfigService ? boolNestConfig : mockModuleRef.get(token)) };
			const configService = new ConfigService(boolModuleRef as any);

			const Result = configService.GetString('boolean-value');

			expect(Result).toBe('true');
		});
	});
});
