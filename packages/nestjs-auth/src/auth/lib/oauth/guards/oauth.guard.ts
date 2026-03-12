import { Injectable, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { OAuthService } from '../oauth.service.js';

@Injectable()
export class OAuthGuard extends AuthGuard(['jwt', 'keycloak', 'oidc']) {
	private readonly logger: AppLogger;

	constructor(
		private readonly oauthService: OAuthService,
		@Inject(AppLogger) private readonly appLogger: AppLogger,
	) {
		super();
		this.logger = this.appLogger.createContextualLogger(OAuthGuard.name);
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
			const user = await this.oauthService.verifyToken(token, 'keycloak'); // Default to keycloak
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
