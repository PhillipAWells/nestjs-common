import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Auth, Public, Roles, CurrentUser, AuthToken } from './auth-decorators.js';

/**
 * GraphQL Authentication Decorators
 *
 * These decorators provide GraphQL-specific authentication and authorization
 * functionality by extending the base decorators with GraphQL context options.
 * They maintain the same API as the base decorators but automatically configure
 * for GraphQL execution context.
 *
 * @packageDocumentation
 */

/**
 * GraphQL-specific Public decorator
 *
 * Marks GraphQL resolvers as publicly accessible, bypassing authentication.
 * Equivalent to @Public() but explicitly configured for GraphQL context.
 *
 * @returns Method decorator that marks the GraphQL resolver as public
 *
 * @example
 * ```typescript
 * @GraphQLPublic()
 * @Query(() => String, { name: 'GetHealth' })
 * async getHealth(): Promise<string> {
 *   return 'OK';
 * }
 * ```
 */
export const GraphQLPublic = Public;

/**
 * GraphQL-specific Auth decorator
 *
 * Marks GraphQL resolvers as requiring authentication.
 * Equivalent to @Auth() but explicitly configured for GraphQL context.
 *
 * @returns Method decorator that marks the GraphQL resolver as requiring authentication
 *
 * @example
 * ```typescript
 * @GraphQLAuth()
 * @Query(() => IUser, { name: 'GetCurrentUser' })
 * async getCurrentUser(@GraphQLCurrentUser() user: IUser): Promise<IUser> {
 *   return user;
 * }
 * ```
 */
export const GraphQLAuth = Auth;

/**
 * GraphQL-specific Roles decorator
 *
 * Specifies the roles required to access GraphQL resolvers.
 * Equivalent to @Roles() but explicitly configured for GraphQL context.
 *
 * @param roles - Array of role names required for access
 * @returns Method decorator that specifies role requirements for GraphQL resolvers
 *
 * @example
 * ```typescript
 * @GraphQLRoles('admin', 'moderator')
 * @Query(() => [IUser], { name: 'GetUsers' })
 * async getUsers(): Promise<IUser[]> {
 *   // Only users with 'admin' or 'moderator' roles can access
 * }
 * ```
 */
export const GraphQLRoles = Roles;

/**
 * GraphQL-specific CurrentUser decorator
 *
 * Injects the currently authenticated user into GraphQL resolver parameters.
 * Uses GraphQL context to extract the user object populated by authentication guards.
 *
 * @param property - Optional property path to extract from the user object (e.g., 'id', 'profile.name')
 * @returns Parameter decorator that injects the current user from GraphQL context
 *
 * @example
 * ```typescript
 * @Query(() => IUser, { name: 'GetCurrentUser' })
 * async getCurrentUser(@GraphQLCurrentUser() user: IUser): Promise<IUser> {
 *   return user;
 * }
 * ```
 *
 * @example With property access
 * ```typescript
 * @Query(() => String, { name: 'GetUserId' })
 * async getUserId(@GraphQLCurrentUser('id') userId: string): Promise<string> {
 *   return userId;
 * }
 * ```
 */
export function GraphQLCurrentUser(property?: string): ParameterDecorator {
	return CurrentUser(property, { contextType: 'graphql' });
}

/**
 * GraphQL-specific AuthToken decorator
 *
 * Injects the authorization token from GraphQL request context headers.
 * Useful for custom token validation in GraphQL resolvers.
 *
 * @returns Parameter decorator that injects the authorization token
 *
 * @example
 * ```typescript
 * @Query(() => Boolean, { name: 'ValidateToken' })
 * async validateToken(@GraphQLAuthToken() token: string): Promise<boolean> {
 *   return this.authService.validateToken(token);
 * }
 * ```
 */
export const GraphQLAuthToken = (): ParameterDecorator => AuthToken({ contextType: 'graphql' });

/**
 * GraphQL Context Parameter decorator
 *
 * Injects the entire GraphQL context object into resolver parameters.
 * Provides access to request, response, and other context data in GraphQL resolvers.
 *
 * @returns Parameter decorator that injects the GraphQL context
 *
 * @example
 * ```typescript
 * @Query(() => String, { name: 'GetRequestId' })
 * async getRequestId(@GraphQLContextParam() context: any): Promise<string> {
 *   return context.req.headers['x-request-id'];
 * }
 * ```
 */
export const GraphQLContextParam = (): ParameterDecorator => createParamDecorator(
	(_data: unknown, ctx: ExecutionContext) => {
		const gqlCtx = GqlExecutionContext.create(ctx);
		return gqlCtx.getContext();
	},
)();

/**
 * GraphQL IUser alias for GraphQLCurrentUser
 *
 * Alternative name for GraphQLCurrentUser decorator specifically for GraphQL contexts.
 * Provides the same functionality with a more explicit name.
 *
 * @param property - Optional property path to extract from the user object
 * @returns Parameter decorator that injects the current user
 *
 * @example
 * ```typescript
 * @Query(() => IUser, { name: 'GetCurrentUser' })
 * async getCurrentUser(@GraphQLUser() user: IUser): Promise<IUser> {
 *   return user;
 * }
 * ```
 */
export const GraphQLUser = GraphQLCurrentUser;
