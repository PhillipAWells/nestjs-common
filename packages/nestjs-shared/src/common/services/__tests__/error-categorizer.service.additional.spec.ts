import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorCategorizerService } from '../error-categorizer.service.js';

describe('ErrorCategorizerService - Additional Coverage', () => {
	let service: ErrorCategorizerService;
	let mockAppLogger: any;

	const mockModuleRef = {
		get: vi.fn(),
		resolve: () => Promise.resolve({}),
	} as any;

	beforeEach(() => {
		mockAppLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			}),
		};
		mockModuleRef.get.mockReturnValue(mockAppLogger);
		service = new ErrorCategorizerService(mockModuleRef);
	});

	describe('categorizeError - database errors', () => {
		it('should categorize MongoDB connection error as transient', () => {
			const error = new Error('Connection failed to mongodb server');
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.retryable).toBe(true);
			expect(result.strategy).toBe('backoff');
			expect(result.backoffMs).toBeGreaterThan(0);
		});

		it('should categorize Redis connection error as transient', () => {
			const error = new Error('Redis connection timeout');
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.retryable).toBe(true);
		});

		it('should categorize database error as higher priority than timeout', () => {
			// Database errors should be checked before timeout
			const error = new Error('Database connection timeout');
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.strategy).toBe('backoff');
		});
	});

	describe('categorizeError - timeout errors', () => {
		it('should categorize ETIMEDOUT as transient', () => {
			const error = { code: 'ETIMEDOUT', message: 'Connection timed out' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.retryable).toBe(true);
			expect(result.strategy).toBe('backoff');
		});

		it('should categorize timeout in message as transient', () => {
			const error = new Error('Request timeout after 5000ms');
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.retryable).toBe(true);
		});

		it('should be case-insensitive for timeout detection', () => {
			const errors = [
				new Error('TIMEOUT occurred'),
				new Error('Timeout occurred'),
				new Error('timeout occurred'),
			];

			for (const error of errors) {
				const result = service.categorizeError(error);
				expect(result.type).toBe('transient');
			}
		});
	});

	describe('categorizeError - network errors', () => {
		it('should categorize ECONNREFUSED as transient', () => {
			const error = { code: 'ECONNREFUSED', message: 'Connection refused' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.retryable).toBe(true);
			expect(result.strategy).toBe('backoff');
		});

		it('should categorize ENOTFOUND as transient', () => {
			const error = { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND localhost' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
		});

		it('should categorize ECONNRESET as transient', () => {
			const error = { code: 'ECONNRESET', message: 'Connection reset' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
		});

		it('should categorize EPIPE as transient', () => {
			const error = { code: 'EPIPE', message: 'Broken pipe' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
		});

		it('should categorize network in message as transient', () => {
			const errors = [
				new Error('Network error occurred'),
				new Error('NETWORK error'),
				new Error('network error'),
			];

			for (const error of errors) {
				const result = service.categorizeError(error);
				expect(result.type).toBe('transient');
			}
		});

		it('should categorize connection error in message', () => {
			const error = new Error('Connection error: unable to reach server');
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
		});
	});

	describe('categorizeError - server errors', () => {
		it('should categorize 502 Bad Gateway as transient', () => {
			const error = { status: 502, message: 'Bad Gateway' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.retryable).toBe(true);
			expect(result.strategy).toBe('backoff');
		});

		it('should categorize 503 Service Unavailable as transient', () => {
			const error = { status: 503, message: 'Service Unavailable' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.retryable).toBe(true);
		});

		it('should categorize 504 Gateway Timeout as transient', () => {
			const error = { status: 504, message: 'Gateway Timeout' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.retryable).toBe(true);
		});

		it('should have appropriate backoff for server errors', () => {
			const error = { status: 503 };
			const result = service.categorizeError(error);

			expect(result.backoffMs).toBeGreaterThan(0);
		});
	});

	describe('categorizeError - rate limit errors', () => {
		it('should categorize 429 Too Many Requests as transient', () => {
			const error = { status: 429, message: 'Too Many Requests' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.retryable).toBe(true);
			expect(result.strategy).toBe('backoff');
		});

		it('should categorize rate limit message as transient', () => {
			const error = new Error('Rate limit exceeded');
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
		});

		it('should categorize too many requests message as transient', () => {
			const error = new Error('Too many requests from client');
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
		});

		it('should have longest backoff for rate limits', () => {
			const rateLimitError = { status: 429 };
			const timeoutError = { status: 503 };

			const rateLimitResult = service.categorizeError(rateLimitError);
			const timeoutResult = service.categorizeError(timeoutError);

			expect(rateLimitResult.backoffMs).toBeGreaterThan(timeoutResult.backoffMs ?? 0);
		});
	});

	describe('categorizeError - bad request errors', () => {
		it('should categorize 400 Bad Request as permanent', () => {
			const error = { status: 400, message: 'Bad Request' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.retryable).toBe(false);
			expect(result.strategy).toBe('fail');
		});

		it('should categorize 422 Unprocessable Entity as permanent', () => {
			const error = { status: 422, message: 'Unprocessable Entity' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.retryable).toBe(false);
		});
	});

	describe('categorizeError - validation errors', () => {
		it('should categorize validation error by message as permanent', () => {
			const error = new Error('Validation failed: email is required');
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.retryable).toBe(false);
		});

		it('should categorize ValidationError by name as permanent', () => {
			const error = { name: 'ValidationError', message: 'Fields invalid' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
		});

		it('should be case-insensitive for validation detection', () => {
			const errors = [
				new Error('VALIDATION failed'),
				new Error('Validation failed'),
				new Error('validation failed'),
			];

			for (const error of errors) {
				const result = service.categorizeError(error);
				expect(result.type).toBe('permanent');
			}
		});
	});

	describe('categorizeError - authentication errors', () => {
		it('should categorize 401 Unauthorized as permanent', () => {
			const error = { status: 401, message: 'Unauthorized' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.retryable).toBe(false);
		});

		it('should categorize unauthorized message as permanent', () => {
			const error = new Error('Unauthorized access');
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
		});

		it('should categorize authentication message as permanent', () => {
			const error = new Error('Authentication failed');
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
		});

		it('should be case-insensitive for auth detection', () => {
			const errors = [
				new Error('UNAUTHORIZED'),
				new Error('Unauthorized'),
				new Error('unauthorized'),
				new Error('AUTHENTICATION failed'),
				new Error('Authentication failed'),
				new Error('authentication failed'),
			];

			for (const error of errors) {
				const result = service.categorizeError(error);
				expect(result.type).toBe('permanent');
			}
		});
	});

	describe('categorizeError - authorization errors', () => {
		it('should categorize 403 Forbidden as permanent', () => {
			const error = { status: 403, message: 'Forbidden' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.retryable).toBe(false);
		});

		it('should categorize forbidden message as permanent', () => {
			const error = new Error('Access forbidden');
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
		});

		it('should categorize authorization message as permanent', () => {
			const error = new Error('Authorization denied');
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
		});
	});

	describe('categorizeError - not found errors', () => {
		it('should categorize 404 Not Found as permanent', () => {
			const error = { status: 404, message: 'Not Found' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.retryable).toBe(false);
		});

		it('should categorize not found message as permanent', () => {
			const error = new Error('Resource not found');
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
		});

		it('should be case-insensitive for not found detection', () => {
			const errors = [
				new Error('NOT FOUND'),
				new Error('Not Found'),
				new Error('not found'),
			];

			for (const error of errors) {
				const result = service.categorizeError(error);
				expect(result.type).toBe('permanent');
			}
		});
	});

	describe('categorizeError - default behavior', () => {
		it('should categorize unknown error as permanent', () => {
			const error = new Error('Some random error');
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.retryable).toBe(false);
			expect(result.strategy).toBe('fail');
		});

		it('should handle error without message', () => {
			const error = {};
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.retryable).toBe(false);
		});

		it('should handle null error', () => {
			const result = service.categorizeError(null);

			expect(result.type).toBe('permanent');
			expect(result.retryable).toBe(false);
		});

		it('should handle undefined error', () => {
			const result = service.categorizeError(undefined);

			expect(result.type).toBe('permanent');
		});

		it('should convert non-error objects to string', () => {
			const result = service.categorizeError({ some: 'object' });

			expect(result.type).toBe('permanent');
		});
	});

	describe('isRetryable', () => {
		it('should return true for transient errors', () => {
			const error = { code: 'ECONNREFUSED' };
			expect(service.isRetryable(error)).toBe(true);
		});

		it('should return false for permanent errors', () => {
			const error = { status: 404 };
			expect(service.isRetryable(error)).toBe(false);
		});

		it('should return false for unknown errors', () => {
			const error = new Error('Unknown');
			expect(service.isRetryable(error)).toBe(false);
		});
	});

	describe('logging methods', () => {
		it('should log recovery attempts', () => {
			const error = { code: 'ECONNREFUSED' };
			service.logRecoveryAttempt(error, 1, 3);

			expect(service.Logger.info).toHaveBeenCalled();
		});

		it('should log recovery success', () => {
			const error = { code: 'ECONNREFUSED' };
			service.logRecoverySuccess(error, 2);

			expect(service.Logger.info).toHaveBeenCalled();
		});

		it('should log recovery failure', () => {
			const error = { code: 'ECONNREFUSED' };
			service.logRecoveryFailed(error, 3);

			expect(service.Logger.error).toHaveBeenCalled();
		});
	});

	describe('error priority ordering', () => {
		it('should check database errors before timeout errors', () => {
			// Error message contains both "database" and "timeout"
			const error = new Error('Database connection timeout');
			const result = service.categorizeError(error);

			// Should be categorized as database error (higher priority)
			expect(result.type).toBe('transient');
		});

		it('should check timeout errors before network errors', () => {
			const error = { code: 'ETIMEDOUT', message: 'connection network error' };
			const result = service.categorizeError(error);

			// Should be categorized as timeout (checked first)
			expect(result.strategy).toBe('backoff');
		});

		it('should check bad request before validation', () => {
			const error = { status: 400, message: 'validation failed' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
		});

		it('should check auth before authz', () => {
			const error = { status: 401, message: 'authentication and authorization' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
		});
	});

	describe('edge cases', () => {
		it('should handle error with only status code', () => {
			const error = { status: 503 };
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
		});

		it('should handle error with only code property', () => {
			const error = { code: 'ECONNREFUSED' };
			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
		});

		it('should handle error with empty message', () => {
			const error = { message: '', status: 500 };
			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
		});

		it('should handle error with very long message', () => {
			const error = { message: 'a'.repeat(10000), status: 500 };
			const result = service.categorizeError(error);

			expect(result).toBeDefined();
		});
	});

	describe('backoff ms values', () => {
		it('should have appropriate backoff for retry strategy', () => {
			const error = { code: 'ECONNREFUSED' };
			const result = service.categorizeError(error);

			expect(result.backoffMs).toBe(1000);
		});

		it('should have appropriate backoff for timeout', () => {
			const error = { code: 'ETIMEDOUT' };
			const result = service.categorizeError(error);
			expect(result.backoffMs).toBe(1000);
		});

		it('should have appropriate backoff for database error', () => {
			const error = new Error('Database connection failed');
			const result = service.categorizeError(error);

			expect(result.backoffMs).toBe(5000);
		});

		it('should have appropriate backoff for rate limit', () => {
			const error = { status: 429 };
			const result = service.categorizeError(error);

			expect(result.backoffMs).toBe(10000);
		});

		it('should not have backoff for permanent errors', () => {
			const error = { status: 404 };
			const result = service.categorizeError(error);

			expect(result.backoffMs).toBeUndefined();
		});
	});
});
