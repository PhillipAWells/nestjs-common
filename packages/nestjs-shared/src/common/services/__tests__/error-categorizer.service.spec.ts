import { ErrorCategorizerService } from '../error-categorizer.service.js';
import { AppLogger } from '../logger.service.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Test constants for error categorization
const RETRY_BACKOFF_MS = 1000;
const TIMEOUT_BACKOFF_MS = 2000;
const DATABASE_BACKOFF_MS = 5000;
const RATE_LIMIT_BACKOFF_MS = 10000;
const ATTEMPT_COUNT = 3;
const MAX_ATTEMPTS = 5;

describe('ErrorCategorizerService', () => {
	let service: ErrorCategorizerService;
	let mockModuleRef: any;
	let mockAppLogger: any;

	beforeEach(() => {
		mockAppLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			createContextualLogger: vi.fn(() => ({
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			})),
		};

		mockModuleRef = {
			get: (token: any) => {
				if (token === AppLogger) return mockAppLogger;
				return undefined;
			},
		};

		service = new ErrorCategorizerService(mockModuleRef);
		// Mock the logger property
		Object.defineProperty(service, '_contextualLogger', {
			value: mockAppLogger,
			writable: true,
		});
	});

	describe('categorizeError', () => {
		describe('network errors (transient)', () => {
			it('should categorize ECONNREFUSED as transient', () => {
				const error = new Error('Connection refused');
				(error as any).code = 'ECONNREFUSED';

				const result = service.categorizeError(error);

				expect(result.type).toBe('transient');
				expect(result.retryable).toBe(true);
				expect(result.strategy).toBe('backoff');
				expect(result.backoffMs).toBe(RETRY_BACKOFF_MS);
			});

			it('should categorize ENOTFOUND as transient', () => {
				const error = new Error('Not found');
				(error as any).code = 'ENOTFOUND';

				const result = service.categorizeError(error);

				expect(result.type).toBe('transient');
				expect(result.retryable).toBe(true);
				expect(result.strategy).toBe('backoff');
			});

			it('should categorize ECONNRESET as transient', () => {
				const error = new Error('Connection reset');
				(error as any).code = 'ECONNRESET';

				const result = service.categorizeError(error);

				expect(result.type).toBe('transient');
				expect(result.retryable).toBe(true);
			});

			it('should categorize network error by message', () => {
				const error = new Error('Network error occurred');

				const result = service.categorizeError(error);

				expect(result.type).toBe('transient');
				expect(result.strategy).toBe('retry');
			});

			it('should categorize connection error by message', () => {
				const error = new Error('Connection lost to server');

				const result = service.categorizeError(error);

				expect(result.type).toBe('transient');
				expect(result.retryable).toBe(true);
			});
		});

		describe('timeout errors (transient)', () => {
			it('should categorize ETIMEDOUT as transient with backoff', () => {
				const error = new Error('Operation timed out');
				(error as any).code = 'ETIMEDOUT';

				const result = service.categorizeError(error);

				expect(result.type).toBe('transient');
				expect(result.retryable).toBe(true);
				expect(result.strategy).toBe('backoff');
				expect(result.backoffMs).toBe(RETRY_BACKOFF_MS);
			});

			it('should categorize timeout message as transient', () => {
				const error = new Error('Request timeout after 5s');

				const result = service.categorizeError(error);

				expect(result.type).toBe('transient');
				expect(result.strategy).toBe('backoff');
			});
		});

		describe('database errors (transient)', () => {
			it('should categorize database connection error as transient', () => {
				const error = new Error('MongoDB connection failed');

				const result = service.categorizeError(error);

				expect(result.type).toBe('transient');
				expect(result.retryable).toBe(true);
				expect(result.strategy).toBe('backoff');
				expect(result.backoffMs).toBe(DATABASE_BACKOFF_MS);
			});

			it('should categorize Redis connection error as transient', () => {
				const error = new Error('Redis connection timeout');

				const result = service.categorizeError(error);

				expect(result.type).toBe('transient');
				expect(result.retryable).toBe(true);
				expect(result.backoffMs).toBe(DATABASE_BACKOFF_MS);
			});

			it('should categorize generic database error as transient', () => {
				const error = new Error('Database connection refused');

				const result = service.categorizeError(error);

				expect(result.type).toBe('transient');
				expect(result.retryable).toBe(true);
			});
		});

		describe('validation errors (permanent)', () => {
			it('should categorize validation error message as permanent', () => {
				const error = new Error('Validation failed: invalid email');

				const result = service.categorizeError(error);

				expect(result.type).toBe('permanent');
				expect(result.retryable).toBe(false);
				expect(result.strategy).toBe('fail');
			});

			it('should categorize 400 status code as permanent', () => {
				const error = new Error('Bad request');
				(error as any).status = 400;

				const result = service.categorizeError(error);

				expect(result.type).toBe('permanent');
				expect(result.retryable).toBe(false);
			});

			it('should categorize ValidationError name as permanent', () => {
				const error = new Error('Invalid input');
				(error as any).name = 'ValidationError';

				const result = service.categorizeError(error);

				expect(result.type).toBe('permanent');
				expect(result.strategy).toBe('fail');
			});
		});

		describe('authentication errors (permanent)', () => {
			it('should categorize 401 status code as permanent', () => {
				const error = new Error('Unauthorized');
				(error as any).status = 401;

				const result = service.categorizeError(error);

				expect(result.type).toBe('permanent');
				expect(result.retryable).toBe(false);
				expect(result.strategy).toBe('fail');
			});

			it('should categorize unauthorized message as permanent', () => {
				const error = new Error('Invalid credentials');

				const result = service.categorizeError(error);

				expect(result.type).toBe('permanent');
				expect(result.strategy).toBe('fail');
			});

			it('should categorize authentication error message as permanent', () => {
				const error = new Error('Authentication failed: token expired');

				const result = service.categorizeError(error);

				expect(result.type).toBe('permanent');
				expect(result.retryable).toBe(false);
			});
		});

		describe('authorization errors (permanent)', () => {
			it('should categorize 403 status code as permanent', () => {
				const error = new Error('Forbidden');
				(error as any).status = 403;

				const result = service.categorizeError(error);

				expect(result.type).toBe('permanent');
				expect(result.retryable).toBe(false);
				expect(result.strategy).toBe('fail');
			});

			it('should categorize forbidden message as permanent', () => {
				const error = new Error('Access forbidden');

				const result = service.categorizeError(error);

				expect(result.type).toBe('permanent');
				expect(result.strategy).toBe('fail');
			});

			it('should categorize authorization message as permanent', () => {
				const error = new Error('Authorization required: admin role');

				const result = service.categorizeError(error);

				expect(result.type).toBe('permanent');
				expect(result.retryable).toBe(false);
			});
		});

		describe('not found errors (permanent)', () => {
			it('should categorize 404 status code as permanent', () => {
				const error = new Error('Not found');
				(error as any).status = 404;

				const result = service.categorizeError(error);

				expect(result.type).toBe('permanent');
				expect(result.retryable).toBe(false);
				expect(result.strategy).toBe('fail');
			});

			it('should categorize not found message as permanent', () => {
				const error = new Error('User not found');

				const result = service.categorizeError(error);

				expect(result.type).toBe('permanent');
				expect(result.strategy).toBe('fail');
			});
		});

		describe('rate limit errors (transient)', () => {
			it('should categorize 429 status code as transient', () => {
				const error = new Error('Too many requests');
				(error as any).status = 429;

				const result = service.categorizeError(error);

				expect(result.type).toBe('transient');
				expect(result.retryable).toBe(true);
				expect(result.strategy).toBe('backoff');
				expect(result.backoffMs).toBe(RATE_LIMIT_BACKOFF_MS);
			});

			it('should categorize rate limit message as transient', () => {
				const error = new Error('Rate limit exceeded');

				const result = service.categorizeError(error);

				expect(result.type).toBe('transient');
				expect(result.retryable).toBe(true);
				expect(result.backoffMs).toBe(RATE_LIMIT_BACKOFF_MS);
			});

			it('should categorize too many requests message as transient', () => {
				const error = new Error('Too many requests to API');

				const result = service.categorizeError(error);

				expect(result.type).toBe('transient');
				expect(result.strategy).toBe('backoff');
			});
		});

		describe('unknown errors (permanent default)', () => {
			it('should categorize unknown error as permanent', () => {
				const error = new Error('Unknown error');

				const result = service.categorizeError(error);

				expect(result.type).toBe('permanent');
				expect(result.retryable).toBe(false);
				expect(result.strategy).toBe('fail');
			});

			it('should handle null error', () => {
				const result = service.categorizeError(null);

				expect(result.type).toBe('permanent');
				expect(result.retryable).toBe(false);
			});

			it('should handle undefined error', () => {
				const result = service.categorizeError(undefined);

				expect(result.type).toBe('permanent');
				expect(result.retryable).toBe(false);
			});

			it('should handle string error', () => {
				const result = service.categorizeError('Some error string');

				expect(result.type).toBe('permanent');
				expect(result.retryable).toBe(false);
			});
		});

		describe('logging behavior', () => {
			it('should log debug for categorized transient errors', () => {
				const error = new Error('Connection refused');
				(error as any).code = 'ECONNREFUSED';

				service.categorizeError(error);

				expect(mockAppLogger.debug).toHaveBeenCalledWith(
					'Categorized as transient network error (Node.js error code)',
					expect.any(Object),
				);
			});

			it('should log debug for categorized permanent errors', () => {
				const error = new Error('Validation failed');

				service.categorizeError(error);

				expect(mockAppLogger.debug).toHaveBeenCalledWith(
					'Categorized as permanent validation error',
					expect.any(Object),
				);
			});

			it('should log warn for uncategorized errors', () => {
				const error = new Error('Strange error');

				service.categorizeError(error);

				expect(mockAppLogger.warn).toHaveBeenCalledWith(
					'Uncategorized error treated as permanent',
					expect.any(Object),
				);
			});
		});
	});

	describe('logRecoveryAttempt', () => {
		it('should log recovery attempt with error details', () => {
			const error = new Error('Connection error');
			(error as any).code = 'ECONNREFUSED';

			service.logRecoveryAttempt(error, ATTEMPT_COUNT - 2, ATTEMPT_COUNT);

			expect(mockAppLogger.info).toHaveBeenCalledWith(
				'Error recovery attempt',
				expect.objectContaining({ attempt: expect.any(Number) }),
			);
		});

		it('should include attempt count in log', () => {
			const error = new Error('Timeout');
			(error as any).code = 'ETIMEDOUT';

			service.logRecoveryAttempt(error, 2, MAX_ATTEMPTS);

			expect(mockAppLogger.info).toHaveBeenCalledWith(
				'Error recovery attempt',
				expect.objectContaining({ attempt: 2 }),
			);
		});

		it('should include max attempts in log', () => {
			const error = new Error('Failed');

			service.logRecoveryAttempt(error, ATTEMPT_COUNT, MAX_ATTEMPTS);

			expect(mockAppLogger.info).toHaveBeenCalledWith(
				'Error recovery attempt',
				expect.objectContaining({ maxAttempts: 5 }),
			);
		});

		it('should include error category and strategy', () => {
			const error = new Error('Network issue');

			service.logRecoveryAttempt(error, ATTEMPT_COUNT - 2, ATTEMPT_COUNT);

			expect(mockAppLogger.info).toHaveBeenCalledWith(
				'Error recovery attempt',
				expect.objectContaining({ strategy: expect.any(String) }),
			);
		});
	});

	describe('logRecoverySuccess', () => {
		it('should log successful recovery', () => {
			const error = new Error('Connection error');

			service.logRecoverySuccess(error, 2);

			expect(mockAppLogger.info).toHaveBeenCalledWith(
				'Error recovery successful',
				expect.any(Object),
			);
		});

		it('should include attempt count in success log', () => {
			const error = new Error('Failed request');

			service.logRecoverySuccess(error, ATTEMPT_COUNT);

			expect(mockAppLogger.info).toHaveBeenCalledWith(
				'Error recovery successful',
				expect.objectContaining({ attempts: ATTEMPT_COUNT }),
			);
		});

		it('should include error message in success log', () => {
			const error = new Error('Timeout error');

			service.logRecoverySuccess(error, ATTEMPT_COUNT - 2);

			expect(mockAppLogger.info).toHaveBeenCalledWith(
				'Error recovery successful',
				expect.objectContaining({ error: 'Timeout error' }),
			);
		});
	});

	describe('logRecoveryFailed', () => {
		it('should log failed recovery', () => {
			const error = new Error('Validation error');

			service.logRecoveryFailed(error, MAX_ATTEMPTS);

			expect(mockAppLogger.error).toHaveBeenCalledWith(
				'Error recovery failed', undefined, undefined,
				expect.any(Object),
			);
		});

		it('should include attempt count in failure log', () => {
			const error = new Error('Invalid data');

			service.logRecoveryFailed(error, MAX_ATTEMPTS);

			expect(mockAppLogger.error).toHaveBeenCalledWith(
				'Error recovery failed', undefined, undefined,
				expect.objectContaining({ attempts: MAX_ATTEMPTS }),
			);
		});

		it('should include error type and retryable status', () => {
			const error = new Error('Auth error');
			(error as any).status = 401;

			service.logRecoveryFailed(error, ATTEMPT_COUNT);

			expect(mockAppLogger.error).toHaveBeenCalledWith(
				'Error recovery failed', undefined, undefined,
				expect.objectContaining({ errorType: expect.any(String) }),
			);
		});

		it('should include retryable status for transient errors', () => {
			const error = new Error('Timeout');
			(error as any).code = 'ETIMEDOUT';

			service.logRecoveryFailed(error, MAX_ATTEMPTS);

			expect(mockAppLogger.error).toHaveBeenCalledWith(
				'Error recovery failed', undefined, undefined,
				expect.objectContaining({ retryable: expect.any(Boolean) }),
			);
		});
	});

	describe('error edge cases', () => {
		it('should handle errors with both code and message matching', () => {
			const error = new Error('Network connection timeout');
			(error as any).code = 'ETIMEDOUT';

			const result = service.categorizeError(error);

			// Should categorize based on code first (ETIMEDOUT) - returns 1000ms for network code
			expect(result.strategy).toBe('backoff');
			expect(result.backoffMs).toBe(RETRY_BACKOFF_MS);
		});

		it('should handle case-insensitive message matching', () => {
			const error1 = new Error('NETWORK ERROR');
			const error2 = new Error('Network Error');
			const error3 = new Error('network error');

			const result1 = service.categorizeError(error1);
			const result2 = service.categorizeError(error2);
			const result3 = service.categorizeError(error3);

			expect(result1.type).toBe(result2.type);
			expect(result2.type).toBe(result3.type);
			expect(result1.type).toBe('transient');
		});

		it('should handle missing error.code and error.status', () => {
			const error = new Error('Some error');
			delete (error as any).code;
			delete (error as any).status;

			const result = service.categorizeError(error);

			expect(result).toBeDefined();
			expect(result.type).toBeDefined();
		});

		it('should categorize based on priority: code > status > message', () => {
			// Create error with conflicting signals
			const error = new Error('Validation error');
			(error as any).code = 'ECONNREFUSED'; // Network (transient)
			(error as any).status = 400; // Validation (permanent)

			const result = service.categorizeError(error);

			// Should categorize as network error (code has priority)
			expect(result.type).toBe('transient');
		});
	});

	describe('server errors (transient)', () => {
		it('should categorize 502 Bad Gateway as transient', () => {
			const error = new Error('Bad gateway');
			(error as any).status = 502;

			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.retryable).toBe(true);
			expect(result.strategy).toBe('backoff');
			expect(result.backoffMs).toBe(TIMEOUT_BACKOFF_MS);
		});

		it('should categorize 503 Service Unavailable as transient', () => {
			const error = new Error('Service unavailable');
			(error as any).status = 503;

			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.retryable).toBe(true);
			expect(result.strategy).toBe('backoff');
		});

		it('should categorize 504 Gateway Timeout as transient', () => {
			const error = new Error('Gateway timeout');
			(error as any).status = 504;

			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.retryable).toBe(true);
			expect(result.strategy).toBe('backoff');
		});
	});

	describe('additional network errors', () => {
		it('should categorize EPIPE as transient network error', () => {
			const error = new Error('Broken pipe');
			(error as any).code = 'EPIPE';

			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.retryable).toBe(true);
			expect(result.strategy).toBe('retry');
		});

		it('should categorize error by status code 422 Unprocessable Entity', () => {
			const error = new Error('Unprocessable entity');
			(error as any).status = 422;

			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.retryable).toBe(false);
			expect(result.strategy).toBe('fail');
		});
	});

	describe('isRetryable', () => {
		it('should return true for transient errors', () => {
			const error = new Error('Connection refused');
			(error as any).code = 'ECONNREFUSED';

			const result = service.isRetryable(error);

			expect(result).toBe(true);
		});

		it('should return false for permanent errors', () => {
			const error = new Error('Unauthorized');
			(error as any).status = 401;

			const result = service.isRetryable(error);

			expect(result).toBe(false);
		});

		it('should return false for unknown errors', () => {
			const error = new Error('Unknown');

			const result = service.isRetryable(error);

			expect(result).toBe(false);
		});
	});

	describe('Logger property', () => {
		it('should provide contextual logger', () => {
			const logger = service.Logger;

			expect(logger).toBeDefined();
			expect(typeof logger.debug).toBe('function');
			expect(typeof logger.info).toBe('function');
			expect(typeof logger.warn).toBe('function');
			expect(typeof logger.error).toBe('function');
		});

		it('should memoize logger on first access', () => {
			const logger1 = service.Logger;
			const logger2 = service.Logger;

			expect(logger1).toBe(logger2);
		});
	});

	describe('specific error type detection branches', () => {
		it('should detect EPIPE network error code', () => {
			const error = new Error('Broken pipe');
			(error as any).code = 'EPIPE';

			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.strategy).toBe('retry');
		});

		it('should detect connection message containing "connection"', () => {
			const error = new Error('Connection lost to service');

			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
		});

		it('should detect both database and connection in message', () => {
			const error = new Error('Database connection timeout');

			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.strategy).toBe('backoff');
			expect(result.backoffMs).toBe(DATABASE_BACKOFF_MS);
		});

		it('should prioritize timeout over network for ETIMEDOUT code', () => {
			const error = new Error('Network timeout occurred');
			(error as any).code = 'ETIMEDOUT';

			const result = service.categorizeError(error);

			// Should be network category (Node.js error code has priority)
			expect(result.strategy).toBe('backoff');
			expect(result.backoffMs).toBe(RETRY_BACKOFF_MS);
		});

		it('should detect database error with MongoDB mention', () => {
			const error = new Error('MongoDB connection pool exhausted');

			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.strategy).toBe('backoff');
		});

		it('should detect database error with Redis mention', () => {
			const error = new Error('Redis connection refused');

			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.strategy).toBe('backoff');
		});

		it('should detect 400 status as bad request', () => {
			const error = new Error('Invalid request body');
			(error as any).status = 400;

			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.retryable).toBe(false);
		});

		it('should detect "unauthorized" in message', () => {
			const error = new Error('User is unauthorized to access');

			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.strategy).toBe('fail');
		});

		it('should detect "authentication" in message', () => {
			const error = new Error('Authentication failed for user');

			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.retryable).toBe(false);
		});

		it('should detect "forbidden" in message', () => {
			const error = new Error('Access is forbidden');

			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.strategy).toBe('fail');
		});

		it('should detect "authorization" in message', () => {
			const error = new Error('Authorization check failed');

			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.retryable).toBe(false);
		});

		it('should detect "not found" in message for 404', () => {
			const error = new Error('Resource not found');

			const result = service.categorizeError(error);

			expect(result.type).toBe('permanent');
			expect(result.strategy).toBe('fail');
		});

		it('should detect "too many requests" in message', () => {
			const error = new Error('Too many requests to API');

			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
			expect(result.strategy).toBe('backoff');
		});

		it('should handle error with only status code, no message', () => {
			const error = new Error();
			(error as any).status = 500;

			const result = service.categorizeError(error);

			// Without message, defaults to permanent
			expect(result.type).toBe('permanent');
		});

		it('should handle error with code but no status', () => {
			const error = new Error('Test error');
			(error as any).code = 'ECONNREFUSED';

			const result = service.categorizeError(error);

			expect(result.type).toBe('transient');
		});
	});

	describe('categorizeError logging branches', () => {
		it('should log debug message for network errors', () => {
			const error = new Error('ECONNREFUSED');
			(error as any).code = 'ECONNREFUSED';

			service.categorizeError(error);

			expect(mockAppLogger.debug).toHaveBeenCalledWith(
				'Categorized as transient network error (Node.js error code)',
				expect.any(Object),
			);
		});

		it('should log debug message for timeout errors', () => {
			const error = new Error('Request timeout');
			(error as any).code = 'ETIMEDOUT';

			service.categorizeError(error);

			expect(mockAppLogger.debug).toHaveBeenCalledWith(
				'Categorized as transient network error (Node.js error code)',
				expect.any(Object),
			);
		});

		it('should log debug message for database errors', () => {
			const error = new Error('MongoDB connection failed');

			service.categorizeError(error);

			expect(mockAppLogger.debug).toHaveBeenCalledWith(
				'Categorized as transient database error',
				expect.any(Object),
			);
		});

		it('should log debug message for server errors (502)', () => {
			const error = new Error('Bad Gateway');
			(error as any).status = 502;

			service.categorizeError(error);

			expect(mockAppLogger.debug).toHaveBeenCalledWith(
				'Categorized as transient server error',
				expect.any(Object),
			);
		});

		it('should log debug message for rate limit errors', () => {
			const error = new Error('Rate limit exceeded');
			(error as any).status = 429;

			service.categorizeError(error);

			expect(mockAppLogger.debug).toHaveBeenCalledWith(
				'Categorized as transient rate limit error',
				expect.any(Object),
			);
		});

		it('should log debug message for bad request errors', () => {
			const error = new Error('Invalid data');
			(error as any).status = 400;

			service.categorizeError(error);

			expect(mockAppLogger.debug).toHaveBeenCalledWith(
				'Categorized as permanent bad request error',
				expect.any(Object),
			);
		});

		it('should log debug message for validation errors', () => {
			const error = new Error('Validation failed');

			service.categorizeError(error);

			expect(mockAppLogger.debug).toHaveBeenCalledWith(
				'Categorized as permanent validation error',
				expect.any(Object),
			);
		});

		it('should log debug message for auth errors', () => {
			const error = new Error('Unauthorized access');
			(error as any).status = 401;

			service.categorizeError(error);

			expect(mockAppLogger.debug).toHaveBeenCalledWith(
				'Categorized as permanent authentication error',
				expect.any(Object),
			);
		});

		it('should log debug message for authz errors', () => {
			const error = new Error('Forbidden');
			(error as any).status = 403;

			service.categorizeError(error);

			expect(mockAppLogger.debug).toHaveBeenCalledWith(
				'Categorized as permanent authorization error',
				expect.any(Object),
			);
		});

		it('should log debug message for not found errors', () => {
			const error = new Error('Resource not found');
			(error as any).status = 404;

			service.categorizeError(error);

			expect(mockAppLogger.debug).toHaveBeenCalledWith(
				'Categorized as permanent not found error',
				expect.any(Object),
			);
		});
	});
});
