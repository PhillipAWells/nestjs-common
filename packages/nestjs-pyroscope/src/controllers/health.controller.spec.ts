import { vi } from 'vitest';
import { ModuleRef } from '@nestjs/core';
import { HealthController } from './health.controller.js';
import { PyroscopeService } from '../service.js';
import { MetricsService } from '../services/metrics.service.js';
import { PYROSCOPE_CONFIG_TOKEN } from '../constants.js';
import { IPyroscopeConfig } from '../interfaces/profiling.interface.js';

describe('HealthController', () => {
	let controller: HealthController;
	let mockPyroscopeService: { getHealth: ReturnType<typeof vi.fn>; isEnabled: ReturnType<typeof vi.fn> };
	let mockMetricsService: { getMetrics: ReturnType<typeof vi.fn>; getPrometheusMetrics: ReturnType<typeof vi.fn> };
	let mockConfig: IPyroscopeConfig;

	beforeEach(() => {
		mockConfig = {
			enabled: true,
			serverAddress: 'http://localhost:4040',
			applicationName: 'test-app',
			degradedActiveProfilesThreshold: 100,
		};

		mockPyroscopeService = {
			getHealth: vi.fn(),
			isEnabled: vi.fn().mockReturnValue(true),
		} as any;

		mockMetricsService = {
			getMetrics: vi.fn(),
			getPrometheusMetrics: vi.fn(),
		} as any;

		const mockModuleRef = {
			get: vi.fn((token: any, _options?: any) => {
				if (token === PyroscopeService) return mockPyroscopeService;
				if (token === MetricsService) return mockMetricsService;
				if (token === PYROSCOPE_CONFIG_TOKEN) return mockConfig;
				throw new Error(`Unknown token: ${String(token)}`);
			}),
		} as unknown as ModuleRef;

		controller = new HealthController(mockModuleRef);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('getHealth', () => {
		it('should return healthy status when profiling is initialized', () => {
			mockPyroscopeService.getHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 10,
					totalMetrics: 100,
					serverAddress: 'http://localhost:4040',
					applicationName: 'test-app',
				},
			});

			mockMetricsService.getMetrics.mockReturnValue({
				timestamp: Date.now(),
				cpu: { samples: 10, duration: 100 },
				memory: { samples: 5, allocations: 1024 },
				requests: { total: 15, successful: 14, failed: 1, averageResponseTime: 50 },
			});

			const health = controller.getHealth();

			expect(health.status).toBe('healthy');
			expect(health.pyroscope.connected).toBe(true);
			expect(health.pyroscope.serverAddress).toBe('http://localhost:4040');
			expect(health.pyroscope.applicationName).toBe('test-app');
			expect(health.profiling.enabled).toBe(true);
			expect(health.profiling.activeProfiles).toBe(10);
			expect(health.profiling.totalProfiles).toBe(100);
		});

		it('should return unhealthy when enabled but not initialized', () => {
			mockPyroscopeService.getHealth.mockReturnValue({
				status: 'unhealthy',
				details: {
					enabled: true,
					initialized: false,
				},
			});

			mockMetricsService.getMetrics.mockReturnValue({
				timestamp: Date.now(),
				cpu: { samples: 0, duration: 0 },
				memory: { samples: 0, allocations: 0 },
				requests: { total: 0, successful: 0, failed: 0, averageResponseTime: 0 },
			});

			const health = controller.getHealth();

			expect(health.status).toBe('unhealthy');
			expect(health.pyroscope.connected).toBe(false);
		});

		it('should return degraded when too many active profiles', () => {
			mockPyroscopeService.getHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 150, // Over threshold
					totalMetrics: 1000,
				},
			});

			mockMetricsService.getMetrics.mockReturnValue({
				timestamp: Date.now(),
				cpu: { samples: 100, duration: 1000 },
				memory: { samples: 50, allocations: 10240 },
				requests: { total: 150, successful: 140, failed: 10, averageResponseTime: 50 },
			});

			const health = controller.getHealth();

			expect(health.status).toBe('degraded');
			expect(health.profiling.activeProfiles).toBe(150);
		});

		it('should include timestamp and uptime', () => {
			mockPyroscopeService.getHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 5,
					totalMetrics: 50,
				},
			});

			mockMetricsService.getMetrics.mockReturnValue({
				timestamp: Date.now(),
				cpu: { samples: 0, duration: 0 },
				memory: { samples: 0, allocations: 0 },
				requests: { total: 0, successful: 0, failed: 0, averageResponseTime: 0 },
			});

			const before = Date.now();
			const health = controller.getHealth();
			const after = Date.now();

			expect(health.timestamp).toBeGreaterThanOrEqual(before);
			expect(health.timestamp).toBeLessThanOrEqual(after);
			expect(health.uptime).toBeGreaterThan(0);
			expect(typeof health.uptime).toBe('number');
		});

		it('should handle missing server details gracefully', () => {
			mockPyroscopeService.getHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 0,
					totalMetrics: 0,
				},
			});

			mockMetricsService.getMetrics.mockReturnValue({
				timestamp: Date.now(),
				cpu: { samples: 0, duration: 0 },
				memory: { samples: 0, allocations: 0 },
				requests: { total: 0, successful: 0, failed: 0, averageResponseTime: 0 },
			});

			const health = controller.getHealth();

			expect(health.pyroscope.serverAddress).toBe('');
			expect(health.pyroscope.applicationName).toBe('');
		});

		it('should use metrics timestamp for last update', () => {
			const metricsTimestamp = Date.now();

			mockPyroscopeService.getHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 0,
					totalMetrics: 0,
				},
			});

			mockMetricsService.getMetrics.mockReturnValue({
				timestamp: metricsTimestamp,
				cpu: { samples: 0, duration: 0 },
				memory: { samples: 0, allocations: 0 },
				requests: { total: 0, successful: 0, failed: 0, averageResponseTime: 0 },
			});

			const health = controller.getHealth();

			expect(health.pyroscope.lastUpdate).toBe(metricsTimestamp);
		});
	});

	describe('getMetrics', () => {
		it('should return current metrics', () => {
			const mockMetrics = {
				timestamp: Date.now(),
				cpu: { samples: 10, duration: 100 },
				memory: { samples: 5, allocations: 1024 },
				requests: { total: 15, successful: 14, failed: 1, averageResponseTime: 50.5 },
			};

			mockMetricsService.getMetrics.mockReturnValue(mockMetrics);

			const metrics = controller.getMetrics();

			expect(metrics).toEqual(mockMetrics);
			expect(mockMetricsService.getMetrics).toHaveBeenCalled();
		});

		it('should return empty metrics when no data collected', () => {
			const mockMetrics = {
				timestamp: Date.now(),
				cpu: { samples: 0, duration: 0 },
				memory: { samples: 0, allocations: 0 },
				requests: { total: 0, successful: 0, failed: 0, averageResponseTime: 0 },
			};

			mockMetricsService.getMetrics.mockReturnValue(mockMetrics);

			const metrics = controller.getMetrics();

			expect(metrics.cpu.samples).toBe(0);
			expect(metrics.memory.samples).toBe(0);
			expect(metrics.requests.total).toBe(0);
		});
	});

	describe('getStatus', () => {
		it('should return combined health and metrics', () => {
			const mockMetrics = {
				timestamp: Date.now(),
				cpu: { samples: 10, duration: 100 },
				memory: { samples: 5, allocations: 1024 },
				requests: { total: 15, successful: 14, failed: 1, averageResponseTime: 50 },
			};

			mockPyroscopeService.getHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 10,
					totalMetrics: 100,
					serverAddress: 'http://localhost:4040',
					applicationName: 'test-app',
				},
			});

			mockMetricsService.getMetrics.mockReturnValue(mockMetrics);

			const status = controller.getStatus();

			expect(status).toHaveProperty('health');
			expect(status).toHaveProperty('metrics');
			expect(status.health.status).toBe('healthy');
			expect(status.metrics).toEqual(mockMetrics);
		});

		it('should reflect degraded health in combined status', () => {
			mockPyroscopeService.getHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 150,
					totalMetrics: 1000,
				},
			});

			mockMetricsService.getMetrics.mockReturnValue({
				timestamp: Date.now(),
				cpu: { samples: 0, duration: 0 },
				memory: { samples: 0, allocations: 0 },
				requests: { total: 0, successful: 0, failed: 0, averageResponseTime: 0 },
			});

			const status = controller.getStatus();

			expect(status.health.status).toBe('degraded');
		});

		it('should include complete health and metrics data', () => {
			mockPyroscopeService.getHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 5,
					totalMetrics: 50,
					serverAddress: 'http://pyroscope.example.com',
					applicationName: 'prod-app',
				},
			});

			mockMetricsService.getMetrics.mockReturnValue({
				timestamp: Date.now(),
				cpu: { samples: 25, duration: 250 },
				memory: { samples: 12, allocations: 2048 },
				requests: { total: 30, successful: 28, failed: 2, averageResponseTime: 75.25 },
			});

			const status = controller.getStatus();

			expect(status.health.pyroscope.serverAddress).toBe('http://pyroscope.example.com');
			expect(status.health.pyroscope.applicationName).toBe('prod-app');
			expect(status.health.profiling.activeProfiles).toBe(5);
			expect(status.metrics.cpu.samples).toBe(25);
			expect(status.metrics.memory.allocations).toBe(2048);
			expect(status.metrics.requests.total).toBe(30);
		});
	});

	describe('getPrometheusMetrics', () => {
		it('should return metrics in Prometheus format', () => {
			const prometheusOutput = `# HELP profiling_cpu_samples_total Total CPU samples
# TYPE profiling_cpu_samples_total counter
profiling_cpu_samples_total 10`;

			mockMetricsService.getPrometheusMetrics.mockReturnValue(prometheusOutput);

			const result = controller.getPrometheusMetrics();

			expect(result).toBe(prometheusOutput);
			expect(mockMetricsService.getPrometheusMetrics).toHaveBeenCalled();
		});

		it('should return empty metrics in Prometheus format', () => {
			const prometheusOutput = `# HELP profiling_cpu_samples_total Total CPU samples
# TYPE profiling_cpu_samples_total counter
profiling_cpu_samples_total 0`;

			mockMetricsService.getPrometheusMetrics.mockReturnValue(prometheusOutput);

			const result = controller.getPrometheusMetrics();

			expect(result).toContain('profiling_cpu_samples_total 0');
		});

		it('should return string format for Prometheus scraping', () => {
			mockMetricsService.getPrometheusMetrics.mockReturnValue('metrics_output');

			const result = controller.getPrometheusMetrics();

			expect(typeof result).toBe('string');
		});
	});

	describe('threshold boundary conditions', () => {
		it('should handle activeProfiles exactly at threshold', () => {
			mockPyroscopeService.getHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 100,
					totalMetrics: 1000,
				},
			});

			mockMetricsService.getMetrics.mockReturnValue({
				timestamp: Date.now(),
				cpu: { samples: 0, duration: 0 },
				memory: { samples: 0, allocations: 0 },
				requests: { total: 0, successful: 0, failed: 0, averageResponseTime: 0 },
			});

			const health = controller.getHealth();

			expect(health.status).toBe('healthy'); // At threshold, not over
		});

		it('should handle activeProfiles just over threshold', () => {
			mockPyroscopeService.getHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 101,
					totalMetrics: 1000,
				},
			});

			mockMetricsService.getMetrics.mockReturnValue({
				timestamp: Date.now(),
				cpu: { samples: 0, duration: 0 },
				memory: { samples: 0, allocations: 0 },
				requests: { total: 0, successful: 0, failed: 0, averageResponseTime: 0 },
			});

			const health = controller.getHealth();

			expect(health.status).toBe('degraded');
		});

		it('should use default threshold when config value is undefined', () => {
			mockConfig.degradedActiveProfilesThreshold = undefined;

			mockPyroscopeService.getHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 50,
					totalMetrics: 500,
				},
			});

			mockMetricsService.getMetrics.mockReturnValue({
				timestamp: Date.now(),
				cpu: { samples: 0, duration: 0 },
				memory: { samples: 0, allocations: 0 },
				requests: { total: 0, successful: 0, failed: 0, averageResponseTime: 0 },
			});

			const health = controller.getHealth();

			expect(health.status).toBe('healthy');
		});
	});
});
