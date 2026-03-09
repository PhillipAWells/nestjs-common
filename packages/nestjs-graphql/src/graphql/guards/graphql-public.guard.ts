import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AppLogger } from '@pawells/nestjs-shared/common';

/**
 * GraphQL Public Access Guard
 *
 * Allows access to resolvers marked as public, bypassing authentication.
 * Uses Reflector to check for public metadata set by decorators.
 *
 * @example
 * ```typescript
 * @UseGuards(GraphQLPublicGuard)
 * @Public()
 * @Query(() => String)
 * async getHealth(): Promise<string> {
 *   // This resolver is public and doesn't require authentication
 *   return 'OK';
 * }
 * ```
 */
@Injectable()
export class GraphQLPublicGuard implements CanActivate {
	private readonly logger: AppLogger;

	constructor(
		private readonly reflector: Reflector,
		@Inject(AppLogger) private readonly appLogger: AppLogger
	) {
		this.logger = this.appLogger.createContextualLogger(GraphQLPublicGuard.name);
	}

	/**
	 * Determines if the current resolver is marked as public
	 *
	 * @param context - The execution context
	 * @returns boolean - True if public or no authentication required
	 */
	public canActivate(context: ExecutionContext): boolean {
		// Check if resolver is marked as public
		const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
			context.getHandler(),
			context.getClass()
		]);

		if (isPublic) {
			this.logger.debug('Public resolver accessed');
			return true;
		}

		// If not public, check if user is authenticated
		const gqlContext = GqlExecutionContext.create(context);
		const { user } = gqlContext.getContext();

		if (!user) {
			this.logger.warn('Non-public resolver accessed without authentication');
			return false;
		}

		this.logger.debug(`Authenticated user accessing protected resolver: ${user.id ?? user.sub ?? 'unknown'}`);
		return true;
	}
}
