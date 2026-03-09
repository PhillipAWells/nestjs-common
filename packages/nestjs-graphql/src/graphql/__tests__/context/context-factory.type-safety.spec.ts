
import { Test, TestingModule } from '@nestjs/testing';
import { GraphQLContextFactory } from '../../context/context-factory.js';
import { IGraphQLContextExtended, IGraphQLUser } from '../../graphql/types/graphql-safety.types.js';
import { Request, Response } from 'express';

describe('GraphQLContextFactory - Type Safety', () => {
	let factory: GraphQLContextFactory;
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [GraphQLContextFactory]
		}).compile();

		factory = module.get<GraphQLContextFactory>(GraphQLContextFactory);

		mockReq = {
			user: {
				id: 'user-123',
				email: 'test@example.com',
				roles: ['admin']
			} as IGraphQLUser,
			headers: {},
			method: 'POST',
			url: '/graphql'
		};

		mockRes = {
			status: jest.fn().mockReturnThis(),
			send: jest.fn().mockReturnThis(),
			setHeader: jest.fn().mockReturnThis()
		};
	});

	describe('createHttpContext', () => {
		it('should create properly typed context with user information', async () => {
			const context = await factory.createHttpContext(
				mockReq as Request,
				mockRes as Response
			);

			// Type assertion validates compile-time type safety
			const typedContext: IGraphQLContextExtended = context;

			expect(typedContext).toBeDefined();
			expect(typedContext.req).toBeDefined();
			expect(typedContext.res).toBeDefined();
			expect(typedContext.requestId).toBeDefined();
			expect(typedContext.startTime).toBeInstanceOf(Date);
			expect(typedContext.user?.id).toBe('user-123');
			expect(typedContext.user?.email).toBe('test@example.com');
			expect(typedContext.user?.roles).toEqual(['admin']);
		});

		it('should create context without user when user is not present', async () => {
			const reqWithoutUser = { ...mockReq, user: undefined };

			const context = await factory.createHttpContext(
				reqWithoutUser as Request,
				mockRes as Response
			);

			const typedContext: IGraphQLContextExtended = context;

			expect(typedContext.user).toBeUndefined();
			expect(typedContext.requestId).toBeDefined();
		});

		it('should include request ID in context', async () => {
			const context = await factory.createHttpContext(
				mockReq as Request,
				mockRes as Response
			);

			const typedContext: IGraphQLContextExtended = context;

			expect(typeof typedContext.requestId).toBe('string');
			expect(typedContext.requestId.length).toBeGreaterThan(0);
		});

		it('should include start time in context', async () => {
			const beforeTime = Date.now();

			const context = await factory.createHttpContext(
				mockReq as Request,
				mockRes as Response
			);

			const afterTime = Date.now();
			const typedContext: IGraphQLContextExtended = context;

			expect(typedContext.startTime).toBeInstanceOf(Date);
			expect(typedContext.startTime.getTime()).toBeGreaterThanOrEqual(beforeTime);
			expect(typedContext.startTime.getTime()).toBeLessThanOrEqual(afterTime);
		});

		it('should allow context enhancers to modify context', async () => {
			const enhancer = jest.fn(async (ctx: IGraphQLContextExtended) => {
				ctx.custom = 'enhanced-value';
			});

			const context = await factory.createHttpContext(
				mockReq as Request,
				mockRes as Response,
				{ contextEnhancers: [enhancer] }
			);

			const typedContext: IGraphQLContextExtended = context;

			expect(enhancer).toHaveBeenCalledWith(context);
			expect(typedContext.custom).toBe('enhanced-value');
		});

		it('should use custom request ID generator', async () => {
			const customId = 'custom-request-id-123';
			const requestIdGenerator = jest.fn(() => customId);

			const context = await factory.createHttpContext(
				mockReq as Request,
				mockRes as Response,
				{ requestIdGenerator }
			);

			const typedContext: IGraphQLContextExtended = context;

			expect(requestIdGenerator).toHaveBeenCalled();
			expect(typedContext.requestId).toBe(customId);
		});
	});

	describe('createWebSocketContext', () => {
		it('should create properly typed WebSocket context', async () => {
			const mockConnection = {
				request: mockReq,
				user: {
					id: 'user-456',
					email: 'ws-user@example.com',
					roles: ['subscriber']
				} as IGraphQLUser,
				id: 'conn-789',
				params: { channelId: 'channel-1' }
			};

			const context = await factory.createWebSocketContext(mockConnection);

			const typedContext: IGraphQLContextExtended = context;

			expect(typedContext.req).toBeDefined();
			expect(typedContext.requestId).toBeDefined();
			expect(typedContext.startTime).toBeInstanceOf(Date);
			expect(typedContext.user?.id).toBe('user-456');
			// @ts-expect-error Testing runtime behavior
			expect(typedContext.connection).toBeDefined();
		});

		it('should handle missing connection properties gracefully', async () => {
			const minimalConnection = {
				request: mockReq
			};

			const context = await factory.createWebSocketContext(minimalConnection);

			const typedContext: IGraphQLContextExtended = context;

			expect(typedContext.requestId).toBeDefined();
			expect(typedContext.startTime).toBeInstanceOf(Date);
		});
	});

	describe('Type validation at compile time', () => {
		it('should satisfy GraphQL context interface requirements', async () => {
			const context = await factory.createHttpContext(
				mockReq as Request,
				mockRes as Response
			);

			// This type check happens at compile time
			// If it compiles, the type safety is correct
			const _validated: IGraphQLContextExtended = context;

			expect(_validated).toBeDefined();
		});

		it('should allow accessing user properties with type safety', async () => {
			const context = await factory.createHttpContext(
				mockReq as Request,
				mockRes as Response
			);

			const typedContext: IGraphQLContextExtended = context;

			// These accesses are type-safe and won't produce 'any' errors
			if (typedContext.user) {
				const userId: string = typedContext.user.id;
				const userEmail: string | undefined = typedContext.user.email;
				const userRoles: string[] | undefined = typedContext.user.roles;

				expect(userId).toBe('user-123');
				expect(userEmail).toBe('test@example.com');
				expect(userRoles).toEqual(['admin']);
			}
		});
	});
});
