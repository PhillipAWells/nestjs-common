import { MetricsModule } from '../metrics.module.js';

describe('MetricsModule', () => {
	describe('module definition', () => {
		it('should be defined', () => {
			expect(MetricsModule).toBeDefined();
		});

		it('should have forRoot static method', () => {
			expect(typeof MetricsModule.forRoot).toBe('function');
		});

		it('should have forRootAsync static method', () => {
			expect(typeof MetricsModule.forRootAsync).toBe('function');
		});
	});

	describe('forRoot configuration', () => {
		it('should return DynamicModule from forRoot', () => {
			const result = MetricsModule.forRoot();

			expect(result).toBeDefined();
			expect(result.module).toBe(MetricsModule);
			expect(result.global).toBe(true);
		});
	});

	describe('forRootAsync configuration', () => {
		it('should return DynamicModule from forRootAsync', () => {
			const result = MetricsModule.forRootAsync({});

			expect(result).toBeDefined();
			expect(result.module).toBe(MetricsModule);
			expect(result.global).toBe(true);
		});

		it('should handle custom options with useFactory', () => {
			const customOption = { useFactory: () => ({}), imports: [] };
			const result = MetricsModule.forRootAsync(customOption);

			expect(result).toBeDefined();
			expect(result.module).toBe(MetricsModule);
			expect(result.global).toBe(true);
		});
	});

	describe('global module behavior', () => {
		it('should mark module as global', () => {
			const result = MetricsModule.forRoot();

			expect(result.global).toBe(true);
		});

		it('should preserve global flag for async configuration', () => {
			const result = MetricsModule.forRootAsync({});

			expect(result.global).toBe(true);
		});
	});

	describe('module structure', () => {
		it('should be a valid class', () => {
			expect(typeof MetricsModule).toBe('function');
		});

		it('should return valid DynamicModule from forRoot', () => {
			const result = MetricsModule.forRoot();

			expect(result.module).toBe(MetricsModule);
			expect(result.global).toBe(true);
		});

		it('should have static methods', () => {
			expect(typeof MetricsModule.forRoot).toBe('function');
			expect(typeof MetricsModule.forRootAsync).toBe('function');
		});
	});
});
