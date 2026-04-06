import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModuleRef } from '@nestjs/core';
import { ProfilingHealthIndicator } from '../profiling.health.js';
import { PyroscopeService } from '../../service.js';
import { PYROSCOPE_CONFIG_TOKEN } from '../../constants.js';
import { IPyroscopeConfig } from '../../interfaces/profiling.interface.js';

describe('ProfilingHealthIndicator', () => {
	let indicator: ProfilingHealthIndicator;
	let mockPyroscopeService: { GetHealth: ReturnType<typeof vi.fn>; IsEnabled: ReturnType<typeof vi.fn> };
	let mockConfig: IPyroscopeConfig;

	beforeEach(() => {
		mockConfig = {
			enabled: true,
			serverAddress: 'http://localhost:4040',
			applicationName: 'test-app',
			degradedActiveProfilesThreshold: 100,
		};

		mockPyroscopeService = {
			GetHealth: vi.fn(),
			IsEnabled: vi.fn().mockReturnValue(true),
		} as any;

		const mockModuleRef = {
			get: vi.fn((token: any, _options?: any) => {
				if (token === PyroscopeService) return mockPyroscopeService;
				if (token === PYROSCOPE_CONFIG_TOKEN) return mockConfig;
				throw new Error(`Unknown token: ${String(token)}`);
			}),
		} as unknown as ModuleRef;

		indicator = new ProfilingHealthIndicator(mockModuleRef);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('check', () => {
		it('should return healthy status when profiling is properly initialized', () => {
			mockPyroscopeService.GetHealth.mockReturnValue({
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

			const result = indicator.Check('pyroscope');

			expect(result).toEqual({
				pyroscope: {
					status: 'up',
					initialized: true,
					activeProfiles: 10,
					totalMetrics: 100,
				},
			});
		});

		it('should return unhealthy when enabled but not initialized', () => {
			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'unhealthy',
				details: {
					enabled: true,
					initialized: false,
				},
			});

			const result = indicator.Check('pyroscope');

			expect(result.pyroscope.status).toBe('down');
			expect(result.pyroscope).toHaveProperty('message');
			expect(result.pyroscope.message).toContain('not initialized');
		});

		it('should return unhealthy when too many active profiles', () => {
			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 150, // Over threshold of 100
					totalMetrics: 1000,
				},
			});

			const result = indicator.Check('pyroscope');

			expect(result.pyroscope.status).toBe('down');
			expect(result.pyroscope).toHaveProperty('message');
			expect(result.pyroscope.message).toContain('Too many active profiles');
			expect(result.pyroscope.activeProfiles).toBe(150);
		});

		it('should use default threshold when not configured', () => {
			mockConfig.degradedActiveProfilesThreshold = undefined;

			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 50,
					totalMetrics: 100,
				},
			});

			const result = indicator.Check('pyroscope');

			expect(result.pyroscope.status).toBe('up');
		});

		it('should handle profiling disabled gracefully', () => {
			mockConfig.enabled = false;
			mockPyroscopeService.IsEnabled.mockReturnValue(false);
			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: false,
					initialized: false,
				},
			});

			const result = indicator.Check('pyroscope');

			// When disabled but health check requested, should still check initialization
			expect(result).toBeDefined();
		});

		it('should include detailed health information', () => {
			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 25,
					totalMetrics: 500,
					serverAddress: 'http://pyroscope.example.com',
					applicationName: 'production-app',
				},
			});

			const result = indicator.Check('profiling-status');

			expect(result['profiling-status'].status).toBe('up');
			expect(result['profiling-status'].initialized).toBe(true);
			expect(result['profiling-status'].activeProfiles).toBe(25);
			expect(result['profiling-status'].totalMetrics).toBe(500);
		});

		it('should work with custom key names', () => {
			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 5,
					totalMetrics: 50,
				},
			});

			const result = indicator.Check('custom_key');

			expect(result).toHaveProperty('custom_key');
			expect(result.custom_key.status).toBe('up');
		});

		it('should handle edge case at threshold boundary', () => {
			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 100, // Exactly at threshold
					totalMetrics: 1000,
				},
			});

			const result = indicator.Check('pyroscope');

			expect(result.pyroscope.status).toBe('up'); // At threshold, not over
		});

		it('should handle edge case just over threshold', () => {
			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 101, // Just over threshold
					totalMetrics: 1000,
				},
			});

			const result = indicator.Check('pyroscope');

			expect(result.pyroscope.status).toBe('down');
		});

		it('should handle zero active profiles', () => {
			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 0,
					totalMetrics: 0,
				},
			});

			const result = indicator.Check('pyroscope');

			expect(result.pyroscope.status).toBe('up');
			expect(result.pyroscope.activeProfiles).toBe(0);
		});

		it('should skip uninitialized check when profiling is disabled', () => {
			mockPyroscopeService.IsEnabled.mockReturnValue(false);
			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: false,
					initialized: true,
					activeProfiles: 5,
					totalMetrics: 50,
				},
			});

			const result = indicator.Check('pyroscope');

			// Should not return "not initialized" error since profiling is disabled
			expect(result.pyroscope.status).toBe('up');
			expect(result.pyroscope.message).toBeUndefined();
		});

		it('should return degraded status when activeProfiles exceeds configured threshold', () => {
			mockConfig.degradedActiveProfilesThreshold = 75;

			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 80, // Exceeds threshold of 75
					totalMetrics: 1000,
				},
			});

			const result = indicator.Check('pyroscope');

			expect(result.pyroscope.status).toBe('down');
			expect(result.pyroscope.message).toContain('Too many active profiles');
			expect(result.pyroscope.activeProfiles).toBe(80);
		});

		it('should handle error when getHealth throws exception', () => {
			mockPyroscopeService.GetHealth.mockImplementation(() => {
				throw new Error('Health check failed');
			});

			expect(() => {
				indicator.Check('pyroscope');
			}).toThrow('Health check failed');
		});

		it('should handle undefined activeProfiles gracefully', () => {
			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: undefined as any,
					totalMetrics: 0,
				},
			});

			const result = indicator.Check('pyroscope');

			// Should still return a result even with undefined activeProfiles
			expect(result.pyroscope).toBeDefined();
		});

		it('should properly use configured threshold over default', () => {
			mockConfig.degradedActiveProfilesThreshold = 50;

			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 51, // Exceeds custom threshold
					totalMetrics: 100,
				},
			});

			const result = indicator.Check('pyroscope');

			expect(result.pyroscope.status).toBe('down');
			expect(result.pyroscope.message).toContain('Too many active profiles');
		});

		it('should include all health details in successful response', () => {
			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: true,
					initialized: true,
					activeProfiles: 42,
					totalMetrics: 420,
				},
			});

			const result = indicator.Check('health');

			expect(result.health).toEqual({
				status: 'up',
				initialized: true,
				activeProfiles: 42,
				totalMetrics: 420,
			});
		});

		it('should return unhealthy when not initialized and enabled, including all details', () => {
			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'unhealthy',
				details: {
					enabled: true,
					initialized: false,
					activeProfiles: 10,
					totalMetrics: 100,
				},
			});

			const result = indicator.Check('pyroscope');

			expect(result.pyroscope.status).toBe('down');
			expect(result.pyroscope.message).toContain('not initialized');
			expect(result.pyroscope.enabled).toBe(true);
			expect(result.pyroscope.initialized).toBe(false);
		});

		it('should handle both initialized and not enabled conditions', () => {
			mockPyroscopeService.IsEnabled.mockReturnValue(false);
			mockPyroscopeService.GetHealth.mockReturnValue({
				status: 'healthy',
				details: {
					enabled: false,
					initialized: true,
					activeProfiles: 200, // Over threshold, but disabled
					totalMetrics: 2000,
				},
			});

			const result = indicator.Check('pyroscope');

			// Should skip first condition since !enabled
			// activeProfiles over threshold but should still return down
			expect(result.pyroscope.status).toBe('down');
			expect(result.pyroscope.message).toContain('Too many active profiles');
		});
	});
});
