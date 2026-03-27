
import { BaseValidationPipe } from '../base-validation.pipe.js';
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ValidationError , validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';

// Mock class-validator
vi.mock('class-validator', () => ({
	validate: vi.fn(),
}));
vi.mock('class-transformer', () => ({
	plainToClass: vi.fn(),
}));

// Concrete implementation for testing
class TestValidationPipe extends BaseValidationPipe {
	public formatValidationErrors(errors: ValidationError[]): any {
		return errors.map(error => ({
			field: error.property,
			message: Object.values(error.constraints ?? {}).join(', '),
		}));
	}
}

describe('BaseValidationPipe', () => {
	let pipe: TestValidationPipe;

	beforeEach(() => {
		pipe = new TestValidationPipe();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should be defined', () => {
		expect(pipe).toBeDefined();
	});

	describe('transform', () => {
		let metadata: ArgumentMetadata;

		beforeEach(() => {
			metadata = {
				type: 'body',
				metatype: class TestDto {
					public name: string = '';

					public email: string = '';
				},
				data: '',
			};

			// Mock plainToClass to return the input value
			(plainToClass as Mock).mockImplementation((metatype: any, value: any) => value);
		});

		it('should return value unchanged for primitive types', async () => {
			const primitiveMetadata: ArgumentMetadata = {
				...metadata,
				metatype: String,
			};

			const result = await pipe.transform('test', primitiveMetadata);

			expect(result).toBe('test');
		});

		it('should return value unchanged when metatype is undefined', async () => {
			const undefinedMetadata: ArgumentMetadata = {
				...metadata,
				metatype: undefined,
			};

			const result = await pipe.transform({ name: 'test' }, undefinedMetadata);

			expect(result).toEqual({ name: 'test' });
		});

		it('should validate and transform valid data', async () => {
			const validData = { name: 'John', email: 'john@example.com' };

			// Mock validate to return no errors
			(validate as Mock).mockResolvedValue([]);

			const result = await pipe.transform(validData, metadata);

			expect(validate).toHaveBeenCalled();
			expect(result).toBe(validData);
		});

		it('should throw BadRequestException for invalid data', async () => {
			const invalidData = { name: '', email: 'invalid' };

			// Mock validate to return errors
			const mockErrors: ValidationError[] = [
				{
					property: 'name',
					constraints: { isNotEmpty: 'name should not be empty' },
				} as ValidationError,
			];
			(validate as Mock).mockResolvedValue(mockErrors);

			await expect(pipe.transform(invalidData, metadata)).rejects.toThrow(BadRequestException);
		});
	});

	describe('shouldValidate', () => {
		it('should return false for primitive types', () => {
			expect((pipe as any).shouldValidate(String)).toBe(false);
			expect((pipe as any).shouldValidate(Boolean)).toBe(false);
			expect((pipe as any).shouldValidate(Number)).toBe(false);
			expect((pipe as any).shouldValidate(Array)).toBe(false);
			expect((pipe as any).shouldValidate(Object)).toBe(false);
		});

		it('should return true for custom classes', () => {
			class CustomClass {}
			expect((pipe as any).shouldValidate(CustomClass)).toBe(true);
		});
	});

	describe('getValidationOptions', () => {
		it('should return empty object by default', () => {
			const options = (pipe as any).getValidationOptions();
			expect(options).toEqual({});
		});
	});

	describe('getTransformOptions', () => {
		it('should return empty object by default', () => {
			const options = (pipe as any).getTransformOptions();
			expect(options).toEqual({});
		});
	});

	describe('handleValidationErrors', () => {
		it('should not throw by default', () => {
			const errors: ValidationError[] = [];
			expect(() => (pipe as any).handleValidationErrors(errors)).not.toThrow();
		});
	});

	describe('formatValidationErrors', () => {
		it('should format errors as expected', () => {
			const errors: ValidationError[] = [
				{
					property: 'email',
					constraints: {
						isEmail: 'must be a valid email',
						isNotEmpty: 'should not be empty',
					},
				} as ValidationError,
			];

			const result = (pipe as any).formatValidationErrors(errors);

			expect(result).toEqual([
				{
					field: 'email',
					message: 'must be a valid email, should not be empty',
				},
			]);
		});
	});
});
