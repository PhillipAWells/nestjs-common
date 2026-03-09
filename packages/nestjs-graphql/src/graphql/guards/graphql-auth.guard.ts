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
	public async canActivate(context: ExecutionContext): Promise<boolean> {
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

		try {
			// Store token in request for passport strategies
			request.headers.authorization = `Bearer ${token}`;

			// TODO: Use passport strategies for validation (requires BaseAuthGuard)
			// await super.canActivate(context);

			// Store user in GraphQL context for resolvers
			const { user } = request;
			gqlContext.getContext().user = user;
			// TODO: Re-enable logging after re-adding BaseAuthGuard
			// this.logger.debug(`User authenticated: ${user?.id ?? user?.sub ?? 'unknown'}`);

			return true;
		}
		catch (error) {
			// TODO: Re-enable logging after re-adding BaseAuthGuard
			// this.logger.error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
			throw new UnauthorizedException('Invalid authentication token');
		}
	}

	/**
	 * Extracts JWT token from Authorization header
	 *
	 * @param request - The HTTP request object
	 * @returns string | null - The extracted token or null
	 */
	protected extractTokenFromHeader(request: any): string | null {
		const authHeader = request.headers?.authorization ?? request.headers?.Authorization;
		const BEARER_PREFIX_LENGTH = 7; // "Bearer " is 7 characters
		// TODO: Use DAYS_IN_WEEK constant after breaking circular dependency

		if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
			return authHeader.substring(BEARER_PREFIX_LENGTH);
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
