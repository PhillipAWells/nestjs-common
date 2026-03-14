import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { OAuthUser } from '../types/oauth-config.types.js';

/**
 * Parameter decorator to extract authenticated OAuth user from request context
 *
 * @returns Parameter decorator that injects the OAuth user object
 *
 * @example
 * ```typescript
 * @Get('profile')
 * getProfile(@GetOAuthUser() user: OAuthUser) {
 *   return { user };
 * }
 * ```
 */
export const GetOAuthUser = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): OAuthUser => {
		const request = ctx.switchToHttp().getRequest();
		return request.user;
	},
);

/**
 * Method decorator to specify required OAuth roles
 * Stores role metadata on the method for guard-based authorization.
 *
 * @param roles OAuth roles required for access
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @OAuthRoles('admin', 'user')
 * @Get('protected')
 * getProtected() {
 *   return { data: 'protected' };
 * }
 * ```
 */
export const OAuthRoles = (...roles: string[]) => {
	return (target: any, propertyKey: string, _descriptor: PropertyDescriptor) => {
		// Store roles metadata
		Reflect.defineMetadata('oauth:roles', roles, target.constructor, propertyKey);
	};
};

/**
 * Method decorator to specify OAuth provider
 * Stores provider metadata on the method for provider-specific handling.
 *
 * @param provider OAuth provider name (e.g., 'keycloak', 'google')
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @OAuthProvider('keycloak')
 * @Get('keycloak-callback')
 * handleKeycloakCallback() {
 *   return { success: true };
 * }
 * ```
 */
export const OAuthProvider = (provider: string) => {
	return (target: any, propertyKey: string, _descriptor: PropertyDescriptor) => {
		// Store provider metadata
		Reflect.defineMetadata('oauth:provider', provider, target.constructor, propertyKey);
	};
};
