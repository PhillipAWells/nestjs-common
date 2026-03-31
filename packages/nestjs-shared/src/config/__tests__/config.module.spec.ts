import { describe, it, expect, vi } from 'vitest';

import { AppLogger } from '../../common/index.js';
import { ConfigService } from '../config.service.js';
import { ValidationService } from '../validation.utils.js';

describe('ConfigModule', () => {
	it('should provide ConfigService', () => {
		const mockAppLogger = {
			CreateContextualLogger: vi.fn().mockReturnValue({
				Debug: vi.fn(),
				debug: vi.fn(),
				Warn: vi.fn(),
				warn: vi.fn(),
				Error: vi.fn(),
				error: vi.fn(),
				Info: vi.fn(),
				info: vi.fn(),
			}),
			createContextualLogger: vi.fn().mockReturnValue({
				Debug: vi.fn(),
				debug: vi.fn(),
				Warn: vi.fn(),
				warn: vi.fn(),
				Error: vi.fn(),
				error: vi.fn(),
				Info: vi.fn(),
				info: vi.fn(),
			}),
			Debug: vi.fn(),
			debug: vi.fn(),
			Warn: vi.fn(),
			warn: vi.fn(),
			Error: vi.fn(),
			error: vi.fn(),
			Info: vi.fn(),
			info: vi.fn(),
		} as any;
		const mockNestConfigService = {
			get: vi.fn(),
			getOrThrow: vi.fn(),
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
		const configService = new ConfigService(mockModuleRef as any);
		expect(configService).toBeDefined();
		expect(configService).toBeInstanceOf(ConfigService);
	});

	it('should provide ValidationService', () => {
		const mockAppLogger = {
			CreateContextualLogger: vi.fn().mockReturnValue({
				Debug: vi.fn(),
				debug: vi.fn(),
				Warn: vi.fn(),
				warn: vi.fn(),
				Error: vi.fn(),
				error: vi.fn(),
				Info: vi.fn(),
				info: vi.fn(),
			}),
			createContextualLogger: vi.fn().mockReturnValue({
				Debug: vi.fn(),
				debug: vi.fn(),
				Warn: vi.fn(),
				warn: vi.fn(),
				Error: vi.fn(),
				error: vi.fn(),
				Info: vi.fn(),
				info: vi.fn(),
			}),
			Debug: vi.fn(),
			debug: vi.fn(),
			Warn: vi.fn(),
			warn: vi.fn(),
			Error: vi.fn(),
			error: vi.fn(),
			Info: vi.fn(),
			info: vi.fn(),
		} as any;
		const mockModuleRef = { get: vi.fn().mockReturnValue(mockAppLogger) } as any;
		const validationService = new ValidationService(mockModuleRef);
		expect(validationService).toBeDefined();
		expect(validationService).toBeInstanceOf(ValidationService);
	});

	it('should export ConfigService', () => {
		const mockAppLogger = {
			CreateContextualLogger: vi.fn().mockReturnValue({
				Debug: vi.fn(),
				debug: vi.fn(),
				Warn: vi.fn(),
				warn: vi.fn(),
				Error: vi.fn(),
				error: vi.fn(),
				Info: vi.fn(),
				info: vi.fn(),
			}),
			createContextualLogger: vi.fn().mockReturnValue({
				Debug: vi.fn(),
				debug: vi.fn(),
				Warn: vi.fn(),
				warn: vi.fn(),
				Error: vi.fn(),
				error: vi.fn(),
				Info: vi.fn(),
				info: vi.fn(),
			}),
			Debug: vi.fn(),
			debug: vi.fn(),
			Warn: vi.fn(),
			warn: vi.fn(),
			Error: vi.fn(),
			error: vi.fn(),
			Info: vi.fn(),
			info: vi.fn(),
		} as any;
		const mockNestConfigService = {
			get: vi.fn(),
			getOrThrow: vi.fn(),
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
		const configService = new ConfigService(mockModuleRef as any);
		expect(configService).toBeDefined();
	});

	it('should export ValidationService', () => {
		const mockAppLogger = {
			CreateContextualLogger: vi.fn().mockReturnValue({
				Debug: vi.fn(),
				debug: vi.fn(),
				Warn: vi.fn(),
				warn: vi.fn(),
				Error: vi.fn(),
				error: vi.fn(),
				Info: vi.fn(),
				info: vi.fn(),
			}),
			createContextualLogger: vi.fn().mockReturnValue({
				Debug: vi.fn(),
				debug: vi.fn(),
				Warn: vi.fn(),
				warn: vi.fn(),
				Error: vi.fn(),
				error: vi.fn(),
				Info: vi.fn(),
				info: vi.fn(),
			}),
			Debug: vi.fn(),
			debug: vi.fn(),
			Warn: vi.fn(),
			warn: vi.fn(),
			Error: vi.fn(),
			error: vi.fn(),
			Info: vi.fn(),
			info: vi.fn(),
		} as any;
		const mockModuleRef = { get: vi.fn().mockReturnValue(mockAppLogger) } as any;
		const validationService = new ValidationService(mockModuleRef);
		expect(validationService).toBeDefined();
	});
});
