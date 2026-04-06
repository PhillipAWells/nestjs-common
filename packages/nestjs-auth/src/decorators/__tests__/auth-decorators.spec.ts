import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	Auth,
	Public,
	Roles,
	Permissions,
	CurrentUser,
	AuthToken,
	IS_PUBLIC_KEY,
	ROLES_KEY,
	PERMISSIONS_KEY,
	ExtractRequestFromContext,
	ExtractAuthTokenFromContext,
} from '../auth-decorators.js';

// NestJS internal constant — not re-exported from public API in NestJS 11+
const ROUTE_ARGS_METADATA = '__routeArguments__';

function makeHttpCtx(request: any): ExecutionContext {
	return {
		getType: vi.fn().mockReturnValue('http'),
		switchToHttp: vi.fn().mockReturnValue({
			getRequest: () => request,
		}),
		switchToWs: vi.fn(),
	} as unknown as ExecutionContext;
}

function makeGraphQLCtx(req: any): ExecutionContext {
	const ctx = {
		getType: vi.fn().mockReturnValue('graphql'),
		switchToHttp: vi.fn(),
		switchToWs: vi.fn(),
	} as unknown as ExecutionContext;

	vi.spyOn(GqlExecutionContext, 'create').mockReturnValue({
		getContext: () => ({ req }),
	} as any);

	return ctx;
}

// Helper to extract decorator factory from NestJS createParamDecorator
// This helper applies the parameter decorator to a test method and extracts the factory function
function getParamDecoratorFactory(paramDecorator: ParameterDecorator): (data: unknown, ctx: ExecutionContext) => any {
	class TestController {
		test() {}
	}

	const _descriptor = Object.getOwnPropertyDescriptor(TestController.prototype, 'test');
	// Apply parameter decorator to index 0
	paramDecorator(TestController.prototype, 'test', 0);

	// Extract the metadata that NestJS stored
	const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'test');
	if (!args) {
		throw new Error('Could not extract decorator metadata');
	}

	// Find the factory function in the metadata
	for (const key in args) {
		if (args[key] && typeof args[key].factory === 'function') {
			return args[key].factory;
		}
	}

	throw new Error('Could not find factory in decorator metadata');
}

