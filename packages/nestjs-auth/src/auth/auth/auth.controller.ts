import { Controller, Post, UseGuards, Request, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { TokenBlacklistService } from './token-blacklist.service.js';
import { JWTAuthGuard } from './jwt-auth.guard.js';
import { RefreshTokenValidationInput } from './auth.validation.js';
import { TOKEN_TTL_15_MINUTES, MS_PER_SECOND } from '../constants/auth-timeouts.constants.js';

/**
 * Authentication controller handling login, logout, and token refresh
 */
@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly tokenBlacklistService: TokenBlacklistService,
	) {}

	/**
	 * Logout endpoint - blacklists the current access token
	 */
	@Post('logout')
	@UseGuards(JWTAuthGuard)
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	public async logout(@Request() req: { headers: { authorization?: string } }): Promise<{ message: string }> {
		const authHeader = req.headers.authorization;
		const token = authHeader ? this.tokenBlacklistService.extractTokenFromHeader(authHeader) : null;

		if (token) {
			// Decode token to get expiration time
			const decoded = this.authService.decodeToken(token);
			const expiresInSeconds = decoded?.exp
				? Math.floor((decoded.exp * MS_PER_SECOND - Date.now()) / MS_PER_SECOND)
				: TOKEN_TTL_15_MINUTES; // Default 15 minutes for access tokens

			// Blacklist the token
			await this.tokenBlacklistService.blacklistToken(token, expiresInSeconds);
		}

		return { message: 'Logged out successfully' };
	}

	/**
	 * Refresh token endpoint
	 * Validates refresh token format and detects invalid/suspicious input
	 */
	@Post('refresh')
	@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
	@Throttle({ default: { limit: 3, ttl: 60000 } })
	public refresh(@Body() _refreshTokenDto: RefreshTokenValidationInput): { message: string } {
		// This would need to be implemented with user lookup function
		// For now, return a placeholder response
		return { message: 'Refresh endpoint - implementation depends on user lookup' };
	}
}
