import { ValidationPipe } from '../validation.pipe.js';
import { ValidationError } from 'class-validator';

describe('ValidationPipe', () => {
	let pipe: ValidationPipe;

	beforeEach(() => {
		pipe = new ValidationPipe();
	});

	it('should be defined', () => {
		expect(pipe).toBeDefined();
	});

	describe('formatValidationErrors', () => {
		it('should format single validation error', () => {
			const errors: ValidationError[] = [
				{
					property: 'email',
					constraints: {
						isEmail: 'email must be an email',
						isNotEmpty: 'email should not be empty',
					},
				} as ValidationError,
			];

			const result = (pipe as any).formatValidationErrors(errors);

			expect(result).toEqual(['email: email must be an email, email should not be empty']);
		});

		it('should format multiple validation errors', () => {
			const errors: ValidationError[] = [
				{
					property: 'email',
					constraints: {
						isEmail: 'email must be an email',
					},
				} as ValidationError,
				{
					property: 'password',
					constraints: {
						minLength: 'password must be longer than or equal to 8 characters',
						isNotEmpty: 'password should not be empty',
					},
				} as ValidationError,
			];

			const result = (pipe as any).formatValidationErrors(errors);

			expect(result).toEqual([
				'email: email must be an email',
				'password: password must be longer than or equal to 8 characters, password should not be empty',
			]);
		});

		it('should handle validation error with no constraints', () => {
			const errors: ValidationError[] = [
				{
					property: 'name',
					constraints: {},
				} as ValidationError,
			];

			const result = (pipe as any).formatValidationErrors(errors);

			expect(result).toEqual([]);
		});

		it('should handle validation error with undefined constraints', () => {
			const errors: ValidationError[] = [
				{
					property: 'age',
					constraints: undefined,
				} as any,
			];

			const result = (pipe as any).formatValidationErrors(errors);

			expect(result).toEqual([]);
		});

		it('should handle empty errors array', () => {
			const errors: ValidationError[] = [];

			const result = (pipe as any).formatValidationErrors(errors);

			expect(result).toEqual([]);
		});

		it('should handle nested validation errors', () => {
			const errors: ValidationError[] = [
				{
					property: 'address',
					children: [
						{
							property: 'street',
							constraints: {
								isNotEmpty: 'street should not be empty',
							},
						} as ValidationError,
						{
							property: 'city',
							constraints: {
								isNotEmpty: 'city should not be empty',
								minLength: 'city must be at least 2 characters',
							},
						} as ValidationError,
					],
				} as any,
			];

			const result = (pipe as any).formatValidationErrors(errors);

			expect(result).toEqual([
				'address.street: street should not be empty',
				'address.city: city should not be empty, city must be at least 2 characters',
			]);
		});

		it('should handle deeply nested validation errors', () => {
			const errors: ValidationError[] = [
				{
					property: 'profile',
					children: [
						{
							property: 'address',
							children: [
								{
									property: 'coordinates',
									constraints: {
										isNumber: 'latitude must be a number',
									},
								} as ValidationError,
							],
						} as any,
					],
				} as any,
			];

			const result = (pipe as any).formatValidationErrors(errors);

			expect(result).toEqual([
				'profile.address.coordinates: latitude must be a number',
			]);
		});

		it('should handle nested errors without constraints', () => {
			const errors: ValidationError[] = [
				{
					property: 'user',
					children: [
						{
							property: 'name',
							constraints: {
								isNotEmpty: 'name should not be empty',
							},
						} as ValidationError,
						{
							property: 'emails',
							children: [
								{
									property: '0',
									constraints: {
										isEmail: 'email must be valid',
									},
								} as ValidationError,
							],
						} as any,
					],
				} as any,
			];

			const result = (pipe as any).formatValidationErrors(errors);

			expect(result).toEqual([
				'user.name: name should not be empty',
				'user.emails.0: email must be valid',
			]);
		});

		it('should handle mixed errors with and without children', () => {
			const errors: ValidationError[] = [
				{
					property: 'email',
					constraints: {
						isEmail: 'must be email',
					},
				} as ValidationError,
				{
					property: 'profile',
					children: [
						{
							property: 'bio',
							constraints: {
								maxLength: 'bio too long',
							},
						} as ValidationError,
					],
				} as any,
			];

			const result = (pipe as any).formatValidationErrors(errors);

			expect(result).toEqual([
				'email: must be email',
				'profile.bio: bio too long',
			]);
		});
	});
});
