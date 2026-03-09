import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppLogger } from '@pawells/nestjs-shared/common';

/**
 * Permission-based authorization guard
 *
 * Checks if the authenticated user has the required permissions to access a resource.
 * Uses the @Permissions() decorator to specify required permissions.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly logger: AppLogger,
	) {}

	public canActivate(context: ExecutionContext): boolean {
		const requiredPermissions = this.reflector.get<string[]>('permissions', context.getHandler());

		if (!requiredPermissions || requiredPermissions.length === 0) {
			// No permissions required, allow access
			return true;
		}

		const request = context.switchToHttp().getRequest<Request & { user?: any }>();
		const { user } = request;

		if (!user) {
			throw new UnauthorizedException('User not authenticated');
		}

		// Check if user has all required permissions
		const userPermissions = user.permissions ?? [];
		const hasAllPermissions = requiredPermissions.every(permission => userPermissions.includes(permission));

		if (!hasAllPermissions) {
			// Log audit failure with security context
			const securityContext = {
				userId: user?.id !== null && user?.id !== undefined ? String(user.id) : '[NO_USER_ID]',
				userPermissions,
				requiredPermissions,
				ip: request.ip,
				path: request.path,
				method: request.method,
				timestamp: new Date().toISOString(),
			};
			this.logger.error('[AUTH_FAILURE] PermissionGuard: Insufficient permissions', JSON.stringify(securityContext));
			throw new ForbiddenException(`Insufficient permissions. Required permissions: ${requiredPermissions.join(', ')}`);
		}

		return true;
	}
}
