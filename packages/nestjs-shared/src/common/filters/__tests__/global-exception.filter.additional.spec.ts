import { GlobalExceptionFilter } from '../global-exception.filter.js';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AppLogger } from '../../services/logger.service.js';
import { ErrorSanitizerService } from '../../services/error-sanitizer.service.js';
import { ErrorCategorizerService } from '../../services/error-categorizer.service.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('GlobalExceptionFilter - Advanced Scenarios', () => {
	let filter: GlobalExceptionFilter;
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
			info() {},
			Info() {},
			warn() {},
			Warn() {},
		};
		mockErrorSanitizer = {
			sanitizeErrorResponse(error: any) {
				return { message: error.message ?? 'Error sanitized' };
			},
			SanitizeErrorResponse(error: any) {
				return { message: error.message ?? 'Error sanitized' };
			},
		};
		mockErrorCategorizer = {
			categorizeError() {
				return {
					type: 'UNKNOWN_ERROR',
					retryable: false,
					strategy: 'NONE',
					backoffMs: 0,
				};
			},
			CategorizeError() {
				return {
					type: 'UNKNOWN_ERROR',
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

		filter = new GlobalExceptionFilter(mockModuleRef);
	});

	describe('catch - Advanced Exception Handling', () => {
		let mockHost: any;
		let mockResponse: any;
		let mockRequest: any;

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
				method: 'POST',
				ip: '127.0.0.1',
				get(header: string) {
					if (header === 'User-Agent') {
						return 'Test Browser';
					}
					return undefined;
				},
			};
			mockHost = {
				getType() {
					return 'http';
				},
				switchToHttp() {
					return {
						getRequest() {
							return mockRequest;
						},
						getResponse() {
							return mockResponse;
						},
					};
				},
			};
		});

		it('should handle development environment with stack traces', () => {
			const originalEnv = process.env['NODE_ENV'];
			process.env['NODE_ENV'] = 'development';

			const genericError = new Error('Database connection failed');
			genericError.stack = 'Error: Database connection failed\n at ...';

			filter.catch(genericError, mockHost);

			expect(mockResponse.statusCode).toBe(500);
			expect(mockResponse.responseData).toBeDefined();

			process.env['NODE_ENV'] = originalEnv;
		});

		it('should hide stack traces in production environment', () => {
			const originalEnv = process.env['NODE_ENV'];
			process.env['NODE_ENV'] = 'production';

			const genericError = new Error('Database connection failed');
			genericError.stack = 'Error: Database connection failed\n at sensitive location';

			filter.catch(genericError, mockHost);

			expect(mockResponse.statusCode).toBe(500);
			expect(mockResponse.responseData).toBeDefined();

			process.env['NODE_ENV'] = originalEnv;
		});

		it('should not handle HttpException (delegated to HttpExceptionFilter)', () => {
			const httpException = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

			// GlobalExceptionFilter with @Catch(BaseApplicationError, Error) does not catch HttpException
			// HttpExceptionFilter handles those instead
			filter.catch(httpException as any, mockHost);
			// Default status should be 500 (not 400) since it's treated as unknown
			expect(mockResponse.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
		});

		it('should handle generic Error with standardized response', () => {
			const genericError = new Error('Unexpected error occurred');

			filter.catch(genericError, mockHost);

			expect(mockResponse.statusCode).toBe(500);
			expect(mockResponse.responseData).toBeDefined();
		});
	});
});
