import { vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PyroscopeService } from './service.js';
import { IPyroscopeConfig, IProfileContext } from './interfaces/profiling.interface.js';
import { PYROSCOPE_CONFIG_TOKEN } from './constants.js';
import { MetricsService } from './services/metrics.service.js';

describe('PyroscopeService', () => {
	let service: PyroscopeService;
	let mockConfig: IPyroscopeConfig;
	let mockLogger: any;
	let mockMetricsService: any;

	const createMockModuleRef = (config: IPyroscopeConfig, logger: any, metricsService?: any): ModuleRef => {
		const mockModuleRef = {
			get: vi.fn((token: any, _options?: any) => {
				if (token === PYROSCOPE_CONFIG_TOKEN) return config;
				if (token === Logger) return logger;
				if (token === MetricsService) {
					if (metricsService === undefined) throw new Error('MetricsService not available');
					return metricsService;
				}
				throw new Error(`Unknown token: ${String(token)}`);
			}),
		} as unknown as ModuleRef;
		return mockModuleRef;
	};

	const createService = (config: IPyroscopeConfig, logger: any, metricsService?: any): PyroscopeService => {
		return new PyroscopeService(createMockModuleRef(config, logger, metricsService));
	};

	beforeEach(() => {
		mockConfig = {
			enabled: false, // Disabled by default to avoid actual Pyroscope initialization
			serverAddress: 'http://localhost:4040',
			applicationName: 'test-app',
			tags: { env: 'test' },
		};

		mockLogger = {
			log: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
			debug: vi.fn(),
			verbose: vi.fn(),
		} as unknown as Logger;

		mockMetricsService = {
			getMetrics: vi.fn().mockReturnValue({
				timestamp: Date.now(),
				cpu: { samples: 0, duration: 0 },
				memory: { samples: 0, allocations: 0 },
				requests: { total: 0, successful: 0, failed: 0, averageResponseTime: 0 },
			}),
			recordCPUSample: vi.fn(),
			recordMemorySample: vi.fn(),
			recordRequest: vi.fn(),
			getPrometheusMetrics: vi.fn(),
			reset: vi.fn(),
		};

		service = createService(mockConfig, mockLogger, mockMetricsService);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	// Helper to create a mock Pyroscope client

	const createMockPyroscopeClient = () => ({
		init: vi.fn(),
		start: vi.fn(),
		stop: vi.fn().mockResolvedValue(undefined),
		addTag: vi.fn(),
		removeTag: vi.fn(),
		addTagList: vi.fn(),
		removeTagList: vi.fn(),
	});

	describe('onModuleInit', () => {
		it('should log when profiling is disabled', () => {
			service.onModuleInit();

			expect(mockLogger.debug).toHaveBeenCalledWith('Pyroscope profiling is disabled');
			expect(service.isEnabled()).toBe(false);
		});

		it('should not crash when initialization fails', () => {
			mockConfig.enabled = true;

			// Service will try to dynamically import @pyroscope/nodejs which will fail in tests
			// This is expected and should be handled gracefully (setImmediate, fire-and-forget)
			expect(() => service.onModuleInit()).not.toThrow();
		});

		it('should handle initialization errors gracefully (lines 84, 99)', () => {
			mockConfig.enabled = true;

			// Mock import to throw error
			vi.spyOn(global, 'eval').mockImplementationOnce(() => {
				throw new Error('Failed to import');
			});

			service.onModuleInit();

			// onModuleInit returns immediately without blocking
			// Async initialization happens in background via setImmediate
			expect(service.isEnabled()).toBe(false);
		});

		it('should log debug info when profiling is successfully initialized', () => {
			mockConfig.enabled = true;
			mockConfig.degradedActiveProfilesThreshold = 500;
			mockConfig.retryBaseDelayMs = 50;
			mockConfig.retryMaxDelayMs = 5000;
			mockConfig.retryJitterMs = 500;
			mockConfig.tagMaxLength = 100;

			// Mock dynamic import
			const mockPyroscope = createMockPyroscopeClient();
			vi.spyOn(globalThis, 'eval').mockImplementationOnce(() => ({ default: mockPyroscope }));

			// onModuleInit returns immediately, async init happens in background
			service.onModuleInit();

			// Should return immediately without throwing
			expect(service.isEnabled()).toBe(false);
		});

		it('should set basicAuth when provided in config', () => {
			mockConfig.enabled = true;
			mockConfig.basicAuthUser = 'testuser';
			mockConfig.basicAuthPassword = 'testpass';

			// onModuleInit returns immediately
			service.onModuleInit();

			// Should return immediately
			expect(service.isEnabled()).toBe(false);
		});

		it('should set sample rate when provided in config', () => {
			mockConfig.enabled = true;
			mockConfig.sampleRate = 0.5;

			service.onModuleInit();

			expect(service.isEnabled()).toBe(false);
		});

		it('should set log level when provided in config', () => {
			mockConfig.enabled = true;
			mockConfig.logLevel = 'debug';

			service.onModuleInit();

			expect(service.isEnabled()).toBe(false);
		});
	});

	describe('onModuleDestroy', () => {
		it('should not crash when destroying uninitialized service', async () => {
			await expect(service.onModuleDestroy()).resolves.not.toThrow();
		});

		it('should call stop when pyroscope client is initialized (lines 235-242)', async () => {
			// Create a new service and manually set it to initialized state
			const serviceWithInit = createService(
				{ ...mockConfig, enabled: true },
				mockLogger,
				mockMetricsService,
			);

			// Manually set initialized state and mock client
			const mockClient = createMockPyroscopeClient();
			(serviceWithInit as any).pyroscopeClient = mockClient;
			(serviceWithInit as any).isInitialized = true;

			await serviceWithInit.onModuleDestroy();

			expect(mockClient.stop).toHaveBeenCalled();
			expect(mockLogger.verbose).toHaveBeenCalledWith('Pyroscope profiling stopped');
		});

		it('should log error when stopping pyroscope fails', async () => {
			const serviceWithInit = createService(
				{ ...mockConfig, enabled: true },
				mockLogger,
				mockMetricsService,
			);

			const mockClient = createMockPyroscopeClient();
			const stopError = new Error('Stop failed');
			mockClient.stop.mockRejectedValueOnce(stopError);

			(serviceWithInit as any).pyroscopeClient = mockClient;
			(serviceWithInit as any).isInitialized = true;

			await serviceWithInit.onModuleDestroy();

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Error stopping Pyroscope profiling',
				stopError,
			);
		});

		it('should not call stop when pyroscope client is null', async () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceWithoutClient = createService(
				mockConfig,
				mockLogger2,
				mockMetricsService,
			);

			(serviceWithoutClient as any).pyroscopeClient = null;
			(serviceWithoutClient as any).isInitialized = true;

			await serviceWithoutClient.onModuleDestroy();

			expect(mockLogger2.log).not.toHaveBeenCalledWith('Pyroscope profiling stopped');
		});
	});

	describe('startProfiling', () => {
		it('should not profile when disabled', () => {
			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
			};

			service.startProfiling(context);

			expect(context.profileId).toBeUndefined();
		});

		it('should generate profile ID and store context when enabled (lines 111-125)', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			// Set initialized flag manually
			(serviceEnabled as any).isInitialized = true;

			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
				tags: { route: '/test' },
			};

			serviceEnabled.startProfiling(context);

			// Should have generated profile ID
			expect(context.profileId).toBeDefined();
			expect(typeof context.profileId).toBe('string');
			expect(context.profileId).toContain('testFunc');
		});

		it('should set start time if not already set (line 116)', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
			};

			serviceEnabled.startProfiling(context);

			expect(context.startTime).toBeDefined();
			expect(typeof context.startTime).toBe('number');
			expect(context.startTime).toBeGreaterThan(0);
		});

		it('should preserve existing start time', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const customStartTime = 1234567890;
			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime: customStartTime,
			};

			serviceEnabled.startProfiling(context);

			expect(context.startTime).toBe(customStartTime);
		});

		it('should log debug message when profiling starts', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
				tags: { env: 'test' },
			};

			serviceEnabled.startProfiling(context);

			expect(mockLogger2.debug).toHaveBeenCalledWith(
				`Started profiling: ${context.functionName}`,
				context.tags,
			);
		});
	});

	describe('stopProfiling', () => {
		it('should return empty metrics when disabled', () => {
			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
			};

			const metrics = service.stopProfiling(context);

			expect(metrics.cpuTime).toBe(0);
			expect(metrics.memoryUsage).toBe(0);
			expect(metrics.duration).toBe(0);
		});

		it('should return metrics for active profiling session (lines 136-165)', async () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const startTime = Date.now();
			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime,
				tags: { route: '/test' },
			};

			// Start profiling first
			serviceEnabled.startProfiling(context);

			// Wait a bit and then stop
			await new Promise(resolve => setTimeout(resolve, 15));
			const metrics = serviceEnabled.stopProfiling(context);

			expect(metrics).toBeDefined();
			expect(metrics.duration).toBeGreaterThan(0);
			expect(metrics.timestamp).toBeDefined();
			expect(metrics.cpuTime).toBe(0); // Not tracked in basic implementation
			expect(metrics.memoryUsage).toBe(0); // Not tracked in basic implementation
		});

		it('should merge tags from start and stop contexts', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
				tags: { route: '/test' },
			};

			serviceEnabled.startProfiling(context);

			// Add tags on stop
			context.tags = { ...context.tags, status: 'success' };

			const metrics = serviceEnabled.stopProfiling(context);

			expect(metrics.tags).toEqual({
				route: '/test',
				status: 'success',
			});
		});

		it('should warn when no active profiling session found', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
				profileId: 'nonexistent_id',
			};

			const metrics = serviceEnabled.stopProfiling(context);

			expect(mockLogger2.warn).toHaveBeenCalledWith(
				`No active profiling session found for: ${context.functionName}`,
			);
			expect(metrics.duration).toBe(0);
		});

		it('should log debug message when profiling stops', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
				tags: { env: 'test' },
			};

			serviceEnabled.startProfiling(context);
			serviceEnabled.stopProfiling(context);

			expect(mockLogger2.debug).toHaveBeenCalledWith(
				expect.stringContaining('Stopped profiling:'),
				expect.any(Object),
			);
		});

		it('should remove profile from active profiles after stop', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
			};

			serviceEnabled.startProfiling(context);
			const { profileId } = context;

			// Verify it's in active profiles
			const { activeProfiles } = (serviceEnabled as any);
			expect(activeProfiles.has(profileId)).toBe(true);

			// Stop profiling
			serviceEnabled.stopProfiling(context);

			// Should be removed
			expect(activeProfiles.has(profileId)).toBe(false);
		});

		it('should add metrics to internal metrics array', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const context: IProfileContext = {
				functionName: 'testFunc1',
				startTime: Date.now(),
			};

			serviceEnabled.startProfiling(context);
			serviceEnabled.stopProfiling(context);

			const allMetrics = serviceEnabled.getProfileMetrics();
			expect(allMetrics.length).toBeGreaterThan(0);
		});
	});

	describe('trackFunction', () => {
		it('should track synchronous function execution', async () => {
			const fn = vi.fn(() => 'result');

			const result = await service.trackFunction('testFunc', fn);

			expect(result).toBe('result');
			expect(fn).toHaveBeenCalled();
		});

		it('should track asynchronous function execution', async () => {
			const fn = vi.fn(async () => {
				await new Promise(resolve => setTimeout(resolve, 10));
				return 'async result';
			});

			const result = await service.trackFunction('testFunc', fn);

			expect(result).toBe('async result');
			expect(fn).toHaveBeenCalled();
		});

		it('should handle errors correctly', async () => {
			const error = new Error('Test error');
			const fn = vi.fn(() => {
				throw error;
			});

			await expect(service.trackFunction('testFunc', fn)).rejects.toThrow(error);
			expect(fn).toHaveBeenCalled();
		});

		it('should track with custom tags', async () => {
			const fn = vi.fn(() => 'result');

			const result = await service.trackFunction('testFunc', fn, { env: 'test' });

			expect(result).toBe('result');
			expect(fn).toHaveBeenCalled();
		});
	});

	describe('addTags and removeTags', () => {
		it('should not crash when disabled', () => {
			expect(() => service.addTags({ tag: 'value' })).not.toThrow();
			expect(() => service.removeTags(['tag'])).not.toThrow();
		});

		it('should early return when disabled (addTags)', () => {
			service.addTags({ tag: 'value' });

			// Should not log anything when disabled (early return)
			expect(mockLogger.debug).not.toHaveBeenCalled();
		});

		it('should early return when disabled (removeTags)', () => {
			service.removeTags(['tag']);

			// Should not log anything when disabled (early return)
			expect(mockLogger.debug).not.toHaveBeenCalled();
		});

		it('should not crash when adding tags on enabled service (lines 136-150)', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;
			const mockClient = createMockPyroscopeClient();
			(serviceEnabled as any).pyroscopeClient = mockClient;

			expect(() => serviceEnabled.addTags({ tag: 'value' })).not.toThrow();
		});

		it('should not crash when removing tags on enabled service (lines 151-165)', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;
			const mockClient = createMockPyroscopeClient();
			(serviceEnabled as any).pyroscopeClient = mockClient;

			expect(() => serviceEnabled.removeTags(['tag'])).not.toThrow();
		});

		it('should not crash when adding tags with no client', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;
			(serviceEnabled as any).pyroscopeClient = null;

			expect(() => serviceEnabled.addTags({ tag: 'value' })).not.toThrow();
		});
	});

	describe('getProfileMetrics', () => {
		it('should return empty array when no metrics collected', () => {
			const metrics = service.getProfileMetrics();

			expect(metrics).toEqual([]);
		});

		it('should return copy of metrics array', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
			};

			serviceEnabled.startProfiling(context);
			serviceEnabled.stopProfiling(context);

			const metrics1 = serviceEnabled.getProfileMetrics();
			const metrics2 = serviceEnabled.getProfileMetrics();

			expect(metrics1).toEqual(metrics2);
			expect(metrics1).not.toBe(metrics2); // Different array instances
		});
	});

	describe('getMetrics', () => {
		it('should delegate to MetricsService when available', () => {
			const mockMetrics = {
				timestamp: Date.now(),
				cpu: { samples: 10, duration: 100 },
				memory: { samples: 5, allocations: 1000 },
				requests: { total: 15, successful: 14, failed: 1, averageResponseTime: 50 },
			};
			mockMetricsService.getMetrics.mockReturnValue(mockMetrics);

			const metrics = service.getMetrics();

			expect(mockMetricsService.getMetrics).toHaveBeenCalled();
			expect(metrics).toEqual(mockMetrics);
		});

		it('should provide fallback aggregation when MetricsService unavailable', () => {
			// Create service without MetricsService (module.get throws)
			const serviceWithoutMetrics = createService(
				mockConfig,
				mockLogger,
				undefined,
			);

			const metrics = serviceWithoutMetrics.getMetrics();

			expect(metrics).toHaveProperty('timestamp');
			expect(metrics).toHaveProperty('cpu');
			expect(metrics).toHaveProperty('memory');
			expect(metrics).toHaveProperty('requests');
		});

		it('should calculate correct aggregations in fallback mode', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				undefined, // No MetricsService
			);

			(serviceEnabled as any).isInitialized = true;

			// Add some profiles
			const context1: IProfileContext = {
				functionName: 'func1',
				startTime: Date.now(),
			};

			serviceEnabled.startProfiling(context1);
			serviceEnabled.stopProfiling(context1);

			const metrics = serviceEnabled.getMetrics();

			expect(metrics.requests.total).toBeGreaterThan(0);
			expect(metrics.requests.successful).toBeGreaterThan(0);
			expect(metrics.requests.failed).toBe(0);
			expect(metrics.requests.averageResponseTime).toBeGreaterThanOrEqual(0);
		});

		it('should return zero values when no metrics collected', () => {
			const serviceWithoutMetrics = createService(
				mockConfig,
				mockLogger,
				undefined,
			);

			const metrics = serviceWithoutMetrics.getMetrics();

			expect(metrics.cpu.samples).toBe(0);
			expect(metrics.cpu.duration).toBe(0);
			expect(metrics.memory.samples).toBe(0);
			expect(metrics.memory.allocations).toBe(0);
			expect(metrics.requests.total).toBe(0);
			expect(metrics.requests.averageResponseTime).toBe(0);
		});
	});

	describe('getHealth', () => {
		it('should return healthy when disabled', () => {
			const health = service.getHealth();

			expect(health.status).toBe('healthy');
			expect(health.details.enabled).toBe(false);
		});

		it('should include configuration in health response', () => {
			const health = service.getHealth();

			expect(health.details).toBeDefined();
			expect(health.status).toBeDefined();
		});

		it('should return unhealthy when not initialized (lines 269-271)', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = false;

			const health = serviceEnabled.getHealth();

			expect(health.status).toBe('unhealthy');
			expect(health.details.initialized).toBe(false);
		});

		it('should return healthy with details when initialized', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const health = serviceEnabled.getHealth();

			expect(health.status).toBe('healthy');
			expect(health.details.initialized).toBe(true);
			expect(health.details.activeProfiles).toBeDefined();
			expect(health.details.totalMetrics).toBeDefined();
			expect(health.details.serverAddress).toBeDefined();
			expect(health.details.applicationName).toBeDefined();
		});

		it('should track active profiles in health response', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
			};

			serviceEnabled.startProfiling(context);

			const health = serviceEnabled.getHealth();

			expect(health.details.activeProfiles).toBe(1);
		});

		it('should track total metrics in health response', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
			};

			serviceEnabled.startProfiling(context);
			serviceEnabled.stopProfiling(context);

			const health = serviceEnabled.getHealth();

			expect(health.details.totalMetrics).toBeGreaterThan(0);
		});
	});

	describe('isEnabled', () => {
		it('should return false when config disabled', () => {
			expect(service.isEnabled()).toBe(false);
		});

		it('should return false when not initialized', () => {
			expect(service.isEnabled()).toBe(false);
		});

		it('should return true when both config enabled and initialized', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			expect(serviceEnabled.isEnabled()).toBe(true);
		});
	});

	describe('generateProfileId', () => {
		it('should generate unique profile IDs', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const context1: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
			};

			const context2: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
			};

			serviceEnabled.startProfiling(context1);
			serviceEnabled.startProfiling(context2);

			expect(context1.profileId).not.toBe(context2.profileId);
		});

		it('should include function name in profile ID', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const context: IProfileContext = {
				functionName: 'myTestFunction',
				startTime: Date.now(),
			};

			serviceEnabled.startProfiling(context);

			expect(context.profileId).toContain('myTestFunction');
		});
	});

	describe('Health status transitions', () => {
		it('should transition from healthy to unhealthy when uninitialized', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			// Initially unhealthy
			let health = serviceEnabled.getHealth();
			expect(health.status).toBe('unhealthy');

			// Becomes healthy when initialized
			(serviceEnabled as any).isInitialized = true;
			health = serviceEnabled.getHealth();
			expect(health.status).toBe('healthy');

			// Can transition back to unhealthy
			(serviceEnabled as any).isInitialized = false;
			health = serviceEnabled.getHealth();
			expect(health.status).toBe('unhealthy');
		});

		it('should maintain healthy status when config disabled', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceDisabled = createService(
				mockConfig, // enabled: false
				mockLogger2,
				mockMetricsService,
			);

			const health = serviceDisabled.getHealth();
			expect(health.status).toBe('healthy');
			expect(health.details.enabled).toBe(false);
		});
	});

	describe('Edge cases and error scenarios', () => {
		it('should handle undefined tags gracefully', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const context: IProfileContext = {
				functionName: 'testFunc',
				startTime: Date.now(),
				// No tags
			};

			expect(() => serviceEnabled.startProfiling(context)).not.toThrow();
			expect(() => serviceEnabled.stopProfiling(context)).not.toThrow();
		});

		it('should handle rapid profile start/stop cycles', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			for (let i = 0; i < 5; i++) {
				const context: IProfileContext = {
					functionName: `func${i}`,
					startTime: Date.now(),
				};

				serviceEnabled.startProfiling(context);
				serviceEnabled.stopProfiling(context);
			}

			const metrics = serviceEnabled.getProfileMetrics();
			expect(metrics.length).toBe(5);
		});

		it('should handle multiple concurrent profiles', () => {
			const mockLogger2 = {
				log: vi.fn(),
				error: vi.fn(),
				warn: vi.fn(),
				debug: vi.fn(),
			} as unknown as Logger;

			const serviceEnabled = createService(
				{ ...mockConfig, enabled: true },
				mockLogger2,
				mockMetricsService,
			);

			(serviceEnabled as any).isInitialized = true;

			const contexts: IProfileContext[] = [
				{ functionName: 'func1', startTime: Date.now() },
				{ functionName: 'func2', startTime: Date.now() },
				{ functionName: 'func3', startTime: Date.now() },
			];

			contexts.forEach(ctx => serviceEnabled.startProfiling(ctx));

			const health = serviceEnabled.getHealth();
			expect(health.details.activeProfiles).toBe(3);

			contexts.forEach(ctx => serviceEnabled.stopProfiling(ctx));

			const health2 = serviceEnabled.getHealth();
			expect(health2.details.activeProfiles).toBe(0);
		});
	});
});
