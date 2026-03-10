import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RateLimitService } from '../services/rate-limit.service.js';

/**
 * GraphQL Rate Limit Guard
 *
 * Implements rate limiting for GraphQL operations to prevent abuse.
 * Uses a sliding window algorithm to track requests per user/IP.
 *
 * @example
 * ```typescript
 * @UseGuards(GraphQLRateLimitGuard)
 * @Query(() => [Post])
 * async getPosts(): Promise<Post[]> {
 *   // Rate limited to configured limits
 * }
 * ```
 */
@Injectable()
export class GraphQLRateLimitGuard implements CanActivate {
	private readonly logger = new Logger(GraphQLRateLimitGuard.name);

	constructor(private readonly rateLimitService: RateLimitService) {}

	/**
	 * Determines if the request can proceed based on rate limits
	 *
	 * @param context - The execution context
	 * @returns boolean - True if within limits, throws exception otherwise
	 */
	public async canActivate(context: ExecutionContext): Promise<boolean> {
		// Extract GraphQL context
		const gqlContext = GqlExecutionContext.create(context);
		const request = gqlContext.getContext().req;

		// Get client identifier (user ID or IP address)
		const clientId = this.getClientIdentifier(request);

		try {
			// Check rate limit
			const result = await this.rateLimitService.checkLimit(clientId);

			if (!result.allowed) {
				this.logger.warn(
					`Rate limit exceeded for client ${clientId}. Reset in ${result.resetTime - Date.now()}ms`,
				);

				throw new HttpException(
					{
						message: 'Rate limit exceeded',
						resetTime: new Date(result.resetTime),
						retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
					},
					HttpStatus.TOO_MANY_REQUESTS,
				);
			}

			// Add rate limit headers to response
			const response = gqlContext.getContext().res;
			if (response) {
				response.setHeader('X-RateLimit-Limit', result.limit);
				response.setHeader('X-RateLimit-Remaining', result.remaining);
				response.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
			}

			return true;
		} catch (error) {
			if (error instanceof HttpException) {
				throw error;
			}

			this.logger.error(`Rate limit check failed for client ${clientId}: ${error instanceof Error ? error.message : String(error)}`);
			// Block request if rate limiting check fails (fail-closed for security)
			throw new HttpException(
				{
					message: 'Rate limit check unavailable',
				},
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}
	}

	/**
	 * Extracts client identifier from request
	 *
	 * @param request - The HTTP request object
	 * @returns string - Client identifier
	 */
	private getClientIdentifier(request: any): string {
		// Prefer user ID if authenticated
		if (request.user?.id) {
			return `user:${request.user.id}`;
		}

		if (request.user?.sub) {
			return `user:${request.user.sub}`;
		}

		// Fall back to IP address
		const ip = request.ip ||
				   request.connection?.remoteAddress ||
				   request.socket?.remoteAddress ||
				   request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
				   'unknown';

		return `ip:${ip}`;
	}
}
