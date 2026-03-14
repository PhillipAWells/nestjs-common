import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { RateLimitService } from '../services/rate-limit.service.js';

const MS_PER_SECOND = 1000;

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
export class GraphQLRateLimitGuard implements CanActivate, LazyModuleRefService {
	private readonly logger = new Logger(GraphQLRateLimitGuard.name);

	public get RateLimitService(): RateLimitService {
		return this.Module.get(RateLimitService, { strict: false });
	}

	constructor(public readonly Module: ModuleRef) {}

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
			const result = await this.RateLimitService.checkLimit(clientId);

			if (!result.allowed) {
				this.logger.warn(
					`Rate limit exceeded for client ${clientId}. Reset in ${result.resetTime - Date.now()}ms`,
				);

				throw new HttpException(
					{
						message: 'Rate limit exceeded',
						resetTime: new Date(result.resetTime),
						retryAfter: Math.ceil((result.resetTime - Date.now()) / MS_PER_SECOND),
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
			throw new HttpException('Rate limit service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
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
		const ip: string =
			request.ip ??
			request.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() ??
			'unknown';

		return `ip:${ip}`;
	}
}
