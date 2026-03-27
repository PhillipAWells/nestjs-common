import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to specify required roles for a route or method
 *
 * @param roles - Array of role names required to access the resource
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Roles('admin', 'moderator')
 * @Get('admin-only')
 * async getAdminData() {
 *   // Only users with 'admin' or 'moderator' roles can access
 * }
 * ```
 */
export const Roles = (...roles: string[]): MethodDecorator => SetMetadata('roles', roles);

/**
 * Decorator to specify required permissions for a route or method
 *
 * @param permissions - Array of permission names required to access the resource
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Permissions('user.create', 'user.update')
 * @Post('users')
 * async createUser(@Body() userData: CreateUserDto) {
 *   // Only users with 'user.create' AND 'user.update' permissions can access
 * }
 * ```
 */
export const Permissions = (...permissions: string[]): MethodDecorator => SetMetadata('permissions', permissions);

/**
 * Decorator to mark a route as public (bypasses authentication guards)
 *
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Public()
 * @Get('health')
 * async getHealth() {
 *   // This endpoint is accessible without authentication
 * }
 * ```
 */
export const Public = (): MethodDecorator => SetMetadata('isPublic', true);
