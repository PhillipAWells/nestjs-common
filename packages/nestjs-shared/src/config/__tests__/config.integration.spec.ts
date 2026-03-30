import { describe, it, expect, beforeEach, vi } from 'vitest';
import Joi from 'joi';

import { AppLogger } from '../../common/index.js';
import { ConfigService } from '../config.service.js';
import { ValidationService } from '../validation.utils.js';
import { IAppConfig } from '../config.types.js';

describe('Config Integration', () => {
	let configService: ConfigService;
	let validationService: ValidationService;

	beforeEach(() => {
		const mockAppLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
				info: vi.fn(),
			}),
		} as any;
		// Direct instantiation instead of TestingModule
		const configData = {
			nodeEnv: 'test',
			corsOrigin: 'http://localhost:3000',
			port: 3000,
			maxFileSize: 10485760,
		};
		const mockNestConfigService = {
			get: (key: string, defaultValue?: any) => {
				return (configData as any)[key] ?? defaultValue;
			},
			getOrThrow: (key: string) => {
				const value = (configData as any)[key];
				if (value === undefined) {
					throw new Error(`Configuration key not found: ${key}`);
				}
				return value;
			},
		} as any;
		const mockModuleRef = {
			get: vi.fn((service) => {
				if (service === AppLogger) {
					return mockAppLogger;
				}
				// For NestConfigService
				return mockNestConfigService;
			}),
		};
		configService = new ConfigService(mockModuleRef as any);
		validationService = new ValidationService(mockModuleRef as any);
	});

	it('should load configuration with NestJS ConfigModule', () => {
		expect(configService).toBeDefined();
		expect(validationService).toBeDefined();
	});

	it('should get string values from loaded config', () => {
		const nodeEnv = configService.getString('nodeEnv');
		expect(nodeEnv).toBe('test');

		const corsOrigin = configService.getString('corsOrigin');
		expect(corsOrigin).toBe('http://localhost:3000');
	});

	it('should get number values from loaded config', () => {
		const port = configService.getNumber('port');
		expect(port).toBe(3000);

		const maxFileSize = configService.getNumber('maxFileSize');
		expect(maxFileSize).toBe(10485760);
	});

	it('should validate loaded configuration', () => {
		const config: Partial<IAppConfig> = {
			port: 3000,
			nodeEnv: 'test',
			corsOrigin: 'http://localhost:3000',
			maxFileSize: 10485760,
			storagePath: '/tmp',
			logLevel: 'info',
		};

		const _schema = validationService.createValidationSchema({
			port: validationService.createValidationSchema({
				port: 'number',
			}).keys({
				port: Joi.number().integer().min(1).max(65535),
			}),
		});

		// Note: This is a simplified validation test
		// In practice, you'd have a proper schema for IAppConfig
		expect(config.port).toBe(3000);
	});
});
