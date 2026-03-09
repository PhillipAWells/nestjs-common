import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HealthCheckService } from '../health-check.service.js';
import { AppLogger } from '../logger.service.js';

describe('HealthCheckService', () => {
	let service: HealthCheckService;
	let mockLogger: AppLogger;

	beforeEach(() => {
		// Direct instantiation instead of TestingModule
		mockLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
				info: vi.fn(),
			}),
		} as any;
		service = new HealthCheckService(mockLogger);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should return health check with ok status', () => {
		const health = service.getHealth();
		expect(health.status).toBe('ok');
		expect(health.timestamp).toBeDefined();
	});

	it('should return readiness check with ready status', () => {
		const readiness = service.getReadiness();
		expect(readiness.status).toBe('ready');
		expect(readiness.timestamp).toBeDefined();
	});

	it('should return liveness check with alive status', () => {
		const liveness = service.getLiveness();
		expect(liveness.status).toBe('alive');
		expect(liveness.timestamp).toBeDefined();
	});

	it('should include service name in responses', () => {
		const health = service.getHealth('test-service');
		expect(health.service).toBe('test-service');
	});

	it('should include version in responses', () => {
		const health = service.getHealth('test-service', '1.0.0');
		expect(health.version).toBe('1.0.0');
	});

	it('should include checks in readiness response', () => {
		const readiness = service.getReadiness({ database: 'ok', cache: 'ok' });
		expect(readiness.checks).toBeDefined();
		expect(readiness.checks?.['database']).toBe('ok');
		expect(readiness.checks?.['cache']).toBe('ok');
	});

	it('should return liveness without checks', () => {
		const liveness = service.getLiveness();
		expect(liveness.status).toBe('alive');
		expect(liveness.checks).toBeUndefined();
	});
});
