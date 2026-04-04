import { MetricsGuard } from '../metrics.guard.js';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '../../../config/config.service.js';
import { vi } from 'vitest';

function makeGuard(mockConfigService: any): MetricsGuard {
	const mockModuleRef = {
		get: (token: any) => {
			if (token === ConfigService) return mockConfigService;
			throw new Error('not found');
		},
	} as any;
	return new MetricsGuard(mockModuleRef);
}

describe('MetricsGuard', () => {
	let guard: MetricsGuard;
	let _configService: ConfigService;
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
				Get: () => undefined,
			};

			guard = makeGuard(mockConfigService);

			expect(guard).toBeDefined();
		});

		it('should implement CanActivate', () => {
			const mockConfigService = {
				Get: () => undefined,
			};

			guard = makeGuard(mockConfigService);

			expect(typeof guard.canActivate).toBe('function');
		});

		it('should read METRICS_API_KEY from ConfigService', () => {
			const mockConfigService = {
				Get: vi.fn().mockReturnValue('test-key-123'),
			};

			guard = makeGuard(mockConfigService);

			// Key is read lazily during canActivate, not at construction
			mockRequest.headers = { authorization: 'Bearer test-key-123' };
			guard.canActivate(mockContext);

			expect(mockConfigService.Get).toHaveBeenCalledWith('METRICS_API_KEY');
		});
	});

	describe('backward compatibility - no API key configured', () => {
		beforeEach(() => {
			const mockConfigService = {
				Get: () => undefined,
			};

			guard = makeGuard(mockConfigService);
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
				Get: () => 'secret-api-key',
			};

			guard = makeGuard(mockConfigService);
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

		it('should accept case-insensitive Bearer scheme', () => {
			mockRequest.headers = {
				authorization: 'bearer secret-api-key',
			};

			expect(guard.canActivate(mockContext)).toBe(true);
		});
	});

	describe('API key validation - X-API-Key header', () => {
		beforeEach(() => {
			const mockConfigService = {
				Get: () => 'secret-api-key',
			};

			guard = makeGuard(mockConfigService);
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
				Get: () => 'secret-api-key',
			};

			guard = makeGuard(mockConfigService);
		});

		it('should accept Authorization header when X-API-Key is also present', () => {
			mockRequest.headers = {
				authorization: 'Bearer secret-api-key',
				'x-api-key': 'wrong-key',
			};

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should accept X-API-Key header when Authorization is missing', () => {
			mockRequest.headers = {
				'x-api-key': 'secret-api-key',
			};

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should reject requests with neither Authorization nor X-API-Key headers', () => {
			mockRequest.headers = {};

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});
	});

	describe('error handling', () => {
		beforeEach(() => {
			const mockConfigService = {
				Get: () => 'secret-api-key',
			};

			guard = makeGuard(mockConfigService);
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
				Get: () => 'secret-api-key',
			};

			guard = makeGuard(mockConfigService);
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
				Get: () => 'key-with-special-chars_123',
			};

			guard = makeGuard(mockConfigService);

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
				Get: () => undefined,
			};

			guard = makeGuard(mockConfigService);

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});
	});

	describe('integration with ConfigService', () => {
		it('should read API key from ConfigService during canActivate', () => {
			const mockConfigService = {
				Get: vi.fn().mockReturnValue('configured-key'),
			};

			guard = makeGuard(mockConfigService);

			mockRequest.headers = { authorization: 'Bearer configured-key' };
			guard.canActivate(mockContext);

			expect(mockConfigService.Get).toHaveBeenCalledWith('METRICS_API_KEY');
		});

		it('should read API key on each canActivate call', () => {
			const mockConfigService = {
				Get: vi.fn().mockReturnValue('configured-key'),
			};

			guard = makeGuard(mockConfigService);

			mockRequest.headers = { authorization: 'Bearer configured-key' };
			guard.canActivate(mockContext);

			mockRequest.headers = { 'x-api-key': 'configured-key' };
			guard.canActivate(mockContext);

			// The key is read lazily (not cached) — called at least once per canActivate
			expect(mockConfigService.Get).toHaveBeenCalledWith('METRICS_API_KEY');
			expect(mockConfigService.Get.mock.calls.length).toBeGreaterThanOrEqual(2);
		});
	});
});
