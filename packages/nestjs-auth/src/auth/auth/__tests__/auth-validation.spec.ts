
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { LoginValidationInput, RegisterValidationInput, RefreshTokenValidationInput } from '../auth.validation.js';

describe('Auth Validation DTOs', () => {
	describe('LoginValidationInput', () => {
		it('should accept valid login credentials', async () => {
			const input = plainToClass(LoginValidationInput, {
				email: 'user@example.com',
				password: 'SecurePassword123!'
			});

			const errors = await validate(input);
			expect(errors).toHaveLength(0);
		});

		it('should reject invalid email format', async () => {
			const input = plainToClass(LoginValidationInput, {
				email: 'not-an-email',
				password: 'SecurePassword123!'
			});

			const errors = await validate(input);
			expect(errors).toHaveLength(1);
			expect(errors[0].property).toBe('email');
			expect(errors[0].constraints).toMatchObject({
				isEmail: expect.stringContaining('valid email address')
			});
		});

		it('should reject password shorter than 8 characters', async () => {
			const input = plainToClass(LoginValidationInput, {
				email: 'user@example.com',
				password: 'short'
			});

			const errors = await validate(input);
			expect(errors.length).toBeGreaterThan(0);
			const passwordError = errors.find(e => e.property === 'password');
			expect(passwordError?.constraints).toMatchObject({
				minLength: expect.stringContaining('at least 8 characters')
			});
		});

		it('should reject password longer than 128 characters', async () => {
			const input = plainToClass(LoginValidationInput, {
				email: 'user@example.com',
				password: 'a'.repeat(129)
			});

			const errors = await validate(input);
			expect(errors.length).toBeGreaterThan(0);
			const passwordError = errors.find(e => e.property === 'password');
			expect(passwordError?.constraints).toMatchObject({
				maxLength: expect.stringContaining('must not exceed 128 characters')
			});
		});

		it('should reject password with suspicious SQL injection patterns', async () => {
			const suspiciousPasswords = [
				'\'; DROP TABLE users--',
				'password""""""',
				'pass\\\\\\word'
			];

			for (const password of suspiciousPasswords) {
				const input = plainToClass(LoginValidationInput, {
					email: 'user@example.com',
					password
				});

				const errors = await validate(input);
				const hasPasswordError = errors.some(e => e.property === 'password');
				expect(hasPasswordError).toBe(true);
			}
		});

		it('should reject email exceeding 254 characters', async () => {
			const input = plainToClass(LoginValidationInput, {
				email: 'a'.repeat(300) + '@example.com',
				password: 'SecurePassword123!'
			});

			const errors = await validate(input);
			expect(errors.length).toBeGreaterThan(0);
		});

		it('should accept email with special characters allowed by RFC', async () => {
			const input = plainToClass(LoginValidationInput, {
				email: 'user+tag@example.co.uk',
				password: 'SecurePassword123!'
			});

			const errors = await validate(input);
			expect(errors).toHaveLength(0);
		});

		it('should reject missing email', async () => {
			const input = plainToClass(LoginValidationInput, {
				password: 'SecurePassword123!'
			});

			const errors = await validate(input);
			expect(errors.length).toBeGreaterThan(0);
		});

		it('should reject missing password', async () => {
			const input = plainToClass(LoginValidationInput, {
				email: 'user@example.com'
			});

			const errors = await validate(input);
			expect(errors.length).toBeGreaterThan(0);
		});
	});

	describe('RegisterValidationInput', () => {
		it('should accept valid registration data', async () => {
			const input = plainToClass(RegisterValidationInput, {
				email: 'newuser@example.com',
				password: 'SecurePassword123!Strong',
				firstName: 'John',
				lastName: 'Doe'
			});

			const errors = await validate(input);
			expect(errors).toHaveLength(0);
		});

		it('should require strong passwords (12+ characters)', async () => {
			const input = plainToClass(RegisterValidationInput, {
				email: 'newuser@example.com',
				password: 'Weak123!'
			});

			const errors = await validate(input);
			expect(errors.length).toBeGreaterThan(0);
			const passwordError = errors.find(e => e.property === 'password');
			expect(passwordError?.constraints).toMatchObject({
				minLength: expect.stringContaining('at least 12 characters')
			});
		});

		it('should accept optional name fields', async () => {
			const input = plainToClass(RegisterValidationInput, {
				email: 'newuser@example.com',
				password: 'SecurePassword123!Strong'
			});

			const errors = await validate(input);
			expect(errors).toHaveLength(0);
		});

		it('should reject firstName exceeding 100 characters', async () => {
			const input = plainToClass(RegisterValidationInput, {
				email: 'newuser@example.com',
				password: 'SecurePassword123!Strong',
				firstName: 'a'.repeat(101)
			});

			const errors = await validate(input);
			expect(errors.length).toBeGreaterThan(0);
		});

		it('should reject lastName exceeding 100 characters', async () => {
			const input = plainToClass(RegisterValidationInput, {
				email: 'newuser@example.com',
				password: 'SecurePassword123!Strong',
				lastName: 'a'.repeat(101)
			});

			const errors = await validate(input);
			expect(errors.length).toBeGreaterThan(0);
		});

		it('should accept undefined/null optional fields', async () => {
			const input = plainToClass(RegisterValidationInput, {
				email: 'newuser@example.com',
				password: 'SecurePassword123!Strong',
				firstName: null,
				lastName: undefined
			});

			const errors = await validate(input);
			expect(errors).toHaveLength(0);
		});

		it('should reject invalid email in register', async () => {
			const input = plainToClass(RegisterValidationInput, {
				email: 'invalid-email',
				password: 'SecurePassword123!Strong'
			});

			const errors = await validate(input);
			expect(errors.length).toBeGreaterThan(0);
		});
	});

	describe('RefreshTokenValidationInput', () => {
		it('should accept valid refresh token', async () => {
			const input = plainToClass(RefreshTokenValidationInput, {
				refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
			});

			const errors = await validate(input);
			expect(errors).toHaveLength(0);
		});

		it('should reject refresh token shorter than 10 characters', async () => {
			const input = plainToClass(RefreshTokenValidationInput, {
				refreshToken: 'short'
			});

			const errors = await validate(input);
			expect(errors.length).toBeGreaterThan(0);
		});

		it('should reject refresh token exceeding max length', async () => {
			const input = plainToClass(RefreshTokenValidationInput, {
				refreshToken: 'a'.repeat(4_097)
			});

			const errors = await validate(input);
			expect(errors.length).toBeGreaterThan(0);
		});

		it('should reject missing refresh token', async () => {
			const input = plainToClass(RefreshTokenValidationInput, {});

			const errors = await validate(input);
			expect(errors.length).toBeGreaterThan(0);
		});

		it('should reject non-string refresh token', async () => {
			const input = plainToClass(RefreshTokenValidationInput, {
				refreshToken: 123 as any
			});

			const errors = await validate(input);
			expect(errors.length).toBeGreaterThan(0);
		});
	});
});
