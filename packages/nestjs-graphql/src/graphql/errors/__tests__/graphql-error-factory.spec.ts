import { createGraphQLError, GRAPHQL_ERROR_CONFIGS, type TGraphQLErrorType } from '../graphql-error-factory.js';

describe('createGraphQLError', () => {
	describe('factory function', () => {
		it('should create GraphQL error class with correct properties', () => {
			const TestError = createGraphQLError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test GraphQL error occurred',
				graphqlCode: 'TEST_ERROR',
			});

			const error = new TestError();

			expect(error.message).toBe('Test GraphQL error occurred');
			expect((error as any).Code).toBe('TEST_ERROR');
			expect((error as any).StatusCode).toBe(400);
			expect((error as any).Context).toEqual({});
			expect(error.extensions).toBeDefined();
		});

		it('should create error class with custom message', () => {
			const TestError = createGraphQLError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test GraphQL error occurred',
				graphqlCode: 'TEST_ERROR',
			});

			const error = new TestError('Custom message');

			expect(error.message).toBe('Custom message');
		});

		it('should create error class with context', () => {
			const TestError = createGraphQLError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test GraphQL error occurred',
				graphqlCode: 'TEST_ERROR',
			});

			const context = { userId: '123' };
			const error = new TestError('Custom message', context);

			expect(error.Context).toEqual(context);
		});

		it('should set correct class name', () => {
			const TestError = createGraphQLError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test GraphQL error occurred',
				graphqlCode: 'TEST_ERROR',
			});

			expect(TestError.name).toBe('TEST_ERRORError');
		});

		it('should extend GraphQLError', () => {
			const TestError = createGraphQLError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test GraphQL error occurred',
				graphqlCode: 'TEST_ERROR',
			});

			const error = new TestError();

			expect(error).toBeInstanceOf(TestError);
			expect((error as any).toPlainObject).toBeDefined();
			expect((error as any).withContext).toBeDefined();
			expect((error as any).withMessage).toBeDefined();
		});

		it('should include GraphQL extensions', () => {
			const TestError = createGraphQLError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test GraphQL error occurred',
				graphqlCode: 'TEST_ERROR',
			});

			const error = new TestError();

			expect(error.extensions).toEqual({
				code: 'TEST_ERROR',
				statusCode: 400,
				context: {},
				timestamp: expect.any(String),
			});
		});
	});

	describe('toPlainObject', () => {
		it('should serialize error to plain object', () => {
			const TestError = createGraphQLError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test GraphQL error occurred',
				graphqlCode: 'TEST_ERROR',
			});

			const error = new TestError('Custom message', { userId: '123' });
			const plain = (error as any).toPlainObject();

			expect(plain).toEqual({
				name: 'TEST_ERRORError',
				message: 'Custom message',
				code: 'TEST_ERROR',
				statusCode: 400,
				graphqlCode: 'TEST_ERROR',
				context: { userId: '123' },
				timestamp: expect.any(String),
			});
		});
	});

	describe('withContext', () => {
		it('should create new error with merged context', () => {
			const TestError = createGraphQLError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test GraphQL error occurred',
				graphqlCode: 'TEST_ERROR',
			});

			const originalError = new TestError('Test error', { userId: '123' });
			const newError = (originalError as any).withContext({ action: 'login' });

			expect(newError).not.toBe(originalError);
			expect(newError.message).toBe('Test error');
			expect(newError.Context).toEqual({ userId: '123', action: 'login' });
		});
	});

	describe('withMessage', () => {
		it('should create new error with different message', () => {
			const TestError = createGraphQLError({
				code: 'TEST_ERROR',
				statusCode: 400,
				defaultMessage: 'Test GraphQL error occurred',
				graphqlCode: 'TEST_ERROR',
			});

			const originalError = new TestError('Original message');
			const newError = (originalError as any).withMessage('New message');

			expect(newError.message).toBe('New message');
			expect(newError.Code).toBe('TEST_ERROR');
		});
	});

	describe('GRAPHQL_ERROR_CONFIGS', () => {
		it('should have all GraphQL error configurations', () => {
			expect(GRAPHQL_ERROR_CONFIGS.UNAUTHENTICATED).toEqual({
				code: 'UNAUTHORIZED',
				statusCode: 401,
				defaultMessage: 'Authentication required',
				graphqlCode: 'UNAUTHENTICATED',
			});

			expect(GRAPHQL_ERROR_CONFIGS.FORBIDDEN).toEqual({
				code: 'FORBIDDEN',
				statusCode: 403,
				defaultMessage: 'Access forbidden',
				graphqlCode: 'FORBIDDEN',
			});

			expect(GRAPHQL_ERROR_CONFIGS.NOT_FOUND).toEqual({
				code: 'NOT_FOUND',
				statusCode: 404,
				defaultMessage: 'Resource not found',
				graphqlCode: 'NOT_FOUND',
			});

			expect(GRAPHQL_ERROR_CONFIGS.BAD_USER_INPUT).toEqual({
				code: 'BAD_REQUEST',
				statusCode: 400,
				defaultMessage: 'Bad request',
				graphqlCode: 'BAD_USER_INPUT',
			});
		});
	});

	describe('TGraphQLErrorType', () => {
		it('should include all GraphQL error configuration keys', () => {
			const graphqlErrorTypes: TGraphQLErrorType[] = [
				'UNAUTHENTICATED',
				'FORBIDDEN',
				'NOT_FOUND',
				'BAD_USER_INPUT',
				'CONFLICT',
				'VALIDATION_ERROR',
				'INTERNAL_SERVER_ERROR',
				'RATE_LIMIT_EXCEEDED',
			];

			graphqlErrorTypes.forEach(type => {
				expect(GRAPHQL_ERROR_CONFIGS[type]).toBeDefined();
			});
		});
	});
});
