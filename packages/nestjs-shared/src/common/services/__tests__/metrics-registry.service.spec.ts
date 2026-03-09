import { MetricsRegistryService } from '../metrics-registry.service.js';
import { register } from 'prom-client';

describe('MetricsRegistryService', () => {
	let service: MetricsRegistryService;
	let mockAppLogger: any;

	beforeEach(() => {
		register.clear();

		mockAppLogger = {
			info: () => {},
			warn: () => {},
			error: () => {},
			debug: () => {},
			createContextualLogger: () => ({
				info: () => {},
				warn: () => {},
				error: () => {},
				debug: () => {},
			}),
		};

		service = new MetricsRegistryService(mockAppLogger);
	});

	afterEach(() => {
		register.clear();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should record HTTP request metrics', () => {
		service.recordHttpRequest('GET', '/test', 200, 100, 1024);

		const metrics = service.getRegistry();
		expect(metrics).toBeDefined();
	});

	it('should get metrics in Prometheus format', async () => {
		const metrics = await service.getMetrics();
		expect(typeof metrics).toBe('string');
		expect(metrics).toContain('# HELP');
		expect(metrics).toContain('# TYPE');
	});

	it('should register custom metrics', () => {
		let registerCalled = false;
		const mockMetric = {
			name: 'test_metric',
			register: () => {
				registerCalled = true;
			},
		};

		const result = service.registerMetric(mockMetric);
		expect(result).toBe(mockMetric);
		expect(registerCalled).toBe(true);
	});

	it('should clear metrics', () => {
		service.clear();
		// Should not throw
		expect(service).toBeDefined();
	});
});
