import { GlobalExceptionFilter } from '../global-exception.filter.js';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AppLogger } from '../../services/logger.service.js';
import { ErrorSanitizerService } from '../../services/error-sanitizer.service.js';
import { ErrorCategorizerService } from '../../services/error-categorizer.service.js';
import { BaseApplicationError } from '../../errors/base-application-error.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('GlobalExceptionFilter', () => {
	let filter: GlobalExceptionFilter;
	let mockLogger: any;
	let mockErrorSanitizer: any;
	let mockErrorCategorizer: any;

	beforeEach(() => {
		mockLogger = {
			debug() {},
			error() {},
		};
		mockErrorSanitizer = {
			sanitizeErrorResponse(errorResponse: any) {
				return errorResponse;
			},
		};
		mockErrorCategorizer = {
			categorizeError() {
				return {
					type: 'GENERIC_ERROR',
					retryable: false,
					strategy: 'NONE',
					backoffMs: 0,
				};
			},
		};

		filter = new GlobalExceptionFilter(
			mockLogger as AppLogger,
			mockErrorSanitizer as ErrorSanitizerService,
			mockErrorCategorizer as ErrorCategorizerService,
		);
	});

	it('should be defined', () => {
		expect(filter).toBeDefined();
	});

	describe('catch', () => {
		let mockResponse: any;
		let mockRequest: any;
		let mockHost: any;

		beforeEach(() => {
			mockResponse = {
				status(code: number) {
					this.statusCode = code;
					return this;
				},
				json(data: any) {
					this.responseData = data;
				},
				statusCode: 0,
				responseData: null,
			};

			mockRequest = {
				url: '/api/test',
				method: 'GET',
				get(header: string) {
					if (header === 'User-Agent') return 'TestAgent/1.0';
					return '';
				},
				ip: '127.0.0.1',
			};

			mockHost = {
				getType() {
					return 'http';
				},
				switchToHttp() {
					return {
						getResponse() {
							return mockResponse;
						},
						getRequest() {
							return mockRequest;
						},
					};
				},
			};
		});

		describe('HTTP Context', () => {
			beforeEach(() => {
				mockHost.getType = function() {
					return 'http';
				};
			});

			describe('BaseApplicationError', () => {
				it('should handle BaseApplicationError in development', () => {
					const originalEnv = process.env['NODE_ENV'];
					process.env['NODE_ENV'] = 'development';

					const error = new BaseApplicationError('Test error message', {
						code: 'TEST_ERROR',
						statusCode: 400,
					});

					mockErrorCategorizer.categorizeError = function() {
						return {
							type: 'APPLICATION_ERROR',
							retryable: false,
							strategy: 'NONE',
							backoffMs: 0,
						};
					};

					filter.catch(error, mockHost);

					expect(mockResponse.statusCode).toBe(400);
					expect(mockResponse.responseData.success).toBe(false);
					expect(mockResponse.responseData.error.code).toBe('TEST_ERROR');
					expect(mockResponse.responseData.error.message).toBe('Test error message');
					expect(mockResponse.responseData.error.context).toBeDefined();
					expect(mockResponse.responseData.error.stack).toBeDefined();

					process.env['NODE_ENV'] = originalEnv;
				});

				it('should handle BaseApplicationError in production', () => {
					const originalEnv = process.env['NODE_ENV'];
					process.env['NODE_ENV'] = 'production';

					const error = new BaseApplicationError('Test error message', {
						code: 'TEST_ERROR',
						statusCode: 400,
					});

					mockErrorCategorizer.categorizeError = function() {
						return {
							type: 'APPLICATION_ERROR',
							retryable: false,
							strategy: 'NONE',
							backoffMs: 0,
						};
					};

					filter.catch(error, mockHost);

					expect(mockResponse.statusCode).toBe(400);
					expect(mockResponse.responseData.success).toBe(false);
					expect(mockResponse.responseData.error.code).toBe('TEST_ERROR');
					expect(mockResponse.responseData.error.message).toBe('Test error message');
					expect(mockResponse.responseData.error.context).toBeUndefined();
					expect(mockResponse.responseData.error.stack).toBeUndefined();

					process.env['NODE_ENV'] = originalEnv;
				});

				it('should include timestamp in error response', () => {
					const error = new BaseApplicationError('Test error', {
						code: 'TEST_ERROR',
						statusCode: 400,
					});

					filter.catch(error, mockHost);

					expect(mockResponse.responseData.error.timestamp).toBeDefined();
					expect(typeof mockResponse.responseData.error.timestamp).toBe('string');
				});
			});

			describe('HttpException', () => {
				it('should not handle HttpException (delegated to HttpExceptionFilter)', () => {
					const exception = new HttpException('HTTP error', HttpStatus.NOT_FOUND);

					// GlobalExceptionFilter with @Catch(BaseApplicationError, Error) does not catch HttpException
					// HttpExceptionFilter handles those instead
					filter.catch(exception as any, mockHost);
					// Default status should be 500 (not 404) since it's treated as unknown
					expect(mockResponse.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
				});
			});

			describe('Generic Error', () => {
				it('should handle generic Error in development environment', () => {
					const originalEnv = process.env['NODE_ENV'];
					process.env['NODE_ENV'] = 'development';

					const error = new Error('Generic error message');
					error.stack = 'Error: Generic error message\n    at test.ts:1';

					mockErrorCategorizer.categorizeError = function() {
						return {
							type: 'GENERIC_ERROR',
							retryable: false,
							strategy: 'NONE',
							backoffMs: 0,
						};
					};

					filter.catch(error, mockHost);

					expect(mockResponse.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
					expect(mockResponse.responseData.success).toBe(false);
					expect(mockResponse.responseData.error.code).toBe('INTERNAL_SERVER_ERROR');
					expect(mockResponse.responseData.error.message).toBe('Generic error message');
					expect(mockResponse.responseData.error.stack).toBeDefined();

					process.env['NODE_ENV'] = originalEnv;
				});

				it('should hide error details in production environment', () => {
					const originalEnv = process.env['NODE_ENV'];
					process.env['NODE_ENV'] = 'production';

					const error = new Error('Sensitive error information');

					mockErrorCategorizer.categorizeError = function() {
						return {
							type: 'GENERIC_ERROR',
							retryable: false,
							strategy: 'NONE',
							backoffMs: 0,
						};
					};

					filter.catch(error, mockHost);

					expect(mockResponse.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
					expect(mockResponse.responseData.error.message).toBe('An unexpected error occurred');
					expect(mockResponse.responseData.error.stack).toBeUndefined();

					process.env['NODE_ENV'] = originalEnv;
				});

				it('should set 500 status code for generic errors', () => {
					const error = new Error('Generic error');

					filter.catch(error, mockHost);

					expect(mockResponse.statusCode).toBe(500);
				});
			});

			describe('Unknown Exception Type', () => {
				it('should handle non-Error exception objects', () => {
					const unknownException = { custom: 'object' };

					mockErrorCategorizer.categorizeError = function() {
						return {
							type: 'unknown',
							retryable: false,
							strategy: 'none',
							backoffMs: 0,
						};
					};

					filter.catch(unknownException, mockHost);

					expect(mockResponse.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
					expect(mockResponse.responseData.success).toBe(false);
					expect(mockResponse.responseData.error.code).toBe('UNKNOWN_ERROR');
				});

				it('should convert unknown exception to string in development', () => {
					const originalEnv = process.env['NODE_ENV'];
					process.env['NODE_ENV'] = 'development';

					const unknownException = 'string exception';

					mockErrorCategorizer.categorizeError = function() {
						return {
							type: 'unknown',
							retryable: false,
							strategy: 'none',
							backoffMs: 0,
						};
					};

					filter.catch(unknownException, mockHost);

					expect(mockResponse.responseData.error.message).toBe('string exception');

					process.env['NODE_ENV'] = originalEnv;
				});

				it('should hide message for unknown exceptions in production', () => {
					const originalEnv = process.env['NODE_ENV'];
					process.env['NODE_ENV'] = 'production';

					const unknownException = { custom: 'object' };

					mockErrorCategorizer.categorizeError = function() {
						return {
							type: 'unknown',
							retryable: false,
							strategy: 'none',
							backoffMs: 0,
						};
					};

					filter.catch(unknownException, mockHost);

					expect(mockResponse.responseData.error.message).toBe('An unexpected error occurred');

					process.env['NODE_ENV'] = originalEnv;
				});
			});

			describe('Error Categorization and Logging', () => {
				it('should call errorCategorizer for each exception type', () => {
					let categorizerCalled = false;

					mockErrorCategorizer.categorizeError = function() {
						categorizerCalled = true;
						return {
							type: 'TEST_TYPE',
							retryable: true,
							strategy: 'exponential_backoff',
							backoffMs: 1000,
						};
					};

					const error = new Error('Test error');
					filter.catch(error, mockHost);

					expect(categorizerCalled).toBe(true);
				});

				it('should log error with categorization details', () => {
					let loggedData: any = null;

					mockLogger.error = function(_msg: string, _a: any, _b: any, data: any) {
						loggedData = data;
					};

					mockErrorCategorizer.categorizeError = function() {
						return {
							type: 'TEST_ERROR_TYPE',
							retryable: true,
							strategy: 'retry',
							backoffMs: 2000,
						};
					};

					const error = new Error('Test error message');
					filter.catch(error, mockHost);

					expect(loggedData).toBeDefined();
					expect(loggedData.message).toBe('Test error message');
					expect(loggedData.errorType).toBe('TEST_ERROR_TYPE');
					expect(loggedData.retryable).toBe(true);
					expect(loggedData.strategy).toBe('retry');
					expect(loggedData.backoffMs).toBe(2000);
				});

				it('should include request context in error logs', () => {
					let loggedData: any = null;

					mockLogger.error = function(_msg: string, _a: any, _b: any, data: any) {
						loggedData = data;
					};

					const error = new Error('Test error');
					filter.catch(error, mockHost);

					expect(loggedData.url).toBe('/api/test');
					expect(loggedData.method).toBe('GET');
					expect(loggedData.ip).toBe('127.0.0.1');
					expect(loggedData.userAgent).toBe('TestAgent/1.0');
				});

				it('should sanitize error response', () => {
					let sanitizedCalled = false;
					let sanitizeInput: any = null;

					mockErrorSanitizer.sanitizeErrorResponse = function(input: any, isDev: boolean) {
						sanitizedCalled = true;
						sanitizeInput = { input, isDev };
						return input;
					};

					const error = new Error('Test error');
					filter.catch(error, mockHost);

					expect(sanitizedCalled).toBe(true);
					expect(sanitizeInput.input).toBeDefined();
				});
			});

			describe('Status Code Mapping', () => {
				it('should use correct status code for BaseApplicationError', () => {
					const error = new BaseApplicationError('Validation failed', {
						code: 'VALIDATION_ERROR',
						statusCode: 422,
					});

					filter.catch(error, mockHost);

					expect(mockResponse.statusCode).toBe(422);
				});

				it('should use 500 for generic Error', () => {
					const error = new Error('Generic error');

					filter.catch(error, mockHost);

					expect(mockResponse.statusCode).toBe(500);
				});

				it('should use 500 for unknown exception types', () => {
					filter.catch('string exception', mockHost);

					expect(mockResponse.statusCode).toBe(500);
				});
			});

			describe('Response Format', () => {
				it('should include success: false in response', () => {
					const error = new Error('Test error');

					filter.catch(error, mockHost);

					expect(mockResponse.responseData.success).toBe(false);
				});

				it('should include error object with required fields', () => {
					const error = new Error('Test error');

					filter.catch(error, mockHost);

					expect(mockResponse.responseData.error).toBeDefined();
					expect(mockResponse.responseData.error.code).toBeDefined();
					expect(mockResponse.responseData.error.message).toBeDefined();
					expect(mockResponse.responseData.error.timestamp).toBeDefined();
				});

				it('should exclude development fields in production', () => {
					const originalEnv = process.env['NODE_ENV'];
					process.env['NODE_ENV'] = 'production';

					const error = new Error('Test error');

					filter.catch(error, mockHost);

					expect(mockResponse.responseData.error.stack).toBeUndefined();

					process.env['NODE_ENV'] = originalEnv;
				});
			});
		});
	});
});
