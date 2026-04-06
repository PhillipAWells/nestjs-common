import { describe, it, expect } from 'vitest';
import { MetricsModule } from '../metrics.module.js';

describe('MetricsModule', () => {
	describe('module definition', () => {
		it('should be defined', () => {
			expect(MetricsModule).toBeDefined();
		});

		it('should have forRoot static method', () => {
			expect(typeof MetricsModule.ForRoot).toBe('function');
		});

		it('should have forRootAsync static method', () => {
			expect(typeof MetricsModule.ForRootAsync).toBe('function');
		});
	});

	describe('forRoot configuration', () => {
		it('should return DynamicModule from forRoot', () => {
			const Result = MetricsModule.ForRoot();

			expect(Result).toBeDefined();
			expect(Result.module).toBe(MetricsModule);
		});
	});

	describe('forRootAsync configuration', () => {
		it('should return DynamicModule from forRootAsync', () => {
			const Result = MetricsModule.ForRootAsync({});

			expect(Result).toBeDefined();
			expect(Result.module).toBe(MetricsModule);
		});

		it('should handle custom options with useFactory', () => {
			const customOption = { useFactory: () => ({}), imports: [] };
			const Result = MetricsModule.ForRootAsync(customOption);

			expect(Result).toBeDefined();
			expect(Result.module).toBe(MetricsModule);
		});
	});

	describe('module structure', () => {
		it('should be a valid class', () => {
			expect(typeof MetricsModule).toBe('function');
		});

		it('should return valid DynamicModule from forRoot', () => {
			const Result = MetricsModule.ForRoot();

			expect(Result.module).toBe(MetricsModule);
		});

		it('should have static methods', () => {
			expect(typeof MetricsModule.ForRoot).toBe('function');
			expect(typeof MetricsModule.ForRootAsync).toBe('function');
		});
	});
});
