import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { createConditionalDecorator } from '@pawells/nestjs-shared/common';
import { ContextOptions, ExtractRequestFromContext } from './context-utils.js';

/**
 * Authentication Decorators for NestJS
 *
 * This module provides base authentication decorators that work across different
 * NestJS contexts (HTTP, GraphQL, WebSockets). These decorators use standardized
 * metadata keys and can be extended by context-specific packages.
 *
 * @packageDocumentation
 */

/**
 * Metadata key for public access routes/resolvers
 * Used by guards to determine if authentication is required
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Metadata key for role-based access control
 * Used by guards to check user permissions
 */
export const ROLES_KEY = 'roles';

/**
 * Metadata key for permission-based access control
 * Used by guards to check user permissions
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to mark routes/resolvers as public (no authentication required)
 *
 * This decorator sets the IS_PUBLIC_KEY metadata to true, signaling to
 * authentication guards that the decorated endpoint should be accessible
 * without authentication.
 *
 * @returns Method decorator that marks the endpoint as public
 *
 * @example
 * ```typescript
 * @Public()
 * @Get('health')
 * checkHealth() {
 *   return { status: 'ok' };
 * }
 * ```
 *
 * @example GraphQL
 * ```typescript
 * @Public()
 * @Query(() => String)
 * async getHealth(): Promise<string> {
 *   return 'OK';
 * }
 * ```
 */
export const Public = (): MethodDecorator => createConditionalDecorator({
	key: IS_PUBLIC_KEY,
	value: true,
});

/**
 * Decorator to mark routes/resolvers as requiring authentication
 *
 * This decorator sets the IS_PUBLIC_KEY metadata to false, ensuring that
 * authentication guards will require valid credentials for the decorated endpoint.
 *
 * @returns Method decorator that marks the endpoint as requiring authentication
 *
 * @example
 * ```typescript
 * @Auth()
 * @Get('profile')
 * getProfile() {
 *   // This endpoint requires authentication
 * }
 * ```
 *
 * @example GraphQL
 * ```typescript
 * @Auth()
 * @Query(() => User)
 * async getCurrentUser(@CurrentUser() user: User): Promise<User> {
 *   return user;
 * }
 * ```
 */
export const Auth = (): MethodDecorator => createConditionalDecorator({
	key: IS_PUBLIC_KEY,
	value: false,
});

/**
 * Decorator to specify required roles for routes/resolvers
 *
 * This decorator sets the ROLES_KEY metadata with an array of required roles.
 * Role guards will check that the authenticated user has at least one of the
 * specified roles before allowing access.
 *
 * @param roles - Array of role names required for access
 * @returns Method decorator that specifies role requirements
 *
 * @example
 * ```typescript
 * @Roles('admin', 'moderator')
 * @Post('admin-action')
 * adminAction() {
 *   // Only users with 'admin' or 'moderator' roles can access
 * }
 * ```
 *
 * @example GraphQL
 * ```typescript
 * @Roles('admin')
 * @Mutation(() => User)
 * async updateUser(@Args('input') input: UpdateUserInput): Promise<User> {
 *   // Only admin users can update other users
 * }
 * ```
 */
export const Roles = (...roles: string[]): MethodDecorator => createConditionalDecorator({
	key: ROLES_KEY,
	value: roles,
});

/**
 * Decorator to specify required permissions for routes/resolvers
 *
 * This decorator sets the PERMISSIONS_KEY metadata with an array of required permissions.
 * Permission guards check that the authenticated user has at least one of the specified
 * permissions (OR logic). Uses roles-as-permissions semantics — permission strings are
 * matched against user role names.
 *
 * @param permissions - Array of permission names required for access
 * @returns Method decorator that specifies permission requirements
 *
 * @example
 * ```typescript
 * @Permissions('user.create', 'user.update')
 * @Post('users')
 * createUser(@Body() data: CreateUserDto) {
 *   // Only users with 'user.create' OR 'user.update' role can access (roles-as-permissions)
 * }
 * ```
 *
 * @example GraphQL
 * ```typescript
 * @Permissions('user.delete')
 * @Mutation(() => Boolean)
 * async deleteUser(@Args('id') id: string): Promise<boolean> {
 *   // Only users with 'user.delete' role can delete users
 * }
 * ```
 */
export const Permissions = (...permissions: string[]): MethodDecorator => createConditionalDecorator({
	key: PERMISSIONS_KEY,
	value: permissions,
});

// Re-export context utilities for convenience
export type { ContextOptions } from './context-utils.js';
export { detectContextType, extractRequestFromContext, extractUserFromContext, extractAuthTokenFromContext } from './context-utils.js';

/**
 * Parameter decorator to extract the current authenticated user
 *
 * This decorator injects the authenticated user object from the request context
 * into method parameters. The user object is typically populated by authentication
 * guards during the request processing pipeline.
 *
 * Supports both HTTP and GraphQL contexts with automatic detection or explicit specification.
 *
 * @param property - Optional property path to extract from the user object (e.g., 'id', 'profile.name')
 * @param options - Context options for controlling extraction behavior
 * @returns Parameter decorator that injects the current user or user property
 *
 * @example HTTP context (auto-detected)
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 * ```
 *
 * @example With property access
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentUser('id') userId: string) {
 *   return this.userService.findById(userId);
 * }
 * ```
 *
 * @example GraphQL context (explicit)
 * ```typescript
 * @Query(() => User)
 * async getCurrentUser(@CurrentUser(undefined, { contextType: 'graphql' }) user: User): Promise<User> {
 *   return user;
 * }
 * ```
 *
 * @example Auto-detect context
 * ```typescript
 * @UseGuards(AuthGuard)
 * getData(@CurrentUser() user: User) {
 *   // Works in both HTTP and GraphQL contexts
 * }
 * ```
 */
export function CurrentUser(property?: string, options?: ContextOptions): ParameterDecorator {
	return createParamDecorator(
		(_data: unknown, ctx: ExecutionContext) => {
			const request = ExtractRequestFromContext(ctx, options);
			const user = request?.user;

			if (property !== undefined && user) {
				return user[property];
			}

			return user;
		},
	)();
}

/**
 * Parameter decorator to extract the authorization token from request headers
 *
 * This decorator injects the raw authorization token from the request headers
 * into method parameters. Useful for custom token validation or when you need
 * access to the raw token string.
 *
 * Supports both HTTP and GraphQL contexts with automatic detection or explicit specification.
 *
 * @param options - Context options for controlling extraction behavior
 * @returns Parameter decorator that injects the authorization token
 *
 * @example HTTP context (auto-detected)
 * ```typescript
 * @Get('validate-token')
 * validateToken(@AuthToken() token: string) {
 *   return this.authService.validateToken(token);
 * }
 * ```
 *
 * @example GraphQL context (explicit)
 * ```typescript
 * @Query(() => Boolean)
 * async validateToken(@AuthToken({ contextType: 'graphql' }) token: string): Promise<boolean> {
 *   return this.authService.validateToken(token);
 * }
 * ```
 */
export function AuthToken(options?: ContextOptions): ParameterDecorator {
	return createParamDecorator(
		(_data: unknown, ctx: ExecutionContext) => {
			const request = ExtractRequestFromContext(ctx, options);

			if (!request?.headers) {
				return undefined;
			}

			const authHeader = request.headers.authorization ?? request.headers.Authorization;

			if (typeof authHeader === 'string') {
				return authHeader.replace(/^Bearer\s+/i, '');
			}

			return undefined;
		},
	)();
}
