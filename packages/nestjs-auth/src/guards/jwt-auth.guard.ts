import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { KeycloakTokenValidationService } from '../keycloak/services/keycloak-token-validation.service.js';
import { IS_PUBLIC_KEY } from '../decorators/auth-decorators.js';
import { ExtractRequestFromContext } from '../decorators/context-utils.js';
import type { KeycloakUser, KeycloakTokenClaims } from '../keycloak/keycloak.types.js';

/**
 * JWT Authentication Guard
 *
 * Validates Keycloak-issued JWT tokens on every request using KeycloakTokenValidationService.
 * Extracts the token from the Authorization header (Bearer scheme), validates it,
 * and attaches the authenticated user and claims to the request object.
 *
 * On successful validation, attaches:
 * - `request.user` — KeycloakUser object with identity and roles
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
 *   getProfile(@CurrentUser() user: KeycloakUser) {
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
	private readonly reflector: Reflector;

	private readonly tokenValidation: KeycloakTokenValidationService;

	constructor(
		reflector: Reflector,
		tokenValidation: KeycloakTokenValidationService,
	) {
		this.reflector = reflector;
		this.tokenValidation = tokenValidation;
	}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		// Check for @Public() decorator — if true, allow access without authentication
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (isPublic) {
			return true;
		}

		// Extract request from context (supports HTTP, GraphQL, WebSocket)
		const request = ExtractRequestFromContext(context);

		// Extract token from Authorization header
		const authHeader = request.headers?.authorization ?? request.headers?.Authorization;

		if (!authHeader || typeof authHeader !== 'string') {
			throw new UnauthorizedException('No authentication token provided');
		}

		// Strip "Bearer " prefix
		const token = authHeader.replace(/^Bearer\s+/i, '');

		if (!token) {
			throw new UnauthorizedException('No authentication token provided');
		}

		// Validate token
		const result = await this.tokenValidation.validateToken(token);

		if (!result.valid) {
			throw new UnauthorizedException(result.error ?? 'Invalid token');
		}

		// Extract user from claims and attach to request
		if (!result.claims) {
			throw new UnauthorizedException('Missing token claims');
		}

		const user: KeycloakUser = this.tokenValidation.extractUser(result.claims);
		request.user = user;
		request.keycloakClaims = result.claims as KeycloakTokenClaims;

		return true;
	}
}

// Type augmentation for Express Request to include user and keycloakClaims
declare global {
	namespace Express {
		interface Request {
			user?: KeycloakUser;
			keycloakClaims?: KeycloakTokenClaims;
		}
	}
}
