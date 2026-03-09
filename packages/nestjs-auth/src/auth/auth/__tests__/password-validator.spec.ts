
import { Test, TestingModule } from '@nestjs/testing';
import { PasswordValidatorService } from '../password-validator.service.js';
import { BadRequestException } from '@nestjs/common';

describe('PasswordValidatorService', () => {
	let service: PasswordValidatorService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PasswordValidatorService],
		}).compile();

		service = module.get<PasswordValidatorService>(PasswordValidatorService);
	});

	describe('validatePassword', () => {
		it('should accept strong password', () => {
			const result = service.validatePassword('MyP@ssw0rd123!');

			expect(result.isValid).toBe(true);
			expect(result.strength).toBe('strong');
			expect(result.feedback.length).toBe(0);
		});

		it('should reject password without uppercase', () => {
			const result = service.validatePassword('myp@ssw0rd123!');

			expect(result.isValid).toBe(false);
			expect(result.feedback).toContain(
				'Password must contain at least one uppercase letter',
			);
		});

		it('should reject password without lowercase', () => {
			const result = service.validatePassword('MYP@SSW0RD123!');

			expect(result.isValid).toBe(false);
			expect(result.feedback).toContain(
				'Password must contain at least one lowercase letter',
			);
		});

		it('should reject password without numbers', () => {
			const result = service.validatePassword('MyP@ssword!');

			expect(result.isValid).toBe(false);
			expect(result.feedback).toContain('Password must contain at least one number');
		});

		it('should reject password without special characters', () => {
			const result = service.validatePassword('MyPassword123');

			expect(result.isValid).toBe(false);
			expect(result.feedback).toContain(
				'Password must contain at least one special character',
			);
		});

		it('should reject password shorter than 12 characters', () => {
			const result = service.validatePassword('MyP@ss123');

			expect(result.isValid).toBe(false);
			expect(result.feedback).toContain(
				'Password must be at least 12 characters long',
			);
		});

		it('should reject password with common patterns', () => {
			const result = service.validatePassword('MyPassword123!abc');

			expect(result.isValid).toBe(false);
			expect(result.feedback).toContain('Password contains common patterns');
		});
	});

	describe('validatePasswordOrThrow', () => {
		it('should throw for weak password', () => {
			expect(() => service.validatePasswordOrThrow('weak')).toThrow(BadRequestException);
		});

		it('should not throw for strong password', () => {
			expect(() => service.validatePasswordOrThrow('MyP@ssw0rd123!')).not.toThrow();
		});
	});
});
