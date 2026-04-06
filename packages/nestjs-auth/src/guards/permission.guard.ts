import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExtractRequestFromContext } from '../decorators/context-utils.js';
import { PERMISSIONS_KEY } from '../decorators/auth-decorators.js';
import type { IKeycloakUser } from '../keycloak/keycloak.types.js';

/**
 * Permission-based Authorization Guard
 *
 * Authorizes access based on user permissions specified by the `@Permissions()` decorator.
 * Uses roles-as-permissions semantics: checks that the authenticated user has at least one
 * role whose name matches a required permission string. Permission strings are matched directly
 * against Keycloak role names (both realm-level and client-specific roles are checked).
 *
 * Uses OR logic — access is granted if the user has ANY of the required permissions (i.e., if
 * any user role name matches any required permission string).
 * If no permissions are specified via `@Permissions()`, access is allowed by default.
 *
 * Throws `UnauthorizedException` if the user is not authenticated (missing from request).
 * Throws `ForbiddenException` if the user is authenticated but lacks all required permissions.
 *
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, PermissionGuard)
 * @Controller('data')
 * export class DataController {
 *   @Permissions('read:data', 'write:data')
 *   @Get(':id')
 *   getData(@Param('id') id: string) {
 *     // IUser must have a role named 'read:data' OR 'write:data' (roles-as-permissions)
 *     return {};
 *   }
 * }
 * ```
 */
@Injectable()
export class PermissionGuard implements CanActivate {
	private readonly Reflector: Reflector;

	constructor(reflector: Reflector) {
		this.Reflector = reflector;
	}

	public canActivate(context: ExecutionContext): boolean {
		const RequiredPermissions = this.Reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

		if (!RequiredPermissions || RequiredPermissions.length === 0) {
			// No permissions required, allow access
			return true;
		}

		const Request = ExtractRequestFromContext(context);
		const User = Request.user as IKeycloakUser | undefined;

		if (!User) {
			throw new UnauthorizedException('IUser not authenticated');
		}

		// Check if user has any of the required permissions in realmRoles or clientRoles
		const UserRoles = [...User.realmRoles, ...User.clientRoles];
		const HasRequiredPermission = RequiredPermissions.some(permission => UserRoles.includes(permission));

		if (!HasRequiredPermission) {
			throw new ForbiddenException('Insufficient permissions');
		}

		return true;
	}
}
