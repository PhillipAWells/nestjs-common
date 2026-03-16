import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector, ModuleRef } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';

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
 * @Query(() => User)
 * async getUsers(): Promise<User[]> {
 *   // Only users with 'admin' or 'moderator' roles can access
 * }
 * ```
 */
@Injectable()
export class GraphQLRolesGuard implements CanActivate, LazyModuleRefService {
	private readonly logger = new Logger(GraphQLRolesGuard.name);

	public get Reflector(): Reflector {
		return this.Module.get(Reflector, { strict: false });
	}

	constructor(public readonly Module: ModuleRef) {}

	/**
	 * Determines if the current user has the required roles
	 *
	 * @param context - The execution context
	 * @returns boolean - True if authorized, throws exception otherwise
	 */
	public canActivate(context: ExecutionContext): boolean {
		// Get required roles from metadata
		const requiredRoles = this.Reflector.getAllAndOverride<string[]>('roles', [
			context.getHandler(),
			context.getClass(),
		]);

		// If no roles are required, allow access
		if (!requiredRoles || requiredRoles.length === 0) {
			return true;
		}

		// Extract user from GraphQL context
		const gqlContext = GqlExecutionContext.create(context);
		const { user } = gqlContext.getContext();

		if (!user) {
			this.logger.warn('No user found in GraphQL context');
			throw new ForbiddenException('Authentication required');
		}

		// Check if user has required roles
		const userRoles = this.getUserRoles(user);
		const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

		if (!hasRequiredRole) {
			this.logger.warn(
				`User ${user.id ?? user.sub ?? 'unknown'} lacks required roles. Required: [${requiredRoles.join(', ')}], User has: [${userRoles.join(', ')}]`,
			);
			throw new ForbiddenException('Insufficient permissions');
		}

		this.logger.debug(
			`User ${user.id ?? user.sub ?? 'unknown'} authorized with roles: [${userRoles.join(', ')}]`,
		);

		return true;
	}

	/**
	 * Extracts roles from user object
	 *
	 * @param user - The user object from authentication
	 * @returns string[] - Array of user roles
	 */
	private getUserRoles(user: any): string[] {
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
			const scopes = user.scope ?? user.scopes;
			return Array.isArray(scopes) ? scopes : [scopes];
		}

		// Default to empty array if no roles found
		this.logger.warn('No roles found in user object');
		return [];
	}
}
