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
				const value = (configObject as any)[key];
				if (value === undefined) {
					throw new Error(`Configuration key not found: ${key}`);
				}
				return value;
			},
		} as any;

		const mockAppLogger = {
			createContextualLogger: () => ({
				debug: () => {},
				warn: () => {},
				info: () => {},
				error: () => {},
			}),
		} as any;

		mockModuleRef = {
			get: (token: any) => {
				if (token === NestConfigService) return mockNestConfigService;
				if (token === AppLogger) return mockAppLogger;
				return undefined;
			},
		};

		service = new ConfigService(mockModuleRef, mockNestConfigService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getString', () => {
		it('should return string value when key exists', () => {
			const result = service.getString('test-key');

			expect(result).toBe('test-value');
		});

		it('should return default value when key does not exist', () => {
			const result = service.getString('non-existent', 'default-value');

			expect(result).toBe('default-value');
		});
	});

	describe('getNumber', () => {
		it('should return number value when key exists', () => {
			const result = service.getNumber('port');

			expect(result).toBe(3000);
		});

		it('should return default when key does not exist', () => {
			const result = service.getNumber('unknown-port', 5000);

			expect(result).toBe(5000);
		});

		it('should return undefined for invalid number conversion', () => {
			const result = service.getNumber('test-key'); // 'test-value' is not a number

			expect(result).toBeUndefined();
		});

		it('should handle zero as valid number', () => {
			const configService = new (ConfigService as any)(mockModuleRef, {
				get: () => 0,
				getOrThrow: () => 0,
			});

			const result = configService.getNumber('zero-value');

			expect(result).toBe(0);
		});

		it('should handle negative numbers', () => {
			const configService = new (ConfigService as any)(mockModuleRef, {
				get: () => -123,
				getOrThrow: () => -123,
			});

			const result = configService.getNumber('negative-value');

			expect(result).toBe(-123);
		});
	});

	describe('get', () => {
		it('should return value when key exists', () => {
			const result = service.get('test-key');

			expect(result).toBe('test-value');
		});

		it('should return default when key does not exist', () => {
			const result = service.get('non-existent', 'default');

			expect(result).toBe('default');
		});

		it('should return undefined when key does not exist and no default provided', () => {
			const result = service.get('non-existent');

			expect(result).toBeUndefined();
		});
	});

	describe('getOrThrow', () => {
		it('should return value when key exists', () => {
			const result = service.getOrThrow('test-key');

			expect(result).toBe('test-value');
		});

		it('should throw error when key does not exist', () => {
			expect(() => {
				service.getOrThrow('non-existent');
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
				service.validate(schema);
			}).not.toThrow();
		});

		it('should throw error when required field is missing', () => {
			const schemaWithMissing = {
				'test-key': { required: true },
				'missing-field': { required: true },
			};

			expect(() => {
				service.validate(schemaWithMissing);
			}).toThrow('Missing required configuration fields');
		});

		it('should handle optional fields correctly', () => {
			const schema = {
				'test-key': { required: true },
				'optional-field': { required: false },
			};

			expect(() => {
				service.validate(schema);
			}).not.toThrow();
		});

		it('should handle schema with no required fields', () => {
			const schema = {
				'optional-1': { required: false },
				'optional-2': { required: false },
			};

			expect(() => {
				service.validate(schema);
			}).not.toThrow();
		});

		it('should handle empty schema', () => {
			const schema = {};

			expect(() => {
				service.validate(schema);
			}).not.toThrow();
		});
	});

	describe('Logger property', () => {
		it('should provide contextual logger on first access', () => {
			// Create a fresh service instance to test lazy logger initialization
			const mockAppLogger = {
				createContextualLogger: () => ({
					debug: () => {},
					info: () => {},
					error: () => {},
				}),
			} as any;

			const localMockNestConfigService = {
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

			const freshService = new ConfigService(freshMockModuleRef, localMockNestConfigService);

			const logger = freshService.Logger;

			expect(logger).toBeDefined();
			expect(typeof logger.debug).toBe('function');
			expect(typeof logger.info).toBe('function');
			expect(typeof logger.error).toBe('function');
		});

		it('should memoize logger on subsequent accesses', () => {
			const logger1 = service.Logger;
			const logger2 = service.Logger;

			expect(logger1).toBe(logger2);
		});
	});

	describe('getString edge cases', () => {
		it('should return undefined when value is undefined', () => {
			const result = service.getString('non-existent');

			expect(result).toBeUndefined();
		});

		it('should convert numeric value to string', () => {
			const configService = new (ConfigService as any)(mockModuleRef, {
				get: () => 42,
				getOrThrow: () => 42,
			});

			const result = configService.getString('number-value');

			expect(result).toBe('42');
		});

		it('should convert boolean to string', () => {
			const configService = new (ConfigService as any)(mockModuleRef, {
				get: () => true,
				getOrThrow: () => true,
			});

			const result = configService.getString('boolean-value');

			expect(result).toBe('true');
		});
	});
});
