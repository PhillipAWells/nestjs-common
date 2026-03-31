import { Injectable, ExecutionContext, UnauthorizedException, CanActivate } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { ILazyModuleRefService, IContextualLogger } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';

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
 * @Query(() => IUser, { name: 'GetUser' })
 * async getUser(): Promise<IUser> {
 *   // This resolver is protected
 * }
 * ```
 */
@Injectable()
export class GraphQLAuthGuard implements CanActivate, ILazyModuleRefService {
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
			return this.AppLogger?.createContextualLogger(GraphQLAuthGuard.name);
		} catch {
			return undefined;
		}
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
	 * Determines if the current request can proceed
	 *
	 * @param context - The execution context
	 * @returns boolean - True if authenticated, throws exception otherwise
	 */
	public canActivate(context: ExecutionContext): boolean {
		// Extract GraphQL context
		const GqlContext = GqlExecutionContext.create(context);
		const Request = GqlContext.getContext().req;

		// Extract token from Authorization header
		const Token = this.ExtractTokenFromHeader(Request);

		if (!Token) {
			this.Logger?.warn('No authentication token provided');
			throw new UnauthorizedException('Authentication required');
		}

		// Verify request.user is populated (set by a Passport strategy upstream)
		const { user } = Request;
		if (!user) {
			this.Logger?.warn('Authentication token invalid: user not found on request');
			throw new UnauthorizedException('Invalid authentication token');
		}

		// Propagate user into GraphQL context for resolvers
		GqlContext.getContext().user = user;

		return true;
	}

	/**
	 * Extracts JWT token from Authorization header
	 *
	 * @param request - The HTTP request object
	 * @returns string | null - The extracted token or null
	 */
	protected ExtractTokenFromHeader(
		request: { headers?: { authorization?: string } },
	): string | null {
		const AuthHeader: unknown = request.headers?.authorization;

		if (AuthHeader && typeof AuthHeader === 'string') {
			const Parts = AuthHeader.split(/\s+/);
			if (Parts[0]?.toLowerCase() === 'bearer' && Parts[1]) {
				return Parts[1];
			}
		}

		return null;
	}
}
