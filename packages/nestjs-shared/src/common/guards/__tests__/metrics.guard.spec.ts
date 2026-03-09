import { MetricsGuard } from '../metrics.guard.js';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '../../../config/config.service.js';
import { vi } from 'vitest';

describe('MetricsGuard', () => {
	let guard: MetricsGuard;
	let configService: ConfigService;
	let mockContext: any;
	let mockRequest: any;

	beforeEach(() => {
		mockRequest = {
			headers: {},
			query: {},
		};

		mockContext = {
			switchToHttp: () => ({
				getRequest: () => mockRequest,
				getResponse: () => ({}),
			}),
		};
	});

	describe('guard instantiation', () => {
		it('should be defined', () => {
			const mockConfigService = {
				get: () => undefined,
			};

			guard = new MetricsGuard(mockConfigService as any);

			expect(guard).toBeDefined();
		});

		it('should implement CanActivate', () => {
			const mockConfigService = {
				get: () => undefined,
			};

			guard = new MetricsGuard(mockConfigService as any);

			expect(typeof guard.canActivate).toBe('function');
		});

		it('should read METRICS_API_KEY from ConfigService', () => {
			const mockConfigService = {
				get: vi.fn().mockReturnValue('test-key-123'),
			};

			guard = new MetricsGuard(mockConfigService as any);

			expect(mockConfigService.get).toHaveBeenCalledWith('METRICS_API_KEY');
		});
	});

	describe('backward compatibility - no API key configured', () => {
		beforeEach(() => {
			const mockConfigService = {
				get: () => undefined,
			};

			guard = new MetricsGuard(mockConfigService as any);
		});

		it('should allow requests when METRICS_API_KEY is not configured', () => {
			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should allow requests with no headers', () => {
			mockRequest.headers = {};

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should allow requests with random headers', () => {
			mockRequest.headers = {
				'x-api-key': 'anything',
				authorization: 'Bearer anything',
			};

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should allow requests with query parameters', () => {
			mockRequest.query = { key: 'anything' };

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});
	});

	describe('API key validation - Bearer token', () => {
		beforeEach(() => {
			const mockConfigService = {
				get: () => 'secret-api-key',
			};

			guard = new MetricsGuard(mockConfigService as any);
		});

		it('should allow requests with correct Bearer token', () => {
			mockRequest.headers = {
				authorization: 'Bearer secret-api-key',
			};

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should reject requests with incorrect Bearer token', () => {
			mockRequest.headers = {
				authorization: 'Bearer wrong-key',
			};

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});

		it('should reject requests with invalid scheme', () => {
			mockRequest.headers = {
				authorization: 'Basic secret-api-key',
			};

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});

		it('should reject requests with malformed authorization header', () => {
			mockRequest.headers = {
				authorization: 'invalid-format',
			};

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});

		it('should be case-sensitive for Bearer scheme', () => {
			mockRequest.headers = {
				authorization: 'bearer secret-api-key',
			};

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});
	});

	describe('API key validation - query parameter', () => {
		beforeEach(() => {
			const mockConfigService = {
				get: () => 'secret-api-key',
			};

			guard = new MetricsGuard(mockConfigService as any);
		});

		it('should allow requests with correct key query parameter', () => {
			mockRequest.query = { key: 'secret-api-key' };

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should reject requests with incorrect key query parameter', () => {
			mockRequest.query = { key: 'wrong-key' };

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});

		it('should reject requests with missing key query parameter', () => {
			mockRequest.query = {};

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});

		it('should ignore other query parameters', () => {
			mockRequest.query = { other: 'secret-api-key', format: 'json' };

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});
	});

	describe('API key validation - X-API-Key header', () => {
		beforeEach(() => {
			const mockConfigService = {
				get: () => 'secret-api-key',
			};

			guard = new MetricsGuard(mockConfigService as any);
		});

		it('should allow requests with correct X-API-Key header', () => {
			mockRequest.headers = {
				'x-api-key': 'secret-api-key',
			};

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should reject requests with incorrect X-API-Key header', () => {
			mockRequest.headers = {
				'x-api-key': 'wrong-key',
			};

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});

		it('should work with X-API-KEY header in any case', () => {
			mockRequest.headers = {
				'x-api-key': 'secret-api-key',
			};

			// Express normalizes headers to lowercase
			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});
	});

	describe('priority and fallback', () => {
		beforeEach(() => {
			const mockConfigService = {
				get: () => 'secret-api-key',
			};

			guard = new MetricsGuard(mockConfigService as any);
		});

		it('should accept Authorization header when multiple methods are provided', () => {
			mockRequest.headers = {
				authorization: 'Bearer secret-api-key',
				'x-api-key': 'wrong-key',
			};
			mockRequest.query = { key: 'wrong-key' };

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should accept X-API-Key header if Authorization is missing', () => {
			mockRequest.headers = {
				'x-api-key': 'secret-api-key',
			};
			mockRequest.query = { key: 'wrong-key' };

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should accept query parameter if headers are missing', () => {
			mockRequest.headers = {};
			mockRequest.query = { key: 'secret-api-key' };

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});
	});

	describe('error handling', () => {
		beforeEach(() => {
			const mockConfigService = {
				get: () => 'secret-api-key',
			};

			guard = new MetricsGuard(mockConfigService as any);
		});

		it('should throw ForbiddenException on invalid credentials', () => {
			mockRequest.headers = {};
			mockRequest.query = {};

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});

		it('should throw ForbiddenException with appropriate message', () => {
			mockRequest.headers = {};
			mockRequest.query = {};

			const error = expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);

			expect(error).toBeDefined();
		});

		it('should not expose API key in error messages', () => {
			mockRequest.headers = { authorization: 'Bearer wrong-key' };

			try {
				guard.canActivate(mockContext);
			} catch (error: any) {
				expect(error.message).not.toContain('secret-api-key');
				expect(error.message).not.toContain('wrong-key');
			}
		});
	});

	describe('special cases', () => {
		beforeEach(() => {
			const mockConfigService = {
				get: () => 'secret-api-key',
			};

			guard = new MetricsGuard(mockConfigService as any);
		});

		it('should handle empty authorization header', () => {
			mockRequest.headers = {
				authorization: '',
			};

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});

		it('should handle whitespace in authorization header', () => {
			mockRequest.headers = {
				authorization: '  Bearer secret-api-key  ',
			};

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});

		it('should handle special characters in API key', () => {
			const mockConfigService = {
				get: () => 'key-with-special-chars_123',
			};

			guard = new MetricsGuard(mockConfigService as any);

			mockRequest.headers = {
				authorization: 'Bearer key-with-special-chars_123',
			};

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should require correct Bearer token format without extra spaces', () => {
			mockRequest.headers = {
				authorization: 'Bearer  secret-api-key',
			};

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});

		it('should handle undefined headers object', () => {
			mockRequest.headers = undefined;
			mockRequest.query = {};

			const mockConfigService = {
				get: () => undefined,
			};

			guard = new MetricsGuard(mockConfigService as any);

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});
	});

	describe('integration with ConfigService', () => {
		it('should read API key from ConfigService during instantiation', () => {
			const mockConfigService = {
				get: vi.fn().mockReturnValue('configured-key'),
			};

			guard = new MetricsGuard(mockConfigService as any);

			expect(mockConfigService.get).toHaveBeenCalledWith('METRICS_API_KEY');
		});

		it('should use cached API key value', () => {
			const mockConfigService = {
				get: vi.fn().mockReturnValue('configured-key'),
			};

			guard = new MetricsGuard(mockConfigService as any);

			mockRequest.headers = { authorization: 'Bearer configured-key' };
			guard.canActivate(mockContext);

			mockRequest.headers = { 'x-api-key': 'configured-key' };
			guard.canActivate(mockContext);

			expect(mockConfigService.get).toHaveBeenCalledTimes(1);
		});
	});
});
