import { CSRFGuard } from '../csrf.guard.js';
import { ForbiddenException } from '@nestjs/common';

describe('CSRFGuard', () => {
	let guard: CSRFGuard;
	let mockCSRFService: any;

	beforeEach(() => {
		mockCSRFService = {
			validateToken: (_req: any) => true,
		};

		guard = new CSRFGuard(mockCSRFService);
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

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should allow HEAD requests without validation', () => {
			mockRequest.method = 'HEAD';

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should allow OPTIONS requests without validation', () => {
			mockRequest.method = 'OPTIONS';

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should validate CSRF token for POST requests and return true when valid', () => {
			mockCSRFService.validateToken = () => true;

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should throw ForbiddenException when CSRF token is invalid', () => {
			mockCSRFService.validateToken = () => false;

			expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
		});

		it('should validate CSRF token for PUT requests', () => {
			mockRequest.method = 'PUT';
			mockCSRFService.validateToken = () => true;

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});

		it('should validate CSRF token for DELETE requests', () => {
			mockRequest.method = 'DELETE';
			mockCSRFService.validateToken = () => true;

			const result = guard.canActivate(mockContext);

			expect(result).toBe(true);
		});
	});
});
