import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector, ModuleRef } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';

/**
 * GraphQL Roles-Based Access Control Guard
 *
 * Checks if the authenticated user has the required roles to access a resolver.
 * Uses Reflector to read role metadata set by decorators.
 *
 * @example
 * ```typescript
 * @UseGuards(GraphQLRolesGuard)
 * @Roles('admin', 'moderator')
 * @Query(() => IUser, { name: 'GetUsers' })
 * async getUsers(): Promise<IUser[]> {
 *   // Only users with 'admin' or 'moderator' roles can access
 * }
 * ```
 */
@Injectable()
export class GraphQLRolesGuard implements CanActivate, ILazyModuleRefService {
	public readonly Module: ModuleRef;

	private get AppLogger(): AppLogger | undefined {
		try {
			return this.Module.get(AppLogger, { strict: false });
		} catch {
			return undefined;
		}
	}

	private get Logger(): IContextualLogger | undefined {
		try {
			return this.AppLogger?.createContextualLogger(GraphQLRolesGuard.name);
		} catch {
			return undefined;
		}
	}

	public get Reflector(): Reflector {
		return this.Module.get(Reflector, { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
	 * Determines if the current user has the required roles
	 *
	 * @param context - The execution context
	 * @returns boolean - True if authorized, throws exception otherwise
	 */
	public canActivate(context: ExecutionContext): boolean {
		// Get required roles from metadata
		const RequiredRoles = this.Reflector.getAllAndOverride<string[]>('roles', [
			context.getHandler(),
			context.getClass(),
		]);

		// If no roles are required, allow access
		if (!RequiredRoles || RequiredRoles.length === 0) {
			return true;
		}

		// Extract user from GraphQL context
		const GqlContext = GqlExecutionContext.create(context);
		const { user } = GqlContext.getContext();

		if (!user) {
			this.Logger?.warn('No user found in GraphQL context');
			throw new ForbiddenException('Authentication required');
		}

		// Check if user has required roles
		const UserRoles = this.GetUserRoles(user);
		const HasRequiredRole = RequiredRoles.some(role => UserRoles.includes(role));

		if (!HasRequiredRole) {
			this.Logger?.warn(
				`IUser ${user.id ?? user.sub ?? 'unknown'} lacks required roles. Required: [${RequiredRoles.join(', ')}], IUser has: [${UserRoles.join(', ')}]`,
			);
			throw new ForbiddenException('Insufficient permissions');
		}

		this.Logger?.debug(
			`IUser ${user.id ?? user.sub ?? 'unknown'} authorized with roles: [${UserRoles.join(', ')}]`,
		);

		return true;
	}

	/**
	 * Extracts roles from user object
	 *
	 * @param user - The user object from authentication
	 * @returns string[] - Array of user roles
	 */
	private GetUserRoles(user: any): string[] {
		// Handle different user object structures
		if (user.roles && Array.isArray(user.roles)) {
			return user.roles;
		}

		if (user.role) {
			return Array.isArray(user.role) ? user.role : [user.role];
		}

		if (user.authorities && Array.isArray(user.authorities)) {
			return user.authorities;
		}

		if (user.scope || user.scopes) {
			const Scopes = user.scope ?? user.scopes;
			return Array.isArray(Scopes) ? Scopes : [Scopes];
		}

		// Default to empty array if no roles found
		this.Logger?.warn('No roles found in user object');
		return [];
	}
}
