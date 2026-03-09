import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppLogger } from '@pawells/nestjs-shared/common';

/**
 * Role-based authorization guard
 *
 * Checks if the authenticated user has the required roles to access a resource.
 * Uses the @Roles() decorator to specify required roles.
 */
@Injectable()
export class RoleGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly logger: AppLogger,
	) {}

	public canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());

		if (!requiredRoles || requiredRoles.length === 0) {
			// No roles required, allow access
			return true;
		}

		const request = context.switchToHttp().getRequest<Request & { user?: any }>();
		const { user } = request;

		if (!user) {
			throw new UnauthorizedException('User not authenticated');
		}

		// Check if user has any of the required roles
		const userRoles = user.roles ?? [];
		const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

		if (!hasRequiredRole) {
			// Log audit failure with security context
			const securityContext = {
				userId: user?.id !== null && user?.id !== undefined ? String(user.id) : '[NO_USER_ID]',
				userRoles,
				requiredRoles,
				ip: request.ip,
				path: request.path,
				method: request.method,
				timestamp: new Date().toISOString(),
			};
			this.logger.error('[AUTH_FAILURE] RoleGuard: Insufficient permissions', JSON.stringify(securityContext));
			throw new ForbiddenException(`Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`);
		}

		return true;
	}
}