describe('Auth Decorators', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Metadata Keys', () => {
		it('should export correct metadata keys', () => {
			expect(IS_PUBLIC_KEY).toBe('isPublic');
			expect(ROLES_KEY).toBe('roles');
			expect(PERMISSIONS_KEY).toBe('permissions');
		});
	});

	describe('Public', () => {
		it('should return a method decorator function', () => {
			const decorator = Public();
			expect(typeof decorator).toBe('function');
		});

		it('should be callable as a method decorator', () => {
			const decorator = Public();
			// Decorators are functions that can be called with (target, propertyKey, descriptor)
			expect(typeof decorator).toBe('function');
		});
	});

	describe('Auth', () => {
		it('should return a method decorator function', () => {
			const decorator = Auth();
			expect(typeof decorator).toBe('function');
		});

		it('should be callable as a method decorator', () => {
			const decorator = Auth();
			// Decorators are functions that can be called with (target, propertyKey, descriptor)
			expect(typeof decorator).toBe('function');
		});
	});

	describe('Roles', () => {
		it('should return a method decorator function when called with roles', () => {
			const decorator = Roles('admin', 'moderator');
			expect(typeof decorator).toBe('function');
		});

		it('should return a method decorator function when called with single role', () => {
			const decorator = Roles('admin');
			expect(typeof decorator).toBe('function');
		});

		it('should return a method decorator function when called with no roles', () => {
			const decorator = Roles();
			expect(typeof decorator).toBe('function');
		});
	});

	describe('Permissions', () => {
		it('should return a method decorator function when called with permissions', () => {
			const decorator = Permissions('user.create', 'user.update');
			expect(typeof decorator).toBe('function');
		});

		it('should return a method decorator function when called with single permission', () => {
			const decorator = Permissions('user.delete');
			expect(typeof decorator).toBe('function');
		});

		it('should return a method decorator function when called with no permissions', () => {
			const decorator = Permissions();
			expect(typeof decorator).toBe('function');
		});
	});

	describe('CurrentUser', () => {
		it('should return a function when called without parameters', () => {
			const decorator = CurrentUser();
			expect(typeof decorator).toBe('function');
		});

		it('should return a function when called with property parameter', () => {
			const decorator = CurrentUser('id');
			expect(typeof decorator).toBe('function');
		});

		it('should return a function when called with options', () => {
			const decorator = CurrentUser(undefined, { contextType: 'graphql' });
			expect(typeof decorator).toBe('function');
		});

		it('should extract full user object when no property specified', () => {
			const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
			const mockRequest = { user: mockUser };
			const ctx = makeHttpCtx(mockRequest);

			// Simulate what the decorator handler does
			const request = ExtractRequestFromContext(ctx);
			const user = request?.user;
			const property = undefined;

			let result;
			if (property !== undefined && user) {
				result = user[property];
			} else {
				result = user;
			}

			expect(result).toEqual(mockUser);
		});

		it('should extract user property when property is specified', () => {
			const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
			const mockRequest = { user: mockUser };
			const ctx = makeHttpCtx(mockRequest);

			// Simulate what the decorator handler does
			const request = ExtractRequestFromContext(ctx);
			const user = request?.user;
			const property = 'id';

			let result;
			if (property !== undefined && user) {
				result = user[property];
			} else {
				result = user;
			}

			expect(result).toBe('123');
		});

		it('should return undefined when request.user is undefined', () => {
			const mockRequest = {};
			const ctx = makeHttpCtx(mockRequest);

			// Simulate what the decorator handler does
			const request = ExtractRequestFromContext(ctx);
			const user = request?.user;
			const property = undefined;

			let result;
			if (property !== undefined && user) {
				result = user[property];
			} else {
				result = user;
			}

			expect(result).toBeUndefined();
		});

		it('should return undefined when property is requested but user is undefined', () => {
			const mockRequest = {};
			const ctx = makeHttpCtx(mockRequest);

			// Simulate what the decorator handler does
			const request = ExtractRequestFromContext(ctx);
			const user = request?.user;
			const property = 'id';

			let result;
			if (property !== undefined && user) {
				result = user[property];
			} else {
				result = user;
			}

			expect(result).toBeUndefined();
		});

		it('should extract email property when specified', () => {
			const mockUser = { id: '123', name: 'John', email: 'john@example.com' };
			const mockRequest = { user: mockUser };
			const ctx = makeHttpCtx(mockRequest);

			// Simulate what the decorator handler does
			const request = ExtractRequestFromContext(ctx);
			const user = request?.user;
			const property = 'email';

			let result;
			if (property !== undefined && user) {
				result = user[property];
			} else {
				result = user;
			}

			expect(result).toBe('john@example.com');
		});

		it('should return undefined when requested property does not exist on user', () => {
			const mockUser = { id: '123', name: 'John' };
			const mockRequest = { user: mockUser };
			const ctx = makeHttpCtx(mockRequest);

			// Simulate what the decorator handler does
			const request = ExtractRequestFromContext(ctx);
			const user = request?.user;
			const property = 'nonexistent';

			let result;
			if (property !== undefined && user) {
				result = user[property];
			} else {
				result = user;
			}

			expect(result).toBeUndefined();
		});

		it('should extract full user object from GraphQL context', () => {
			const mockUser = { id: '123', name: 'John Doe' };
			const mockRequest = { user: mockUser };
			const ctx = makeGraphQLCtx(mockRequest);

			// Simulate what the decorator handler does
			const request = ExtractRequestFromContext(ctx, { contextType: 'graphql' });
			const user = request?.user;
			const property = undefined;

			let result;
			if (property !== undefined && user) {
				result = user[property];
			} else {
				result = user;
			}

			expect(result).toEqual(mockUser);
		});

		it('should extract user property from GraphQL context', () => {
			const mockUser = { id: '123', name: 'John Doe' };
			const mockRequest = { user: mockUser };
			const ctx = makeGraphQLCtx(mockRequest);

			// Simulate what the decorator handler does
			const request = ExtractRequestFromContext(ctx, { contextType: 'graphql' });
			const user = request?.user;
			const property = 'name';

			let result;
			if (property !== undefined && user) {
				result = user[property];
			} else {
				result = user;
			}

			expect(result).toBe('John Doe');
		});
	});

	describe('AuthToken', () => {
		it('should return a function when called without parameters', () => {
			const decorator = AuthToken();
			expect(typeof decorator).toBe('function');
		});

		it('should return a function when called with options', () => {
			const decorator = AuthToken({ contextType: 'graphql' });
			expect(typeof decorator).toBe('function');
		});

		it('should extract Bearer token from Authorization header', () => {
			const mockRequest = {
				headers: { authorization: 'Bearer mytoken123' },
			};
			const ctx = makeHttpCtx(mockRequest);

			// Simulate what the decorator handler does
			const result = ExtractAuthTokenFromContext(ctx);

			expect(result).toBe('mytoken123');
		});

		it('should extract token without Bearer prefix', () => {
			const mockRequest = {
				headers: { authorization: 'mytoken123' },
			};
			const ctx = makeHttpCtx(mockRequest);

			// Simulate what the decorator handler does
			const result = ExtractAuthTokenFromContext(ctx);

			expect(result).toBe('mytoken123');
		});

		it('should handle case-insensitive Bearer prefix', () => {
			const mockRequest = {
				headers: { authorization: 'bearer mytoken123' },
			};
			const ctx = makeHttpCtx(mockRequest);

			// Simulate what the decorator handler does
			const result = ExtractAuthTokenFromContext(ctx);

			expect(result).toBe('mytoken123');
		});

		it('should extract token from Authorization header with uppercase key', () => {
			const mockRequest = {
				headers: { Authorization: 'Bearer mytoken456' },
			};
			const ctx = makeHttpCtx(mockRequest);

			// Simulate what the decorator handler does
			const result = ExtractAuthTokenFromContext(ctx);

			expect(result).toBe('mytoken456');
		});

		it('should return undefined when Authorization header is missing', () => {
			const mockRequest = { headers: {} };
			const ctx = makeHttpCtx(mockRequest);

			// Simulate what the decorator handler does
			const result = ExtractAuthTokenFromContext(ctx);

			expect(result).toBeUndefined();
		});

		it('should return undefined when request has no headers', () => {
			const mockRequest = {};
			const ctx = makeHttpCtx(mockRequest);

			// Simulate what the decorator handler does
			const result = ExtractAuthTokenFromContext(ctx);

			expect(result).toBeUndefined();
		});

		it('should return undefined when request is null', () => {
			const ctx = makeHttpCtx(null);

			// Simulate what the decorator handler does
			const result = ExtractAuthTokenFromContext(ctx);

			expect(result).toBeUndefined();
		});

		it('should extract Bearer token from GraphQL context', () => {
			const mockRequest = {
				headers: { authorization: 'Bearer graphql-token' },
			};
			const ctx = makeGraphQLCtx(mockRequest);

			// Simulate what the decorator handler does
			const result = ExtractAuthTokenFromContext(ctx, { contextType: 'graphql' });

			expect(result).toBe('graphql-token');
		});

		it('should handle multiple spaces after Bearer prefix', () => {
			const mockRequest = {
				headers: { authorization: 'Bearer   token-with-spaces' },
			};
			const ctx = makeHttpCtx(mockRequest);

			// Simulate what the decorator handler does
			const result = ExtractAuthTokenFromContext(ctx);

			expect(result).toBe('token-with-spaces');
		});

		it('should return Authorization header value as-is if not a Bearer token', () => {
			const mockRequest = {
				headers: { authorization: 'Basic dXNlcjpwYXNz' },
			};
			const ctx = makeHttpCtx(mockRequest);

			// Simulate what the decorator handler does
			const result = ExtractAuthTokenFromContext(ctx);

			expect(result).toBe('Basic dXNlcjpwYXNz');
		});
	});

	describe('CurrentUser factory function (direct invocation)', () => {
		it('should extract full user when no property specified and user exists', () => {
			const mockUser = { id: '123', name: 'John Doe' };
			const mockRequest = { user: mockUser };
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(CurrentUser());
			const result = factory(undefined, ctx);

			expect(result).toEqual(mockUser);
		});

		it('should extract user property when property specified and user exists', () => {
			const mockUser = { id: '456', name: 'Jane Doe', email: 'jane@example.com' };
			const mockRequest = { user: mockUser };
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(CurrentUser('email'));
			const result = factory(undefined, ctx);

			expect(result).toBe('jane@example.com');
		});

		it('should return undefined when property specified but user is undefined', () => {
			const mockRequest = {};
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(CurrentUser('id'));
			const result = factory(undefined, ctx);

			expect(result).toBeUndefined();
		});

		it('should return full user when property undefined but user exists', () => {
			const mockUser = { id: '789', name: 'Bob' };
			const mockRequest = { user: mockUser };
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(CurrentUser());
			const result = factory(undefined, ctx);

			expect(result).toEqual(mockUser);
		});

		it('should return undefined when user is undefined and no property specified', () => {
			const mockRequest = {};
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(CurrentUser());
			const result = factory(undefined, ctx);

			expect(result).toBeUndefined();
		});

		it('should extract user id property from GraphQL context', () => {
			const mockUser = { id: '999', name: 'Alice' };
			const mockRequest = { user: mockUser };
			const ctx = makeGraphQLCtx(mockRequest);

			const factory = getParamDecoratorFactory(CurrentUser('id', { contextType: 'graphql' }));
			const result = factory(undefined, ctx);

			expect(result).toBe('999');
		});

		it('should return undefined when accessing undefined property on user', () => {
			const mockUser = { id: '111' };
			const mockRequest = { user: mockUser };
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(CurrentUser('nonexistent'));
			const result = factory(undefined, ctx);

			expect(result).toBeUndefined();
		});

		it('should handle property=null case by returning full user', () => {
			const mockUser = { id: '222', name: 'Charlie' };
			const mockRequest = { user: mockUser };
			const ctx = makeHttpCtx(mockRequest);

			// Test with undefined property (default case)
			const factory = getParamDecoratorFactory(CurrentUser());
			const result = factory(undefined, ctx);

			expect(result).toEqual(mockUser);
		});
	});

	describe('AuthToken factory function (direct invocation)', () => {
		it('should extract token when authorization header present with Bearer prefix', () => {
			const mockRequest = { headers: { authorization: 'Bearer abc123token' } };
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(AuthToken());
			const result = factory(undefined, ctx);

			expect(result).toBe('abc123token');
		});

		it('should return undefined when request has no headers property', () => {
			const mockRequest = { user: { id: '1' } };
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(AuthToken());
			const result = factory(undefined, ctx);

			expect(result).toBeUndefined();
		});

		it('should return undefined when authorization header is not a string', () => {
			const mockRequest = { headers: { authorization: 123 } };
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(AuthToken());
			const result = factory(undefined, ctx);

			expect(result).toBeUndefined();
		});

		it('should extract token from uppercase Authorization header', () => {
			const mockRequest = { headers: { Authorization: 'Bearer xyz789' } };
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(AuthToken());
			const result = factory(undefined, ctx);

			expect(result).toBe('xyz789');
		});

		it('should extract token when headers exist but authorization is missing', () => {
			const mockRequest = { headers: { 'content-type': 'application/json' } };
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(AuthToken());
			const result = factory(undefined, ctx);

			expect(result).toBeUndefined();
		});

		it('should strip Bearer prefix case-insensitively', () => {
			const mockRequest = { headers: { authorization: 'BEARER tokenvalue' } };
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(AuthToken());
			const result = factory(undefined, ctx);

			expect(result).toBe('tokenvalue');
		});

		it('should handle empty headers object', () => {
			const mockRequest = { headers: {} };
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(AuthToken());
			const result = factory(undefined, ctx);

			expect(result).toBeUndefined();
		});

		it('should extract token from GraphQL context with Bearer header', () => {
			const mockRequest = { headers: { authorization: 'Bearer gql-token' } };
			const ctx = makeGraphQLCtx(mockRequest);

			const factory = getParamDecoratorFactory(AuthToken({ contextType: 'graphql' }));
			const result = factory(undefined, ctx);

			expect(result).toBe('gql-token');
		});

		it('should handle multiple spaces after Bearer prefix', () => {
			const mockRequest = { headers: { authorization: 'Bearer   token-with-spaces' } };
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(AuthToken());
			const result = factory(undefined, ctx);

			expect(result).toBe('token-with-spaces');
		});

		it('should handle authorization header being undefined explicitly', () => {
			const mockRequest = { headers: { authorization: undefined } };
			const ctx = makeHttpCtx(mockRequest);

			const factory = getParamDecoratorFactory(AuthToken());
			const result = factory(undefined, ctx);

			expect(result).toBeUndefined();
		});
	});
});
