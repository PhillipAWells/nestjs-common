import { createError, ERROR_CONFIGS, type ErrorType } from '../error-factory.js';

describe('createError', () => {
	describe('factory function', () => {
		it('should create error class with correct properties', () => {
			const TestError = createError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test error occurred',
			});

			const error = new TestError('Test error occurred');

			expect(error.message).toBe('Test error occurred');
			expect(error.code).toBe('TEST_ERROR');
			expect(error.statusCode).toBe(400);
			expect(error.context).toEqual({});
		});

		it('should create error class with custom message', () => {
			const TestError = createError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test error occurred',
			});

			const error = new TestError('Custom message');

			expect(error.message).toBe('Custom message');
			expect(error.code).toBe('TEST_ERROR');
		});

		it('should create error class with context', () => {
			const TestError = createError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test error occurred',
			});

			const context: Record<string, any> = { userId: '123' };
			const error = new TestError('Custom message', context);

			expect(error.context).toEqual(context);
		});

		it('should set correct class name', () => {
			const TestError = createError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test error occurred',
			});

			expect(TestError.name).toBe('TEST_ERRORError');
		});

		it('should use custom name if provided', () => {
			const TestError = createError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test error occurred',
				name: 'CustomError',
			});

			expect(TestError.name).toBe('CustomError');
		});

		it('should inherit from BaseApplicationError', () => {
			const TestError = createError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test error occurred',
			});

			const error = new TestError('Test error occurred');

			expect(error).toBeInstanceOf(TestError);
			expect(error.toJSON).toBeDefined();
			expect(error.withContext).toBeDefined();
			expect(error.withMessage).toBeDefined();
		});
	});

	describe('ERROR_CONFIGS', () => {
		it('should have all standard HTTP error configurations', () => {
			expect(ERROR_CONFIGS.BAD_REQUEST).toEqual({
				code: 'BAD_REQUEST',
				statusCode: 400,
				defaultMessage: 'Bad request',
			});

			expect(ERROR_CONFIGS.UNAUTHORIZED).toEqual({
				code: 'UNAUTHORIZED',
				statusCode: 401,
				defaultMessage: 'Unauthorized',
			});

			expect(ERROR_CONFIGS.FORBIDDEN).toEqual({
				code: 'FORBIDDEN',
				statusCode: 403,
				defaultMessage: 'Forbidden',
			});

			expect(ERROR_CONFIGS.NOT_FOUND).toEqual({
				code: 'NOT_FOUND',
				statusCode: 404,
				defaultMessage: 'Not found',
			});

			expect(ERROR_CONFIGS.CONFLICT).toEqual({
				code: 'CONFLICT',
				statusCode: 409,
				defaultMessage: 'Conflict',
			});

			expect(ERROR_CONFIGS.INTERNAL_SERVER_ERROR).toEqual({
				code: 'INTERNAL_SERVER_ERROR',
				statusCode: 500,
				defaultMessage: 'Internal server error',
			});
		});
	});

	describe('ErrorType', () => {
		it('should include all error configuration keys', () => {
			const errorTypes: ErrorType[] = [
				'BAD_REQUEST',
				'UNAUTHORIZED',
				'FORBIDDEN',
				'NOT_FOUND',
				'CONFLICT',
				'UNPROCESSABLE_ENTITY',
				'INTERNAL_SERVER_ERROR',
				'BAD_GATEWAY',
				'SERVICE_UNAVAILABLE',
				'GATEWAY_TIMEOUT',
			];

			errorTypes.forEach(type => {
				expect(ERROR_CONFIGS[type]).toBeDefined();
			});
		});
	});

	describe('predefined error classes', () => {
		it('should export working error classes', async () => {
			const { BadRequestError, NotFoundError, InternalServerError } = await import('../index.js');

			const badRequest = new BadRequestError('Bad request');
			expect(badRequest.code).toBe('BAD_REQUEST');
			expect(badRequest.statusCode).toBe(400);

			const notFound = new NotFoundError('Not found');
			expect(notFound.code).toBe('NOT_FOUND');
			expect(notFound.statusCode).toBe(404);

			const internalError = new InternalServerError('Internal server error');
			expect(internalError.code).toBe('INTERNAL_SERVER_ERROR');
			expect(internalError.statusCode).toBe(500);
		});
	});
});
