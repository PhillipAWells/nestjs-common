import { ExecutionContext, UnauthorizedException, Inject, Injectable, Optional } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';

/**
 * Base Authentication Guard
 *
 * Abstract base class providing shared authentication logic for different contexts.
 * Handles token extraction, error handling, and logging with context-specific overrides.
 *
 * @abstract
 * @class BaseAuthGuard
 * @extends {AuthGuard}
 */
@Injectable()
export abstract class BaseAuthGuard extends AuthGuard(['jwt', 'keycloak', 'oauth']) {
	protected logger: AppLogger;

	constructor(@Optional() @Inject(AppLogger) protected readonly appLogger?: AppLogger) {
		super(['jwt', 'keycloak', 'oauth']);
		this.logger = this.appLogger?.createContextualLogger(BaseAuthGuard.name) ?? new AppLogger(undefined, BaseAuthGuard.name);
	}

	/**
	 * Gets the execution context specific to the implementation
	 *
	 * @protected
	 * @abstract
	 * @param {ExecutionContext} context - The execution context
	 * @returns {*} The context-specific request object
	 */
	protected abstract getContext(context: ExecutionContext): any;

	/**
	 * Extracts JWT token from Authorization header
	 *
	 * @protected
	 * @param {*} request - The request object
	 * @returns {(string | null)} The extracted token or null
	 */
	protected extractTokenFromHeader(request: any): string | null {
		const authHeader = request.headers?.authorization ?? request.headers?.Authorization;
		const BEARER_PREFIX = 'Bearer ';
		if (authHeader && typeof authHeader === 'string' && authHeader.startsWith(BEARER_PREFIX)) {
			return authHeader.substring(BEARER_PREFIX.length);
		}

		return null;
	}

	/**
	 * Handles authentication errors from passport strategies
	 *
	 * @protected
	 * @param {*} err - The error from passport
	 * @param {*} user - The authenticated user
	 * @param {*} info - Additional info from passport
	 * @returns {*} The user object or throws exception
	 */
	protected handleAuthError(err: any, user: any, info: any): any {
		if (err || !user) {
			this.logger.warn(`Authentication failed: ${err?.message ?? info?.message ?? 'Unknown error'}`);
			throw new UnauthorizedException('Authentication failed');
		}

		return user;
	}

	/**
	 * Override handleRequest to use common error handling
	 *
	 * @param {*} err - The error from passport
	 * @param {*} user - The authenticated user
	 * @param {*} info - Additional info from passport
	 * @returns {*} The user object
	 */
	@ProfileMethod({ tags: { operation: 'authGuard' } })
	public override handleRequest(err: any, user: any, info: any): any {
		return this.handleAuthError(err, user, info);
	}
}
