import { MetricsRegistryService } from '../metrics-registry.service.js';
import { register } from 'prom-client';

describe('MetricsRegistryService', () => {
	let service: MetricsRegistryService;
	let mockAppLogger: any;

	beforeEach(() => {
		register.clear();

		mockAppLogger = {
			Info: () => {},
			Warn: () => {},
			Error: () => {},
			Debug: () => {},
			info: () => {},
			warn: () => {},
			error: () => {},
			debug: () => {},
			CreateContextualLogger: () => ({
				Info: () => {},
				Warn: () => {},
				Error: () => {},
				Debug: () => {},
				info: () => {},
				warn: () => {},
				error: () => {},
				debug: () => {},
			}),
		};

		const mockModuleRef = { get: () => mockAppLogger } as any;
		service = new MetricsRegistryService(mockModuleRef);
	});

	afterEach(() => {
		register.clear();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should record HTTP request metrics', () => {
		service.RecordHttpRequest('GET', '/test', 200, 100, 1024);

		const metrics = service.GetRegistry();
		expect(metrics).toBeDefined();
	});

	it('should get metrics in Prometheus format', async () => {
		const metrics = await service.GetMetrics();
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

		const Result = service.RegisterMetric(mockMetric);
		expect(Result).toBe(mockMetric);
		expect(registerCalled).toBe(true);
	});

	it('should clear metrics', () => {
		service.Clear();
		// Should not throw
		expect(service).toBeDefined();
	});
});
