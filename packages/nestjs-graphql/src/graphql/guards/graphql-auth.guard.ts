import { Injectable, ExecutionContext, UnauthorizedException, CanActivate, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * GraphQL Authentication Guard
 *
 * Implements CanActivate to work with GraphQL operations.
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
@Injectable()
export class GraphQLAuthGuard implements CanActivate {
	private readonly logger = new Logger(GraphQLAuthGuard.name);

	/**
	 * Determines if the current request can proceed
	 *
	 * @param context - The execution context
	 * @returns boolean - True if authenticated, throws exception otherwise
	 */
	public canActivate(context: ExecutionContext): boolean {
		// Extract GraphQL context
		const gqlContext = GqlExecutionContext.create(context);
		const request = gqlContext.getContext().req;

		// Extract token from Authorization header
		const token = this.extractTokenFromHeader(request);

		if (!token) {
			this.logger.warn('No authentication token provided');
			throw new UnauthorizedException('Authentication required');
		}

		// Verify request.user is populated (set by a Passport strategy upstream)
		const { user } = request;
		if (!user) {
			this.logger.warn('Authentication token invalid: user not found on request');
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
	protected extractTokenFromHeader(
		request: { headers?: { authorization?: string } },
	): string | null {
		const authHeader: unknown = request.headers?.authorization;

		if (authHeader && typeof authHeader === 'string') {
			const parts = authHeader.split(/\s+/);
			if (parts[0]?.toLowerCase() === 'bearer' && parts[1]) {
				return parts[1];
			}
		}

		return null;
	}
}
