import { Controller, Post, UseGuards, Request, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { TokenBlacklistService } from './token-blacklist.service.js';
import { JWTAuthGuard } from './jwt-auth.guard.js';
import { RefreshTokenValidationInput } from './auth.validation.js';

/**
 * Authentication controller handling login, logout, and token refresh
 */
@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly tokenBlacklistService: TokenBlacklistService
	) {}

	/**
	 * Logout endpoint - blacklists the current access token
	 */
	@Post('logout')
	@UseGuards(JWTAuthGuard)
	public async logout(@Request() req: any): Promise<{ message: string }> {
		const token = this.tokenBlacklistService.extractTokenFromHeader(req.headers.authorization);

		if (token) {
			// Decode token to get expiration time
			const decoded = this.authService.decodeToken(token);
			const expiresInSeconds = decoded?.exp
				? Math.floor((decoded.exp * 1000 - Date.now()) / 1000)
				: 900; // Default 15 minutes for access tokens

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
	public async refresh(@Body() _refreshTokenDto: RefreshTokenValidationInput): Promise<any> {
		// This would need to be implemented with user lookup function
		// For now, return a placeholder response
		return { message: 'Refresh endpoint - implementation depends on user lookup' };
	}
}
