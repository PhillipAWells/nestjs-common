import { describe, it, expect } from 'vitest';
import { BaseApplicationError } from '../base-application-error.js';

describe('BaseApplicationError', () => {
	describe('constructor', () => {
		it('should create error with default values', () => {
			const error = new BaseApplicationError('Test error');

			expect(error.message).toBe('Test error');
			expect(error.Code).toBe('INTERNAL_SERVER_ERROR');
			expect(error.StatusCode).toBe(500);
			expect(error.Context).toEqual({});
			expect(error.Timestamp).toBeInstanceOf(Date);
			expect(error.name).toBe('BaseApplicationError');
		});

		it('should create error with custom options', () => {
			const context = { userId: '123' };
			const error = new BaseApplicationError('Test error', {
				code: 'CUSTOM_ERROR',
				statusCode: 400,
				context,
			});

			expect(error.message).toBe('Test error');
			expect(error.Code).toBe('CUSTOM_ERROR');
			expect(error.StatusCode).toBe(400);
			expect(error.Context).toEqual(context);
		});

		it('should capture stack trace', () => {
			const error = new BaseApplicationError('Test error');

			expect(error.stack).toBeDefined();
			expect(error.stack).toContain('BaseApplicationError');
		});
	});

	describe('toJSON', () => {
		it('should serialize error to plain object', () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = 'production'; // Ensure no stack in production

			const error = new BaseApplicationError('Test error', {
				code: 'TEST_ERROR',
				statusCode: 400,
				context: { userId: '123' },
			});

			const json = error.ToJSON();

			expect(json).toEqual({
				name: 'BaseApplicationError',
				message: 'Test error',
				code: 'TEST_ERROR',
				statusCode: 400,
				context: { userId: '123' },
				timestamp: error.Timestamp.toISOString(),
			});

			process.env.NODE_ENV = originalEnv;
		});

		it('should include stack trace in development', () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = 'development';

			const error = new BaseApplicationError('Test error');
			const json = error.ToJSON();

			expect(json.stack).toBeDefined();

			process.env.NODE_ENV = originalEnv;
		});

		it('should exclude stack trace in production', () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = 'production';

			const error = new BaseApplicationError('Test error');
			const json = error.ToJSON();

			expect(json.stack).toBeUndefined();

			process.env.NODE_ENV = originalEnv;
		});
	});

	describe('withContext', () => {
		it('should create new error with merged context', () => {
			const originalError = new BaseApplicationError('Test error', {
				context: { userId: '123' },
			});

			const newError = originalError.WithContext({ action: 'login' });

			expect(newError).not.toBe(originalError);
			expect(newError.message).toBe('Test error');
			expect(newError.Code).toBe('INTERNAL_SERVER_ERROR');
			expect(newError.StatusCode).toBe(500);
			expect(newError.Context).toEqual({ userId: '123', action: 'login' });
		});

		it('should override existing context values', () => {
			const originalError = new BaseApplicationError('Test error', {
				context: { userId: '123', action: 'register' },
			});

			const newError = originalError.WithContext({ action: 'login' });

			expect(newError.Context).toEqual({ userId: '123', action: 'login' });
		});
	});

	describe('withMessage', () => {
		it('should create new error with different message', () => {
			const originalError = new BaseApplicationError('Original message', {
				code: 'TEST_ERROR',
				context: { userId: '123' },
			});

			const newError = originalError.WithMessage('New message');

			expect(newError).not.toBe(originalError);
			expect(newError.message).toBe('New message');
			expect(newError.Code).toBe('TEST_ERROR');
			expect(newError.Context).toEqual({ userId: '123' });
		});
	});

	describe('inheritance', () => {
		it('should be instanceof Error', () => {
			const error = new BaseApplicationError('Test error');

			expect(error).toBeInstanceOf(Error);
		});

		it('should have proper prototype chain', () => {
			const error = new BaseApplicationError('Test error');

			expect(Object.getPrototypeOf(error)).toBe(BaseApplicationError.prototype);
			expect(Object.getPrototypeOf(BaseApplicationError.prototype)).toBe(Error.prototype);
		});
	});
});
