import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector , ModuleRef } from '@nestjs/core';
import type { Request } from 'express';
import { AppLogger } from '@pawells/nestjs-shared/common';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';

/**
 * Permission-based authorization guard
 *
 * Checks if the authenticated user has the required permissions to access a resource.
 * Uses the @Permissions() decorator to specify required permissions.
 */
@Injectable()
export class PermissionGuard implements CanActivate, LazyModuleRefService {
	public get Reflector(): Reflector {
		return this.Module.get(Reflector, { strict: false });
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	constructor(public readonly Module: ModuleRef) {}

	public canActivate(context: ExecutionContext): boolean {
		const requiredPermissions = this.Reflector.get<string[]>('permissions', context.getHandler());

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
		const userPermissions: string[] = Array.isArray(user.permissions) ? user.permissions : (typeof user.permissions === 'string' ? user.permissions.split(',').map((p: string) => p.trim()).filter(Boolean) : []);
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
			this.AppLogger.error('[AUTH_FAILURE] PermissionGuard: Insufficient permissions', JSON.stringify(securityContext));
			throw new ForbiddenException(`Insufficient permissions. Required permissions: ${requiredPermissions.join(', ')}`);
		}

		return true;
	}
}
