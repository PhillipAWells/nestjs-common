import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExtractRequestFromContext } from '../decorators/context-utils.js';
import { PERMISSIONS_KEY } from '../decorators/auth-decorators.js';
import type { KeycloakUser } from '../keycloak/keycloak.types.js';

/**
 * Permission-based Authorization Guard
 *
 * Authorizes access based on user permissions specified by the `@Permissions()` decorator.
 * Checks permissions against user roles (realm roles and client roles combined).
 *
 * Uses OR logic — access is granted if the user has ANY of the required permissions.
 * If no permissions are specified via `@Permissions()`, access is allowed by default.
 *
 * Throws `ForbiddenException` if the user lacks all required permissions.
 *
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, PermissionGuard)
 * @Controller('data')
 * export class DataController {
 *   @Permissions('read:data', 'write:data')
 *   @Get(':id')
 *   getData(@Param('id') id: string) {
 *     // User must have 'read:data' OR 'write:data' permission
 *     return {};
 *   }
 * }
 * ```
 */
@Injectable()
export class PermissionGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	public canActivate(context: ExecutionContext): boolean {
		const requiredPermissions = this.reflector.get<string[]>(PERMISSIONS_KEY, context.getHandler());

		if (!requiredPermissions || requiredPermissions.length === 0) {
			// No permissions required, allow access
			return true;
		}

		const request = ExtractRequestFromContext(context);
		const user = request.user as KeycloakUser | undefined;

		if (!user) {
			throw new ForbiddenException('User not authenticated');
		}

		// Check if user has any of the required permissions in realmRoles or clientRoles
		const userRoles = [...user.realmRoles, ...user.clientRoles];
		const hasRequiredPermission = requiredPermissions.some(permission => userRoles.includes(permission));

		if (!hasRequiredPermission) {
			throw new ForbiddenException(`Insufficient permissions. Required permissions: ${requiredPermissions.join(', ')}`);
		}

		return true;
	}
}
