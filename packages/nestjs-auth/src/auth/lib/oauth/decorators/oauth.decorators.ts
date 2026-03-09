import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { OAuthUser } from '../types/oauth-config.types.js';

/**
 * Extract authenticated OAuth user from request context
 */
export const GetOAuthUser = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): OAuthUser => {
		const request = ctx.switchToHttp().getRequest();
		return request.user;
	}
);

/**
 * Decorator to specify required OAuth roles
 */
export const OAuthRoles = (...roles: string[]) => {
	return (target: any, propertyKey: string, _descriptor: PropertyDescriptor) => {
		// Store roles metadata
		Reflect.defineMetadata('oauth:roles', roles, target.constructor, propertyKey);
	};
};

/**
 * Decorator to specify OAuth provider
 */
export const OAuthProvider = (provider: string) => {
	return (target: any, propertyKey: string, _descriptor: PropertyDescriptor) => {
		// Store provider metadata
		Reflect.defineMetadata('oauth:provider', provider, target.constructor, propertyKey);
	};
};
