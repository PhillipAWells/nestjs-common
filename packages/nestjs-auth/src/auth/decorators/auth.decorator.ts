import { createConditionalDecorator, RequestProperty } from '@pawells/nestjs-shared/common';

/**
 * Key for authentication metadata
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Key for roles metadata
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator to mark a route as public (no authentication required)
 * @returns Method decorator
 *
 * @example
 * @Public()
 * @Get('health')
 * checkHealth() {}
 */
export const Public = () => createConditionalDecorator({
	key: IS_PUBLIC_KEY,
	value: true,
});

/**
 * Decorator to mark a route as requiring authentication
 * @returns Method decorator
 *
 * @example
 * @Auth()
 * @Get('profile')
 * getProfile() {}
 */
export const Auth = () => createConditionalDecorator({
	key: IS_PUBLIC_KEY,
	value: false,
});

/**
 * Decorator to specify required roles for a route
 * @param roles - Array of required roles
 * @returns Method decorator
 *
 * @example
 * @Roles('admin', 'moderator')
 * @Post('admin-action')
 * adminAction() {}
 */
export const Roles = (...roles: string[]) => createConditionalDecorator({
	key: ROLES_KEY,
	value: roles,
});

/**
 * Decorator to extract the current authenticated user from request
 * @returns Parameter decorator
 *
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: User) {}
 *
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser('id') userId: string) {}
 */
export const CurrentUser = RequestProperty('user');

/**
 * Decorator to extract the authorization token from request headers
 * @returns Parameter decorator
 *
 * @example
 * @Get('validate-token')
 * validateToken(@AuthToken() token: string) {}
 */
export const AuthToken = RequestProperty('headers.authorization');
