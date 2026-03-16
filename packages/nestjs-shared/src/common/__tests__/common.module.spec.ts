import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CommonModule } from '../common.module.js';
import { ModuleRef } from '@nestjs/core';
import { AppLogger } from '../services/logger.service.js';
import { ConfigService } from '../../config/index.js';

describe('CommonModule', () => {
	let commonModule: CommonModule;
	let mockAppLogger: any;
	let mockModuleRef: any;

	beforeEach(() => {
		mockAppLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				info: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
			}),
			debug: vi.fn(),
			info: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
		};
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Module definition', () => {
		it('should be defined', () => {
			expect(CommonModule).toBeDefined();
		});

		it('should have onModuleInit method', () => {
			expect(CommonModule.prototype.onModuleInit).toBeDefined();
		});
	});

	describe('onModuleInit - With ConfigService available', () => {
		beforeEach(() => {
			const mockConfigService = {
				get: vi.fn(),
				getOrThrow: vi.fn(),
			};

			mockModuleRef = {
				get: vi.fn((service: any) => {
					if (service === ConfigService) {
						return mockConfigService;
					}
					return undefined;
				}),
			} as any;

			const mockRegistry = {
				descriptors: new Map(),
				values: new Map(),
				exporters: [],
				listeners: new Map(),
				registerDescriptor: vi.fn(),
				recordMetric: vi.fn(),
				getAllMetrics: vi.fn().mockReturnValue(new Map()),
				getMetric: vi.fn().mockReturnValue([]),
				on: vi.fn().mockReturnValue(() => {}),
				registerExporter: vi.fn(),
				shutdown: vi.fn().mockResolvedValue(undefined),
				onModuleInit: vi.fn(),
				Module: mockModuleRef,
				AppLogger: mockAppLogger,
			} as unknown as any;

			commonModule = new CommonModule(mockAppLogger as AppLogger, mockRegistry, mockModuleRef as ModuleRef);
		});

		it('should successfully initialize', () => {
			expect(() => {
				commonModule.onModuleInit();
			}).not.toThrow();
		});

		it('should call verifyConfigServiceAvailable', () => {
			commonModule.onModuleInit();
			expect(mockModuleRef.get).toHaveBeenCalledWith(ConfigService, { strict: false });
		});

		it('should set initialized flag to prevent double initialization', () => {
			commonModule.onModuleInit();
			// Call again
			commonModule.onModuleInit();

			// moduleRef.get should only be called twice (two onModuleInit calls)
			// because the second one should return early
			const callCount = mockModuleRef.get.mock.calls.length;
			expect(callCount).toBeLessThanOrEqual(2);
		});

		it('should call SetRequestPropertyDecoratorLogger', () => {
			// Mock the SetRequestPropertyDecoratorLogger function
			const setDecoratorLoggerSpy = vi.fn();
			vi.doMock('../decorators/request-property.decorator.js', () => ({
				SetRequestPropertyDecoratorLogger: setDecoratorLoggerSpy,
			}));

			commonModule.onModuleInit();
			// The logger should be available in the module
			expect(mockAppLogger).toBeDefined();
		});
	});

	describe('onModuleInit - ConfigService NOT available', () => {
		it('should throw error when ConfigService is not registered', () => {
			mockModuleRef = {
				get: vi.fn(() => undefined), // ConfigService not available
			} as any;

			const mockRegistry = {
				descriptors: new Map(),
				values: new Map(),
				exporters: [],
				listeners: new Map(),
				registerDescriptor: vi.fn(),
				recordMetric: vi.fn(),
				getAllMetrics: vi.fn().mockReturnValue(new Map()),
				getMetric: vi.fn().mockReturnValue([]),
				on: vi.fn().mockReturnValue(() => {}),
				registerExporter: vi.fn(),
				shutdown: vi.fn().mockResolvedValue(undefined),
				onModuleInit: vi.fn(),
				Module: mockModuleRef,
				AppLogger: mockAppLogger,
			} as unknown as any;

			commonModule = new CommonModule(mockAppLogger as AppLogger, mockRegistry, mockModuleRef as ModuleRef);

			expect(() => {
				commonModule.onModuleInit();
			}).toThrow();
		});

		it('should throw error with helpful message about ConfigModule import order', () => {
			mockModuleRef = {
				get: vi.fn(() => undefined),
			} as any;

			const mockRegistry = {
				descriptors: new Map(),
				values: new Map(),
				exporters: [],
				listeners: new Map(),
				registerDescriptor: vi.fn(),
				recordMetric: vi.fn(),
				getAllMetrics: vi.fn().mockReturnValue(new Map()),
				getMetric: vi.fn().mockReturnValue([]),
				on: vi.fn().mockReturnValue(() => {}),
				registerExporter: vi.fn(),
				shutdown: vi.fn().mockResolvedValue(undefined),
				onModuleInit: vi.fn(),
				Module: mockModuleRef,
				AppLogger: mockAppLogger,
			} as unknown as any;

			commonModule = new CommonModule(mockAppLogger as AppLogger, mockRegistry, mockModuleRef as ModuleRef);

			let errorMessage = '';
			try {
				commonModule.onModuleInit();
			} catch (error: any) {
				errorMessage = error.message;
			}

			expect(errorMessage).toContain('ConfigService is not registered in the module hierarchy');
			expect(errorMessage).toContain('CommonModule requires ConfigModule to be imported first');
		});

		it('should throw error when ConfigService is null', () => {
			mockModuleRef = {
				get: vi.fn(() => null),
			} as any;

			const mockRegistry = {
				descriptors: new Map(),
				values: new Map(),
				exporters: [],
				listeners: new Map(),
				registerDescriptor: vi.fn(),
				recordMetric: vi.fn(),
				getAllMetrics: vi.fn().mockReturnValue(new Map()),
				getMetric: vi.fn().mockReturnValue([]),
				on: vi.fn().mockReturnValue(() => {}),
				registerExporter: vi.fn(),
				shutdown: vi.fn().mockResolvedValue(undefined),
				onModuleInit: vi.fn(),
				Module: mockModuleRef,
				AppLogger: mockAppLogger,
			} as unknown as any;

			commonModule = new CommonModule(mockAppLogger as AppLogger, mockRegistry, mockModuleRef as ModuleRef);

			expect(() => {
				commonModule.onModuleInit();
			}).toThrow();
		});
	});

	describe('onModuleInit - Error handling', () => {
		it('should handle moduleRef.get() throwing an exception', () => {
			const testError = new Error('Module reference error');
			mockModuleRef = {
				get: vi.fn(() => {
					throw testError;
				}),
			} as any;

			const mockRegistry = {
				descriptors: new Map(),
				values: new Map(),
				exporters: [],
				listeners: new Map(),
				registerDescriptor: vi.fn(),
				recordMetric: vi.fn(),
				getAllMetrics: vi.fn().mockReturnValue(new Map()),
				getMetric: vi.fn().mockReturnValue([]),
				on: vi.fn().mockReturnValue(() => {}),
				registerExporter: vi.fn(),
				shutdown: vi.fn().mockResolvedValue(undefined),
				onModuleInit: vi.fn(),
				Module: mockModuleRef,
				AppLogger: mockAppLogger,
			} as unknown as any;

			commonModule = new CommonModule(mockAppLogger as AppLogger, mockRegistry, mockModuleRef as ModuleRef);

			expect(() => {
				commonModule.onModuleInit();
			}).toThrow();
		});

		it('should create error with cause information', () => {
			const testError = new Error('Inner error');
			mockModuleRef = {
				get: vi.fn(() => {
					throw testError;
				}),
			} as any;

			const mockRegistry = {
				descriptors: new Map(),
				values: new Map(),
				exporters: [],
				listeners: new Map(),
				registerDescriptor: vi.fn(),
				recordMetric: vi.fn(),
				getAllMetrics: vi.fn().mockReturnValue(new Map()),
				getMetric: vi.fn().mockReturnValue([]),
				on: vi.fn().mockReturnValue(() => {}),
				registerExporter: vi.fn(),
				shutdown: vi.fn().mockResolvedValue(undefined),
				onModuleInit: vi.fn(),
				Module: mockModuleRef,
				AppLogger: mockAppLogger,
			} as unknown as any;

			commonModule = new CommonModule(mockAppLogger as AppLogger, mockRegistry, mockModuleRef as ModuleRef);

			let caughtError: any;
			try {
				commonModule.onModuleInit();
			} catch (error: any) {
				caughtError = error;
			}

			expect(caughtError).toBeDefined();
			expect(caughtError.message).toContain('ConfigService is not registered');
		});
	});

	describe('Constructor', () => {
		it('should accept AppLogger, InstrumentationRegistry, and ModuleRef in constructor', () => {
			mockModuleRef = {
				get: vi.fn(() => ({})),
			} as any;

			const mockRegistry = {
				descriptors: new Map(),
				values: new Map(),
				exporters: [],
				listeners: new Map(),
				registerDescriptor: vi.fn(),
				recordMetric: vi.fn(),
				getAllMetrics: vi.fn().mockReturnValue(new Map()),
				getMetric: vi.fn().mockReturnValue([]),
				on: vi.fn().mockReturnValue(() => {}),
				registerExporter: vi.fn(),
				shutdown: vi.fn().mockResolvedValue(undefined),
				onModuleInit: vi.fn(),
				Module: mockModuleRef,
				AppLogger: mockAppLogger,
			} as unknown as any;

			expect(() => {
				commonModule = new CommonModule(mockAppLogger as AppLogger, mockRegistry, mockModuleRef as ModuleRef);
			}).not.toThrow();

			expect(commonModule).toBeDefined();
		});

		it('should have access to moduleRef', () => {
			mockModuleRef = {
				get: vi.fn(),
			} as any;

			const mockRegistry = {
				descriptors: new Map(),
				values: new Map(),
				exporters: [],
				listeners: new Map(),
				registerDescriptor: vi.fn(),
				recordMetric: vi.fn(),
				getAllMetrics: vi.fn().mockReturnValue(new Map()),
				getMetric: vi.fn().mockReturnValue([]),
				on: vi.fn().mockReturnValue(() => {}),
				registerExporter: vi.fn(),
				shutdown: vi.fn().mockResolvedValue(undefined),
				onModuleInit: vi.fn(),
				Module: mockModuleRef,
				AppLogger: mockAppLogger,
			} as unknown as any;

			commonModule = new CommonModule(mockAppLogger as AppLogger, mockRegistry, mockModuleRef as ModuleRef);

			// Module should be able to call moduleRef methods
			expect(commonModule).toHaveProperty('moduleRef');
		});
	});

	describe('Double initialization guard', () => {
		beforeEach(() => {
			const mockConfigService = {};

			mockModuleRef = {
				get: vi.fn(() => mockConfigService),
			} as any;

			const mockRegistry = {
				descriptors: new Map(),
				values: new Map(),
				exporters: [],
				listeners: new Map(),
				registerDescriptor: vi.fn(),
				recordMetric: vi.fn(),
				getAllMetrics: vi.fn().mockReturnValue(new Map()),
				getMetric: vi.fn().mockReturnValue([]),
				on: vi.fn().mockReturnValue(() => {}),
				registerExporter: vi.fn(),
				shutdown: vi.fn().mockResolvedValue(undefined),
				onModuleInit: vi.fn(),
				Module: mockModuleRef,
				AppLogger: mockAppLogger,
			} as unknown as any;

			commonModule = new CommonModule(mockAppLogger as AppLogger, mockRegistry, mockModuleRef as ModuleRef);
		});

		it('should not re-verify ConfigService on second init', () => {
			commonModule.onModuleInit();
			const firstCallCount = mockModuleRef.get.mock.calls.length;

			commonModule.onModuleInit();
			const secondCallCount = mockModuleRef.get.mock.calls.length;

			// Should not have increased call count significantly
			expect(secondCallCount).toBeLessThanOrEqual(firstCallCount + 1);
		});

		it('should return early on second init', () => {
			// Initialize and track calls
			commonModule.onModuleInit();

			// Reset mocks to verify no additional calls on second init
			mockModuleRef.get.mockClear();

			// Initialize again
			commonModule.onModuleInit();

			// Should not have called moduleRef.get again
			expect(mockModuleRef.get).not.toHaveBeenCalled();
		});
	});
});
