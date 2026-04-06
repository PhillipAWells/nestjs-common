import { HttpExceptionFilter } from '../http-exception.filter.js';
import { HttpException } from '@nestjs/common';
import { AppLogger } from '../../services/logger.service.js';
import { ErrorSanitizerService } from '../../services/error-sanitizer.service.js';
import { ErrorCategorizerService } from '../../services/error-categorizer.service.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('HttpExceptionFilter', () => {
	let filter: HttpExceptionFilter;
	let mockLogger: any;
	let mockErrorSanitizer: any;
	let mockErrorCategorizer: any;
	let mockModuleRef: any;

	beforeEach(() => {
		mockLogger = {
			debug() {},
			Debug() {},
			error() {},
			Error() {},
		};
		mockErrorSanitizer = {
			sanitizeErrorResponse() {
				return { message: 'Sanitized error' };
			},
			SanitizeErrorResponse() {
				return { message: 'Sanitized error' };
			},
		};
		mockErrorCategorizer = {
			categorizeError() {
				return {
					type: 'CLIENT_ERROR',
					retryable: false,
					strategy: 'NONE',
					backoffMs: 0,
				};
			},
			CategorizeError() {
				return {
					type: 'CLIENT_ERROR',
					retryable: false,
					strategy: 'NONE',
					backoffMs: 0,
				};
			},
		};

		mockModuleRef = {
			get(token: any) {
				if (token === AppLogger) return mockLogger;
				if (token === ErrorSanitizerService) return mockErrorSanitizer;
				if (token === ErrorCategorizerService) return mockErrorCategorizer;
				return undefined;
			},
		};

		filter = new HttpExceptionFilter(mockModuleRef);
	});

	it('should be defined', () => {
		expect(filter).toBeDefined();
	});

	describe('catch', () => {
		let mockException: any;
		let mockHost: any;
		let mockResponse: any;

		beforeEach(() => {
			mockException = new HttpException('Test error', 400);
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
			mockHost = {
				getType() {
					return 'http';
				},
				switchToHttp() {
					return {
						getResponse() {
							return mockResponse;
						},
					};
				},
			};

			// Setup default mock methods
			mockException.getStatus = function() {
				return 400;
			};
			mockException.getResponse = function() {
				return { message: 'Test error' };
			};
		});

		it('should handle HTTP requests in production environment', () => {
			const originalEnv = process.env['NODE_ENV'];
			process.env['NODE_ENV'] = 'production';

			mockHost.getType = function() {
				return 'http';
			};

			filter.catch(mockException, mockHost);

			expect(mockResponse.statusCode).toBe(400);
			expect(mockResponse.responseData).toEqual({ message: 'Sanitized error' });

			process.env['NODE_ENV'] = originalEnv;
		});

		it('should handle HTTP requests in development environment', () => {
			const originalEnv = process.env['NODE_ENV'];
			process.env['NODE_ENV'] = 'development';

			mockHost.getType = function() {
				return 'http';
			};
			mockException.stack = 'Test stack trace';

			filter.catch(mockException, mockHost);

			expect(mockResponse.statusCode).toBe(400);
			expect(mockResponse.responseData).toEqual({ message: 'Sanitized error' });

			process.env['NODE_ENV'] = originalEnv;
		});

		it('should handle different HTTP status codes', () => {
			mockHost.getType = function() {
				return 'http';
			};
			mockException.getStatus = function() {
				return 500;
			};

			filter.catch(mockException, mockHost);

			expect(mockResponse.statusCode).toBe(500);
		});

		it('should handle complex error responses', () => {
			mockHost.getType = function() {
				return 'http';
			};
			const complexResponse = {
				message: 'Validation failed',
				errors: ['Field is required', 'Invalid format'],
			};
			mockException.getResponse = function() {
				return complexResponse;
			};
			mockErrorSanitizer.SanitizeErrorResponse = function() {
				return {
					message: 'Validation failed',
					errors: ['Field is required'],
				};
			};

			filter.catch(mockException, mockHost);

			expect(mockResponse.responseData).toEqual({
				message: 'Validation failed',
				errors: ['Field is required'],
			});
		});
	});
});
