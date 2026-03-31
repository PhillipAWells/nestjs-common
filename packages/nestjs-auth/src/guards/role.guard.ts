import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExtractRequestFromContext } from '../decorators/context-utils.js';
import { ROLES_KEY } from '../decorators/auth-decorators.js';
import type { IKeycloakUser } from '../keycloak/keycloak.types.js';

/**
 * Role-based Authorization Guard
 *
 * Authorizes access based on user roles specified by the `@Roles()` decorator.
 * Checks both realm-level roles (`user.realmRoles`) and client-specific roles (`user.clientRoles`).
 *
 * Uses OR logic — access is granted if the user has ANY of the required roles.
 * If no roles are specified via `@Roles()`, access is allowed by default.
 *
 * Throws `ForbiddenException` if the user lacks all required roles.
 *
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, RoleGuard)
 * @Controller('admin')
 * export class AdminController {
 *   @Roles('admin', 'moderator')
 *   @Get('users')
 *   listUsers() {
 *     // IUser must have 'admin' OR 'moderator' role
 *     return [];
 *   }
 * }
 * ```
 */
@Injectable()
export class RoleGuard implements CanActivate {
	private readonly Reflector: Reflector;

	constructor(reflector: Reflector) {
		this.Reflector = reflector;
	}

	public canActivate(context: ExecutionContext): boolean {
		const RequiredRoles = this.Reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);

		if (!RequiredRoles || RequiredRoles.length === 0) {
			// No roles required, allow access
			return true;
		}

		const Request = ExtractRequestFromContext(context);
		const User = Request.user as IKeycloakUser | undefined;

		if (!User) {
			throw new UnauthorizedException('IUser not authenticated');
		}

		// Check if user has any of the required roles in realmRoles or clientRoles
		const UserRoles = [...User.realmRoles, ...User.clientRoles];
		const HasRequiredRole = RequiredRoles.some(role => UserRoles.includes(role));

		if (!HasRequiredRole) {
			throw new ForbiddenException('Insufficient permissions');
		}

		return true;
	}
}
