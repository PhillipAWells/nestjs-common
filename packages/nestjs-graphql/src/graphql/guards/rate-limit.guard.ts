import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
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
 * @Query(() => [Post], { name: 'GetPosts' })
 * async getPosts(): Promise<Post[]> {
 *   // Rate limited to configured limits
 * }
 * ```
 */
@Injectable()
export class GraphQLRateLimitGuard implements CanActivate, ILazyModuleRefService {
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
			return this.AppLogger?.createContextualLogger(GraphQLRateLimitGuard.name);
		} catch {
			return undefined;
		}
	}

	public get RateLimitService(): RateLimitService {
		return this.Module.get(RateLimitService, { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
	 * Determines if the request can proceed based on rate limits
	 *
	 * @param context - The execution context
	 * @returns boolean - True if within limits, throws exception otherwise
	 */
	public async canActivate(context: ExecutionContext): Promise<boolean> {
		// Extract GraphQL context
		const GqlContext = GqlExecutionContext.create(context);
		const Request = GqlContext.getContext().req;

		// Get client identifier (user ID or IP address)
		const ClientId = this.GetClientIdentifier(Request);

		try {
			// Check rate limit
			const Result = await this.RateLimitService.CheckLimit(ClientId);

			if (!Result.allowed) {
				this.Logger?.warn(
					`Rate limit exceeded for client ${ClientId}. Reset in ${Result.resetTime - Date.now()}ms`,
				);

				throw new HttpException(
					{
						message: 'Rate limit exceeded',
						resetTime: new Date(Result.resetTime),
						retryAfter: Math.ceil((Result.resetTime - Date.now()) / MS_PER_SECOND),
					},
					HttpStatus.TOO_MANY_REQUESTS,
				);
			}

			// Add rate limit headers to response
			const Response = GqlContext.getContext().res;
			if (Response) {
				Response.setHeader('X-RateLimit-Limit', Result.limit);
				Response.setHeader('X-RateLimit-Remaining', Result.remaining);
				Response.setHeader('X-RateLimit-Reset', new Date(Result.resetTime).toISOString());
			}

			return true;
		} catch (error) {
			if (error instanceof HttpException) {
				throw error;
			}

			this.Logger?.error(`Rate limit check failed for client ${ClientId}: ${getErrorMessage(error)}`);
			throw new HttpException('Rate limit service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
		}
	}

	/**
	 * Extracts client identifier from request
	 *
	 * @param request - The HTTP request object
	 * @returns string - Client identifier
	 */
	private GetClientIdentifier(request: any): string {
		// Prefer user ID if authenticated
		if (request.user?.id) {
			return `user:${request.user.id}`;
		}

		if (request.user?.sub) {
			return `user:${request.user.sub}`;
		}

		// Fall back to IP address
		const Ip: string =
			request.ip ??
			request.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() ??
			'unknown';

		return `ip:${Ip}`;
	}
}
