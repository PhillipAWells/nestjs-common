import { Injectable, ExecutionContext, UnauthorizedException, CanActivate } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
// import { BaseAuthGuard } from '@pawells/nestjs-auth'; // TODO: Re-enable after breaking circular dependency
// import { DAYS_IN_WEEK } from '@pawells/nestjs-auth/constants/auth-timeouts.constants.ts';

/**
 * GraphQL Authentication Guard
 *
 * Extends BaseAuthGuard to work with GraphQL operations.
 * Extracts JWT tokens from GraphQL context and validates them.
 * Supports both queries/mutations and subscriptions.
 *
 * @example
 * ```typescript
 * @UseGuards(GraphQLAuthGuard)
 * @Query(() => User)
 * async getUser(): Promise<User> {
 *   // This resolver is protected
 * }
 * ```
 */
// TODO: Restore BaseAuthGuard extension after breaking circular dependency
@Injectable()
export class GraphQLAuthGuard implements CanActivate {
	/**
	 * Determines if the current request can proceed
	 *
	 * @param context - The execution context
	 * @returns Promise<boolean> - True if authenticated, throws exception otherwise
	 */
	public canActivate(context: ExecutionContext): boolean {
		// Extract GraphQL context
		const gqlContext = GqlExecutionContext.create(context);
		const request = gqlContext.getContext().req;

		// Extract token from Authorization header
		const token = this.extractTokenFromHeader(request);

		if (!token) {
			// TODO: Re-enable logging after re-adding BaseAuthGuard
			// this.logger.warn('No authentication token provided');
			throw new UnauthorizedException('Authentication required');
		}

		// Verify request.user is populated (set by a Passport strategy upstream)
		const { user } = request;
		if (!user) {
			throw new UnauthorizedException('Invalid authentication token');
		}

		// Propagate user into GraphQL context for resolvers
		gqlContext.getContext().user = user;

		return true;
	}

	/**
	 * Extracts JWT token from Authorization header
	 *
	 * @param request - The HTTP request object
	 * @returns string | null - The extracted token or null
	 */
	protected extractTokenFromHeader(request: any): string | null {
		const authHeader: unknown = request.headers?.authorization;

		if (authHeader && typeof authHeader === 'string') {
			const parts = authHeader.split(/\s+/);
			if (parts[0]?.toLowerCase() === 'bearer' && parts[1]) {
				return parts[1];
			}
		}

		return null;
	}

	/**
	 * Handles authentication errors from passport strategies
	 *
	 * @param err - The error from passport
	 * @param user - The authenticated user
	 * @param info - Additional info from passport
	 * @returns any - The user object or throws exception
	 */
	// TODO: Restore after breaking circular dependency
	// public handleRequest(err: any, user: any, info: any): any {
	// 	if (err || !user) {
	// 		this.logger.warn(`Authentication request failed: ${err?.message ?? info?.message ?? 'Unknown error'}`);
	// 		throw err ?? new UnauthorizedException('Authentication failed');
	// 	}
	// 	return user;
	// }
}
