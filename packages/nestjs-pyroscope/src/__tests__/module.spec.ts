import { Test, TestingModule } from '@nestjs/testing';
import { PyroscopeModule } from '../module.js';
import { PyroscopeService } from '../service.js';
import { MetricsService } from '../services/metrics.service.js';
import { ProfilingHealthIndicator } from '../indicators/profiling.health.js';
import { HealthController } from '../controllers/health.controller.js';
import { IPyroscopeConfig } from '../interfaces/profiling.interface.js';

describe('PyroscopeModule', () => {
	const mockConfig: IPyroscopeConfig = {
		enabled: false,
		serverAddress: 'http://localhost:4040',
		applicationName: 'test-app',
		tags: { env: 'test' },
	};

	describe('forRoot', () => {
		it('should create module with synchronous config object', async () => {
			const module: TestingModule = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
			}).compile();

			const pyroscopeService = module.get<PyroscopeService>(PyroscopeService);
			const metricsService = module.get<MetricsService>(MetricsService);
			const healthIndicator = module.get<ProfilingHealthIndicator>(ProfilingHealthIndicator);

			expect(pyroscopeService).toBeDefined();
			expect(metricsService).toBeDefined();
			expect(healthIndicator).toBeDefined();
		});

		it('should create module with synchronous config factory function', async () => {
			const configFactory = (): IPyroscopeConfig => mockConfig;

			const module: TestingModule = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: configFactory })],
			}).compile();

			const pyroscopeService = module.get<PyroscopeService>(PyroscopeService);
			expect(pyroscopeService).toBeDefined();
		});

		it('should register HealthController when enableHealthChecks is not false', async () => {
			const module: TestingModule = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: mockConfig })],
			}).compile();

			const healthController = module.get<HealthController>(HealthController);
			expect(healthController).toBeDefined();
		});

		it('should not register HealthController when enableHealthChecks is false', async () => {
			const configWithoutHealth = { ...mockConfig, enableHealthChecks: false };

			const module: TestingModule = await Test.createTestingModule({
				imports: [PyroscopeModule.ForRoot({ config: configWithoutHealth })],
			}).compile();

			expect(() => module.get<HealthController>(HealthController)).toThrow();
		});

		it('should be global by default', () => {
			const dynamicModule = PyroscopeModule.ForRoot({ config: mockConfig });
			expect(dynamicModule.global).toBe(true);
		});

		it('should respect isGlobal option', () => {
			const dynamicModule = PyroscopeModule.ForRoot({
				config: mockConfig,
				isGlobal: false,
			});
			expect(dynamicModule.global).toBe(false);
		});

		it('should export PyroscopeService and ProfilingHealthIndicator', () => {
			const dynamicModule = PyroscopeModule.ForRoot({ config: mockConfig });
			expect(dynamicModule.exports).toContain(PyroscopeService);
			expect(dynamicModule.exports).toContain(ProfilingHealthIndicator);
		});
	});

	describe('forRootAsync', () => {
		it('should create module with async factory', async () => {
			const module: TestingModule = await Test.createTestingModule({
				imports: [
					PyroscopeModule.ForRootAsync({
						useFactory: () => mockConfig,
					}),
				],
			}).compile();

			const pyroscopeService = module.get<PyroscopeService>(PyroscopeService);
			const metricsService = module.get<MetricsService>(MetricsService);
			const healthIndicator = module.get<ProfilingHealthIndicator>(ProfilingHealthIndicator);

			expect(pyroscopeService).toBeDefined();
			expect(metricsService).toBeDefined();
			expect(healthIndicator).toBeDefined();
		});

		it('should create module with direct factory function without external dependencies', async () => {
			const configFactory = (): IPyroscopeConfig => mockConfig;

			const module: TestingModule = await Test.createTestingModule({
				imports: [
					PyroscopeModule.ForRootAsync({
						useFactory: configFactory,
					}),
				],
			}).compile();

			const pyroscopeService = module.get<PyroscopeService>(PyroscopeService);
			expect(pyroscopeService).toBeDefined();
		});

		it('should always register HealthController for async config', async () => {
			const module: TestingModule = await Test.createTestingModule({
				imports: [
					PyroscopeModule.ForRootAsync({
						useFactory: () => mockConfig,
					}),
				],
			}).compile();

			const healthController = module.get<HealthController>(HealthController);
			expect(healthController).toBeDefined();
		});

		it('should be global by default', () => {
			const dynamicModule = PyroscopeModule.ForRootAsync({
				useFactory: () => mockConfig,
			});
			expect(dynamicModule.global).toBe(true);
		});

		it('should respect isGlobal option', () => {
			const dynamicModule = PyroscopeModule.ForRootAsync({
				useFactory: () => mockConfig,
				isGlobal: false,
			});
			expect(dynamicModule.global).toBe(false);
		});

		it('should export PyroscopeService and ProfilingHealthIndicator', () => {
			const dynamicModule = PyroscopeModule.ForRootAsync({
				useFactory: () => mockConfig,
			});
			expect(dynamicModule.exports).toContain(PyroscopeService);
			expect(dynamicModule.exports).toContain(ProfilingHealthIndicator);
		});
	});
});
