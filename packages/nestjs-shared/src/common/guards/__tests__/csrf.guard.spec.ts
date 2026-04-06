import { describe, it, expect, beforeEach } from 'vitest';
import { CSRFGuard } from '../csrf.guard.js';
import { ForbiddenException } from '@nestjs/common';
import { CSRFService } from '../../services/csrf.service.js';

describe('CSRFGuard', () => {
	let guard: CSRFGuard;
	let mockCSRFService: any;

	beforeEach(() => {
		mockCSRFService = {
			ValidateToken: (_req: any) => true,
		};

		const mockModuleRef = {
			get: (token: any) => {
				if (token === CSRFService) return mockCSRFService;
				throw new Error('not found');
			},
		} as any;

		guard = new CSRFGuard(mockModuleRef);
	});

	it('should be defined', () => {
		expect(guard).toBeDefined();
	});

	describe('canActivate', () => {
		let mockRequest: any;
		let mockContext: any;

		beforeEach(() => {
			mockRequest = {
				method: 'POST',
			};
			mockContext = {
				switchToHttp: () => ({
					getRequest: () => mockRequest,
					getResponse: () => ({}),
				}),
			};
		});

		it('should allow GET requests without validation', () => {
			mockRequest.method = 'GET';

			const Result = guard.canActivate(mockContext);

			expect(Result).toBe(true);
		});

		it('should allow HEAD requests without validation', () => {
			mockRequest.method = 'HEAD';

			const Result = guard.canActivate(mockContext);

			expect(Result).toBe(true);
		});

		it('should allow OPTIONS requests without validation', () => {
			mockRequest.method = 'OPTIONS';

			const Result = guard.canActivate(mockContext);

			expect(Result).toBe(true);
		});

		it('should validate CSRF token for POST requests and return true when valid', () => {
			mockCSRFService.ValidateToken = () => true;

			const Result = guard.canActivate(mockContext);

			expect(Result).toBe(true);
		});

		it('should throw ForbiddenException when CSRF token is invalid', () => {
			mockCSRFService.ValidateToken = () => false;

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});

		it('should validate CSRF token for PUT requests', () => {
			mockRequest.method = 'PUT';
			mockCSRFService.ValidateToken = () => true;

			const Result = guard.canActivate(mockContext);

			expect(Result).toBe(true);
		});

		it('should validate CSRF token for DELETE requests', () => {
			mockRequest.method = 'DELETE';
			mockCSRFService.ValidateToken = () => true;

			const Result = guard.canActivate(mockContext);

			expect(Result).toBe(true);
		});
	});
});
