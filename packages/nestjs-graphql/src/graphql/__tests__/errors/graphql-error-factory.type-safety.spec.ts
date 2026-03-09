import { GraphQLErrorCode, IGraphQLErrorInput } from '../../graphql/types/graphql-safety.types.js';
import { createGraphQLError, GRAPHQL_ERROR_CONFIGS } from '../../errors/graphql-error-factory.js';

describe('GraphQL Error Factory - Type Safety', () => {
	describe('GraphQLErrorCode enum', () => {
		it('should have all required error codes', () => {
			expect(GraphQLErrorCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
			expect(GraphQLErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
			expect(GraphQLErrorCode.AUTHENTICATION_ERROR).toBe('AUTHENTICATION_ERROR');
			expect(GraphQLErrorCode.AUTHORIZATION_ERROR).toBe('AUTHORIZATION_ERROR');
			expect(GraphQLErrorCode.RATE_LIMIT_ERROR).toBe('RATE_LIMIT_ERROR');
			expect(GraphQLErrorCode.NOT_FOUND_ERROR).toBe('NOT_FOUND_ERROR');
			expect(GraphQLErrorCode.CONFLICT_ERROR).toBe('CONFLICT_ERROR');
			expect(GraphQLErrorCode.BAD_REQUEST_ERROR).toBe('BAD_REQUEST_ERROR');
		});
	});

	describe('Error creation with proper types', () => {
		it('should create error with typed input', () => {
			const errorInput: IGraphQLErrorInput = {
				message: 'User not found',
				code: GraphQLErrorCode.NOT_FOUND_ERROR,
				statusCode: 404,
				details: { userId: '123' },
			};

			expect(errorInput).toBeDefined();
			expect(errorInput.message).toBe('User not found');
			expect(errorInput.code).toBe(GraphQLErrorCode.NOT_FOUND_ERROR);
			expect(errorInput.statusCode).toBe(404);
			expect(errorInput.details?.userId).toBe('123');
		});

		it('should create error with context', () => {
			const errorInput: IGraphQLErrorInput = {
				message: 'Validation failed',
				code: GraphQLErrorCode.VALIDATION_ERROR,
				statusCode: 400,
				context: {
					field: 'email',
					constraint: 'email_format',
				},
			};

			expect(errorInput.context?.field).toBe('email');
			expect(errorInput.context?.constraint).toBe('email_format');
		});

		it('should create validation error with proper types', () => {
			const ValidationError = createGraphQLError(
				GRAPHQL_ERROR_CONFIGS.VALIDATION_ERROR,
			);

			const error = new ValidationError('Email is invalid', {
				field: 'email',
				value: 'not-an-email',
			});

			expect(error.message).toBe('Email is invalid');
			expect(error.code).toBe('VALIDATION_ERROR');
			expect(error.statusCode).toBe(400);
			expect(error.context.field).toBe('email');
		});

		it('should create authentication error with proper types', () => {
			const AuthError = createGraphQLError(
				GRAPHQL_ERROR_CONFIGS.UNAUTHENTICATED,
			);

			const error = new AuthError('Token expired');

			expect(error.message).toBe('Token expired');
			expect(error.code).toBe('UNAUTHORIZED');
			expect(error.statusCode).toBe(401);
		});

		it('should create forbidden error with proper types', () => {
			const ForbiddenError = createGraphQLError(
				GRAPHQL_ERROR_CONFIGS.FORBIDDEN,
			);

			const error = new ForbiddenError('Access denied', {
				requiredRole: 'admin',
			});

			expect(error.message).toBe('Access denied');
			expect(error.code).toBe('FORBIDDEN');
			expect(error.statusCode).toBe(403);
			expect(error.context.requiredRole).toBe('admin');
		});

		it('should create rate limit error with proper types', () => {
			const RateLimitError = createGraphQLError(
				GRAPHQL_ERROR_CONFIGS.RATE_LIMIT_EXCEEDED,
			);

			const error = new RateLimitError('Rate limit exceeded', {
				retryAfter: 60,
			});

			expect(error.message).toBe('Rate limit exceeded');
			expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
			expect(error.statusCode).toBe(429);
			expect(error.context.retryAfter).toBe(60);
		});
	});

	describe('Error configuration typing', () => {
		it('should provide typed access to error configs', () => {
			const validationConfig = GRAPHQL_ERROR_CONFIGS.VALIDATION_ERROR;

			expect(validationConfig.code).toBe('VALIDATION_ERROR');
			expect(validationConfig.statusCode).toBe(400);
			expect(validationConfig.graphqlCode).toBe('BAD_USER_INPUT');
			expect(validationConfig.defaultMessage).toBe('Validation failed');
		});

		it('should have consistent error configs structure', () => {
			Object.values(GRAPHQL_ERROR_CONFIGS).forEach((config) => {
				expect(config).toHaveProperty('code');
				expect(config).toHaveProperty('statusCode');
				expect(config).toHaveProperty('defaultMessage');
				expect(config).toHaveProperty('graphqlCode');

				expect(typeof config.code).toBe('string');
				expect(typeof config.statusCode).toBe('number');
				expect(typeof config.defaultMessage).toBe('string');
				expect(typeof config.graphqlCode).toBe('string');
			});
		});
	});

	describe('Error with method chaining and type safety', () => {
		it('should create error with context and maintain types', () => {
			const ValidationError = createGraphQLError(
				GRAPHQL_ERROR_CONFIGS.VALIDATION_ERROR,
			);

			const error = new ValidationError('Invalid input');
			const errorWithContext = error.withContext({ field: 'name' });

			expect(errorWithContext.message).toBe('Invalid input');
			expect(errorWithContext.context.field).toBe('name');
			expect(errorWithContext.statusCode).toBe(400);
		});

		it('should create error with new message and maintain types', () => {
			const NotFoundError = createGraphQLError(
				GRAPHQL_ERROR_CONFIGS.NOT_FOUND,
			);

			const error = new NotFoundError('User not found', { userId: '123' });
			const errorWithNewMessage = error.withMessage('Resource does not exist');

			expect(errorWithNewMessage.message).toBe('Resource does not exist');
			expect(errorWithNewMessage.context.userId).toBe('123');
			expect(errorWithNewMessage.statusCode).toBe(404);
		});
	});

	describe('Formatted error response typing', () => {
		it('should produce properly typed formatted error', () => {
			const UnauthorizedError = createGraphQLError(
				GRAPHQL_ERROR_CONFIGS.UNAUTHENTICATED,
			);

			const error = new UnauthorizedError('Invalid credentials');

			const plainObject = error.toPlainObject();

			expect(plainObject).toHaveProperty('name');
			expect(plainObject).toHaveProperty('message');
			expect(plainObject).toHaveProperty('code');
			expect(plainObject).toHaveProperty('statusCode');
			expect(plainObject).toHaveProperty('graphqlCode');
			expect(plainObject.code).toBe('UNAUTHORIZED');
			expect(plainObject.statusCode).toBe(401);
		});

		it('should properly type error extensions', () => {
			const ConflictError = createGraphQLError(
				GRAPHQL_ERROR_CONFIGS.CONFLICT,
			);

			const error = new ConflictError('Resource already exists', {
				existingId: 'id-456',
			});

			const extensions = error.extensions as Record<string, unknown>;

			expect(extensions).toBeDefined();
			expect(extensions.code).toBeDefined();
			expect(extensions.statusCode).toBe(409);
			expect(extensions.context).toBeDefined();
		});
	});

	describe('Type safety at compile time', () => {
		it('should allow type-safe error code assignment', () => {
			const errorCode: GraphQLErrorCode = GraphQLErrorCode.VALIDATION_ERROR;

			expect(errorCode).toBe('VALIDATION_ERROR');
		});

		it('should provide proper typing for error input', () => {
			const createValidationErrorInput = (message: string): IGraphQLErrorInput => ({
				message,
				code: GraphQLErrorCode.VALIDATION_ERROR,
				statusCode: 400,
			});

			const errorInput = createValidationErrorInput('Invalid email');

			expect(errorInput.code).toBe(GraphQLErrorCode.VALIDATION_ERROR);
			expect(errorInput.statusCode).toBe(400);
		});
	});
});
