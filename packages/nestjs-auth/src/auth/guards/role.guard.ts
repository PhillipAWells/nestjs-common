import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector , ModuleRef } from '@nestjs/core';
import type { Request } from 'express';
import { AppLogger } from '@pawells/nestjs-shared/common';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';

/**
 * Role-based authorization guard
 *
 * Checks if the authenticated user has the required roles to access a resource.
 * Uses the @Roles() decorator to specify required roles.
 */
@Injectable()
export class RoleGuard implements CanActivate, LazyModuleRefService {
	public get Reflector(): Reflector {
		return this.Module.get(Reflector, { strict: false });
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	constructor(public readonly Module: ModuleRef) {}

	public canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.Reflector.get<string[]>('roles', context.getHandler());

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
		const rawUser = user as { role?: string; roles?: string | string[] };
		const userRoles: string[] = Array.isArray(rawUser.roles)
			? rawUser.roles
			: rawUser.roles
				? rawUser.roles.split(',').map((r: string) => r.trim()).filter(Boolean)
				: rawUser.role
					? [rawUser.role]
					: [];
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
			this.AppLogger.error('[AUTH_FAILURE] RoleGuard: Insufficient permissions', JSON.stringify(securityContext));
			throw new ForbiddenException(`Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`);
		}

		return true;
	}
}
