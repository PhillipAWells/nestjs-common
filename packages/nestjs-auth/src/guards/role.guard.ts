import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExtractRequestFromContext } from '../decorators/context-utils.js';
import { ROLES_KEY } from '../decorators/auth-decorators.js';
import type { KeycloakUser } from '../keycloak/keycloak.types.js';

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
 *     // User must have 'admin' OR 'moderator' role
 *     return [];
 *   }
 * }
 * ```
 */
@Injectable()
export class RoleGuard implements CanActivate {
	private readonly reflector: Reflector;

	constructor(reflector: Reflector) {
		this.reflector = reflector;
	}

	public canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);

		if (!requiredRoles || requiredRoles.length === 0) {
			// No roles required, allow access
			return true;
		}

		const request = ExtractRequestFromContext(context);
		const user = request.user as KeycloakUser | undefined;

		if (!user) {
			throw new UnauthorizedException('User not authenticated');
		}

		// Check if user has any of the required roles in realmRoles or clientRoles
		const userRoles = [...user.realmRoles, ...user.clientRoles];
		const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

		if (!hasRequiredRole) {
			throw new ForbiddenException('Insufficient permissions');
		}

		return true;
	}
}
