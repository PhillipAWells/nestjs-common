import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector, ModuleRef } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';
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
 * @Query(() => String, { name: 'GetHealth' })
 * async getHealth(): Promise<string> {
 *   // This resolver is public and doesn't require authentication
 *   return 'OK';
 * }
 * ```
 */
@Injectable()
export class GraphQLPublicGuard implements CanActivate, ILazyModuleRefService {
	public readonly Module: ModuleRef;

	public get Reflector(): Reflector {
		return this.Module.get(Reflector, { strict: false });
	}

	private get AppLogger(): AppLogger | undefined {
		try {
			return this.Module.get(AppLogger, { strict: false });
		} catch {
			return undefined;
		}
	}

	private get Logger(): AppLogger | undefined {
		try {
			return this.AppLogger?.createContextualLogger(GraphQLPublicGuard.name);
		} catch {
			return undefined;
		}
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
	 * Determines if the current resolver is marked as public
	 *
	 * @param context - The execution context
	 * @returns boolean - True if public or no authentication required
	 */
	public canActivate(context: ExecutionContext): boolean {
		// Check if resolver is marked as public
		const isPublic = this.Reflector.getAllAndOverride<boolean>('isPublic', [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			this.Logger?.debug('Public resolver accessed');
			return true;
		}

		// If not public, check if user is authenticated
		const gqlContext = GqlExecutionContext.create(context);
		const { user } = gqlContext.getContext();

		if (!user) {
			this.Logger?.warn('Non-public resolver accessed without authentication');
			return false;
		}

		this.Logger?.debug(`Authenticated user accessing protected resolver: ${user.id ?? user.sub ?? 'unknown'}`);
		return true;
	}
}
