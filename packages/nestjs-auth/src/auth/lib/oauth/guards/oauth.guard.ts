import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { ModuleRef } from '@nestjs/core';
import { AppLogger } from '@pawells/nestjs-shared/common';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { OAuthService } from '../oauth.service.js';

@Injectable()
export class OAuthGuard extends AuthGuard(['jwt', 'keycloak', 'oidc']) implements LazyModuleRefService {
	private _contextualLogger: AppLogger | undefined;

	public get OAuthService(): OAuthService {
		return this.Module.get(OAuthService, { strict: false });
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get logger(): AppLogger {
		this._contextualLogger ??= this.AppLogger.createContextualLogger(OAuthGuard.name);
		return this._contextualLogger;
	}

	constructor(public readonly Module: ModuleRef) {
		super();
	}

	public override async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		this.logger.debug(`OAuth guard activated for ${request.path}`);

		const token = this.extractTokenFromHeader(request);

		if (!token) {
			this.logger.warn(`OAuth guard failed: no token provided for ${request.path}`);
			throw new UnauthorizedException('No token provided');
		}

		try {
			// Try to verify with OAuth service
			const provider = (request.headers['x-oauth-provider'] as string | undefined)
				?? process.env['OAUTH_DEFAULT_PROVIDER']
				?? 'keycloak';
			const user = await this.OAuthService.verifyToken(token, provider);
			request.user = user;
			this.logger.info(`OAuth guard successful for user ${user.email} accessing ${request.path}`);
			return true;
		} catch (error) {
			this.logger.warn(`OAuth service verification failed, falling back to passport strategies: ${error instanceof Error ? error.message : String(error)}`);
			// Fallback to passport strategies
			return super.canActivate(context) as Promise<boolean>;
		}
	}

	private extractTokenFromHeader(request: any): string | null {
		const authHeader = request.headers.authorization;
		const BEARER_PREFIX = 'Bearer ';
		if (authHeader?.startsWith(BEARER_PREFIX)) {
			this.logger.debug('Bearer token extracted from authorization header');
			return authHeader.substring(BEARER_PREFIX.length);
		}
		this.logger.debug('No Bearer token found in authorization header');
		return null;
	}
}
