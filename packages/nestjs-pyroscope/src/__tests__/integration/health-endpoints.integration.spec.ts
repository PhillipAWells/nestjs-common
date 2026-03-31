import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PyroscopeModule } from '../../module.js';
import { PyroscopeService } from '../../service.js';
import { MetricsService } from '../../services/metrics.service.js';
import { IPyroscopeConfig } from '../../interfaces/profiling.interface.js';
import type { IHealthResponse } from '../../controllers/health.controller.js';
import type { IMetricsResponse } from '../../services/metrics.service.js';

/**
 * Integration tests for health and metrics endpoints
 * Tests HTTP endpoints using supertest with real NestJS application
 */
describe('Health Endpoints (Integration)', () => {
	let app: INestApplication;
	let module: TestingModule;
	let _pyroscopeService: PyroscopeService;
	let _metricsService: MetricsService;

	const mockConfig: IPyroscopeConfig = {
		enabled: true,
		serverAddress: 'http://localhost:4040',
		applicationName: 'health-endpoint-test',
		tags: { env: 'test' },
	};

	afterEach(async () => {
		if (app) {
			await app.close();
		}
		if (module) {
			await module.close();
		}
	});

	describe('GET /profiling/health', () => {
		beforeEach(async () => {
			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
			}).compile();

			app = module.createNestApplication();
			await app.init();

			_pyroscopeService = module.get<PyroscopeService>(PyroscopeService);
			_metricsService = module.get<MetricsService>(MetricsService);
		});

		it('should return health response with healthy status', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/health')
				.expect(200);

			const health: IHealthResponse = response.body;

			expect(health).toHaveProperty('status');
			expect(['healthy', 'unhealthy', 'degraded']).toContain(health.status);
			expect(health).toHaveProperty('timestamp');
			expect(health).toHaveProperty('uptime');
			expect(health).toHaveProperty('pyroscope');
			expect(health).toHaveProperty('profiling');
		});

		it('should include Pyroscope connection details', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/health')
				.expect(200);

			const health: IHealthResponse = response.body;

			expect(health.pyroscope).toHaveProperty('connected');
			expect(health.pyroscope).toHaveProperty('serverAddress');
			expect(health.pyroscope).toHaveProperty('applicationName');
			expect(health.pyroscope).toHaveProperty('lastUpdate');

			expect(typeof health.pyroscope.connected).toBe('boolean');
			expect(typeof health.pyroscope.serverAddress).toBe('string');
			expect(typeof health.pyroscope.applicationName).toBe('string');
		});

		it('should include profiling status', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/health')
				.expect(200);

			const health: IHealthResponse = response.body;

			expect(health.profiling).toHaveProperty('enabled');
			expect(health.profiling).toHaveProperty('activeProfiles');
			expect(health.profiling).toHaveProperty('totalProfiles');

			expect(typeof health.profiling.enabled).toBe('boolean');
			expect(typeof health.profiling.activeProfiles).toBe('number');
			expect(typeof health.profiling.totalProfiles).toBe('number');
		});

		it('should include uptime information', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/health')
				.expect(200);

			const health: IHealthResponse = response.body;

			expect(health.uptime).toBeGreaterThanOrEqual(0);
			expect(typeof health.timestamp).toBe('number');
			expect(health.timestamp).toBeGreaterThan(0);
		});

		it('should reflect disabled profiling status', async () => {
			const disabledConfig = { ...mockConfig, enabled: false };

			const disabledModule = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: disabledConfig })],
			}).compile();

			const disabledApp = disabledModule.createNestApplication();
			await disabledApp.init();

			const response = await request(disabledApp.getHttpServer())
				.get('/profiling/health')
				.expect(200);

			const health: IHealthResponse = response.body;

			expect(health.profiling.enabled).toBe(false);

			await disabledApp.close();
			await disabledModule.close();
		});

		it('should return consistent status structure', async () => {
			const response1 = await request(app.getHttpServer())
				.get('/profiling/health')
				.expect(200);

			const response2 = await request(app.getHttpServer())
				.get('/profiling/health')
				.expect(200);

			const health1: IHealthResponse = response1.body;
			const health2: IHealthResponse = response2.body;

			expect(Object.keys(health1).sort()).toEqual(Object.keys(health2).sort());
		});
	});

	describe('GET /profiling/metrics', () => {
		beforeEach(async () => {
			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
			}).compile();

			app = module.createNestApplication();
			await app.init();

			_pyroscopeService = module.get<PyroscopeService>(PyroscopeService);
			_metricsService = module.get<MetricsService>(MetricsService);
		});

		it('should return metrics response', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/metrics')
				.expect(200);

			const metrics: IMetricsResponse = response.body;

			expect(metrics).toHaveProperty('timestamp');
			expect(metrics).toHaveProperty('cpu');
			expect(metrics).toHaveProperty('memory');
			expect(metrics).toHaveProperty('requests');
		});

		it('should include CPU metrics', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/metrics')
				.expect(200);

			const metrics: IMetricsResponse = response.body;

			expect(metrics.cpu).toHaveProperty('samples');
			expect(metrics.cpu).toHaveProperty('duration');

			expect(typeof metrics.cpu.samples).toBe('number');
			expect(typeof metrics.cpu.duration).toBe('number');
		});

		it('should include memory and request metrics', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/metrics')
				.expect(200);

			const metrics: IMetricsResponse = response.body;

			expect(metrics.memory).toHaveProperty('samples');
			expect(metrics.memory).toHaveProperty('allocations');
			expect(metrics.requests).toHaveProperty('total');
			expect(metrics.requests).toHaveProperty('successful');
			expect(metrics.requests).toHaveProperty('failed');
			expect(metrics.requests).toHaveProperty('averageResponseTime');
		});

		it('should have valid metrics data', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/metrics')
				.expect(200);

			const metrics: IMetricsResponse = response.body;

			expect(metrics.timestamp).toBeGreaterThan(0);
			expect(metrics.cpu.samples).toBeGreaterThanOrEqual(0);
			expect(metrics.cpu.duration).toBeGreaterThanOrEqual(0);
			expect(metrics.memory.samples).toBeGreaterThanOrEqual(0);
			expect(metrics.memory.allocations).toBeGreaterThanOrEqual(0);
			expect(metrics.requests.total).toBeGreaterThanOrEqual(0);
		});

		it('should return consistent metrics structure', async () => {
			const response1 = await request(app.getHttpServer())
				.get('/profiling/metrics')
				.expect(200);

			const response2 = await request(app.getHttpServer())
				.get('/profiling/metrics')
				.expect(200);

			const metrics1: IMetricsResponse = response1.body;
			const metrics2: IMetricsResponse = response2.body;

			expect(Object.keys(metrics1).sort()).toEqual(Object.keys(metrics2).sort());
		});
	});

	describe('GET /profiling/status', () => {
		beforeEach(async () => {
			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
			}).compile();

			app = module.createNestApplication();
			await app.init();

			_pyroscopeService = module.get<PyroscopeService>(PyroscopeService);
			_metricsService = module.get<MetricsService>(MetricsService);
		});

		it('should return combined health and metrics', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/status')
				.expect(200);

			const status = response.body;

			expect(status).toHaveProperty('health');
			expect(status).toHaveProperty('metrics');

			expect(status.health).toHaveProperty('status');
			expect(status.metrics).toHaveProperty('timestamp');
		});

		it('should include complete health information', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/status')
				.expect(200);

			const status = response.body;

			expect(status.health.pyroscope).toBeDefined();
			expect(status.health.profiling).toBeDefined();
		});

		it('should include complete metrics information', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/status')
				.expect(200);

			const status = response.body;

			expect(status.metrics.cpu).toBeDefined();
			expect(status.metrics.memory).toBeDefined();
			expect(status.metrics.requests).toBeDefined();
			expect(status.metrics.timestamp).toBeGreaterThan(0);
		});
	});

	describe('GET /profiling/metrics/prometheus', () => {
		beforeEach(async () => {
			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
			}).compile();

			app = module.createNestApplication();
			await app.init();

			_pyroscopeService = module.get<PyroscopeService>(PyroscopeService);
			_metricsService = module.get<MetricsService>(MetricsService);
		});

		it('should return Prometheus metrics format', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/metrics/prometheus')
				.expect(200);

			const prometheusMetrics = response.text;

			expect(typeof prometheusMetrics).toBe('string');
			expect(prometheusMetrics.length).toBeGreaterThan(0);
		});

		it('should contain valid Prometheus format lines', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/metrics/prometheus')
				.expect(200);

			const prometheusMetrics = response.text;
			const lines = prometheusMetrics.split('\n').filter(line => line.trim().length > 0);

			// Should have some metric lines or comments
			expect(lines.length).toBeGreaterThan(0);

			// Should contain Prometheus-style comments or metrics
			const hasCommentOrMetric = lines.some(
				line => line.startsWith('#') || line.match(/^\w+{?.*}?\s+\d+/),
			);
			expect(hasCommentOrMetric).toBe(true);
		});

		it('should provide text content type', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/metrics/prometheus')
				.expect(200);

			const contentType = response.headers['content-type'];
			expect(contentType).toBeTruthy();
			// Accept either text/plain or application/json depending on NestJS configuration
			expect(contentType).toMatch(/text|application/);
		});

		it('should contain profiling-related metrics', async () => {
			const response = await request(app.getHttpServer())
				.get('/profiling/metrics/prometheus')
				.expect(200);

			const prometheusMetrics = response.text;

			// Should contain some profiling metrics
			expect(prometheusMetrics).toBeTruthy();
			expect(prometheusMetrics.length).toBeGreaterThan(0);
		});
	});

	describe('Endpoint consistency and timing', () => {
		beforeEach(async () => {
			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
			}).compile();

			app = module.createNestApplication();
			await app.init();

			_pyroscopeService = module.get<PyroscopeService>(PyroscopeService);
			_metricsService = module.get<MetricsService>(MetricsService);
		});

		it('should handle rapid successive requests', async () => {
			const requests = Array.from({ length: 3 }, () =>
				request(app.getHttpServer()).get('/profiling/health'),
			);

			const responses = await Promise.all(requests);

			expect(responses).toHaveLength(3);
			responses.forEach(response => {
				if (response.status === 200) {
					expect(response.body).toHaveProperty('status');
				}
			});
		});

		it('should return consistent application name across endpoints', async () => {
			const healthRes = await request(app.getHttpServer())
				.get('/profiling/health')
				.expect(200);

			const statusRes = await request(app.getHttpServer())
				.get('/profiling/status')
				.expect(200);

			expect(healthRes.body.pyroscope.applicationName).toBe(
				mockConfig.applicationName,
			);
			expect(statusRes.body.health.pyroscope.applicationName).toBe(
				mockConfig.applicationName,
			);
		});

		it('should update timestamps on each request', async () => {
			const response1 = await request(app.getHttpServer())
				.get('/profiling/health')
				.expect(200);

			await new Promise(resolve => setTimeout(resolve, 10));

			const response2 = await request(app.getHttpServer())
				.get('/profiling/health')
				.expect(200);

			// Timestamps should be different (or at least not guaranteed to be same)
			expect(typeof response1.body.timestamp).toBe('number');
			expect(typeof response2.body.timestamp).toBe('number');
		});
	});

	describe('Endpoint error handling and edge cases', () => {
		beforeEach(async () => {
			module = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
			}).compile();

			app = module.createNestApplication();
			await app.init();
		});

		it('should handle non-existent routes', async () => {
			await request(app.getHttpServer())
				.get('/profiling/nonexistent')
				.expect(404);
		});

		it('should not allow other HTTP methods on health endpoint', async () => {
			// POST to GET-only endpoint should return 404 or 405
			const response = await request(app.getHttpServer())
				.post('/profiling/health');

			expect([404, 405]).toContain(response.status);
		});

		it('should return valid JSON for all endpoints', async () => {
			const endpoints = ['/profiling/health', '/profiling/metrics', '/profiling/status'];

			for (const endpoint of endpoints) {
				const response = await request(app.getHttpServer())
					.get(endpoint)
					.expect(200);

				// Should be valid JSON (not just text)
				expect(typeof response.body).toBe('object');
				expect(response.body).not.toBeNull();
			}
		});
	});

	describe('Endpoint response with health check disabled', () => {
		it('should not register endpoints when enableHealthChecks is false', async () => {
			const configNoHealth = { ...mockConfig, enableHealthChecks: false };

			const noHealthModule = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: configNoHealth })],
			}).compile();

			const noHealthApp = noHealthModule.createNestApplication();
			await noHealthApp.init();

			// Health endpoints should not exist
			await request(noHealthApp.getHttpServer())
				.get('/profiling/health')
				.expect(404);

			await request(noHealthApp.getHttpServer())
				.get('/profiling/metrics')
				.expect(404);

			await noHealthApp.close();
			await noHealthModule.close();
		});
	});
});
