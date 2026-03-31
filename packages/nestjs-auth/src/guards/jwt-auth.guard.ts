import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { KeycloakTokenValidationService } from '../keycloak/services/keycloak-token-validation.service.js';
import { IS_PUBLIC_KEY } from '../decorators/auth-decorators.js';
import { ExtractRequestFromContext } from '../decorators/context-utils.js';
import type { IKeycloakUser, IKeycloakTokenClaims } from '../keycloak/keycloak.types.js';

/**
 * JWT Authentication Guard
 *
 * Validates Keycloak-issued JWT tokens on every request using KeycloakTokenValidationService.
 * Extracts the token from the Authorization header (Bearer scheme), validates it,
 * and attaches the authenticated user and claims to the request object.
 *
 * On successful validation, attaches:
 * - `request.user` — IKeycloakUser object with identity and roles
 * - `request.keycloakClaims` — Raw token claims for advanced use cases
 *
 * Respects the `@Public()` decorator — routes marked as public bypass authentication entirely.
 *
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard)
 * @Controller('api')
 * export class MyController {
 *   @Get('profile')
 *   getProfile(@CurrentUser() user: IKeycloakUser) {
 *     // user.id, user.roles, etc.
 *     return user;
 *   }
 *
 *   @Public()
 *   @Get('health')
 *   health() {
 *     // No authentication required
 *     return { status: 'ok' };
 *   }
 * }
 * ```
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
	private readonly Reflector: Reflector;

	private readonly TokenValidation: KeycloakTokenValidationService;

	constructor(
		reflector: Reflector,
		tokenValidation: KeycloakTokenValidationService,
	) {
		this.Reflector = reflector;
		this.TokenValidation = tokenValidation;
	}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		// Check for @Public() decorator — if true, allow access without authentication
		const IsPublic = this.Reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (IsPublic) {
			return true;
		}

		// Extract request from context (supports HTTP, GraphQL, WebSocket)
		const Request = ExtractRequestFromContext(context);

		// Extract token from Authorization header
		const AuthHeader = Request.headers?.authorization ?? Request.headers?.Authorization;

		if (!AuthHeader || typeof AuthHeader !== 'string') {
			throw new UnauthorizedException('No authentication token provided');
		}

		// Strip "Bearer " prefix
		const Token = AuthHeader.replace(/^Bearer\s+/i, '');

		if (!Token) {
			throw new UnauthorizedException('No authentication token provided');
		}

		// Validate token
		const Result = await this.TokenValidation.ValidateToken(Token);

		if (!Result.valid) {
			throw new UnauthorizedException(Result.error ?? 'Invalid token');
		}

		// Extract user from claims and attach to request
		if (!Result.claims) {
			throw new UnauthorizedException('Missing token claims');
		}

		const User: IKeycloakUser = this.TokenValidation.ExtractUser(Result.claims);
		Request.user = User;
		Request.keycloakClaims = Result.claims as IKeycloakTokenClaims;

		return true;
	}
}

// Type augmentation for Express Request to include user and keycloakClaims
declare global {
	namespace Express {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		interface Request {
			user?: IKeycloakUser;
			keycloakClaims?: IKeycloakTokenClaims;
		}
	}
}
