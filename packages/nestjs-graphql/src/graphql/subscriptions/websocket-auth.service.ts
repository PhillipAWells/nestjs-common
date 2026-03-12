import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Service for WebSocket connection authentication
 */
@Injectable()
export class WebSocketAuthService {
	private readonly logger = new Logger(WebSocketAuthService.name);

	constructor(@Inject(JwtService) @Optional() private readonly jwtService?: JwtService) {}

	/**
   * Authenticates a WebSocket connection
   * @param connectionParams Connection parameters from client
   * @returns Authentication result
   */
	public async authenticate(connectionParams: any): Promise<{
		authenticated: boolean;
		userId?: string;
		error?: string;
	}> {
		try {
			this.logger.debug('Authenticating WebSocket connection');

			// Extract token from connection parameters
			const token = this.extractToken(connectionParams);

			if (!token) {
				return {
					authenticated: false,
					error: 'No authentication token provided',
				};
			}

			// Validate JWT token
			const userId = await this.validateToken(token);

			if (!userId) {
				return {
					authenticated: false,
					error: 'Invalid authentication token',
				};
			}

			this.logger.debug(`WebSocket connection authenticated for user: ${userId}`);
			return {
				authenticated: true,
				userId,
			};
		} catch (error: any) {
			this.logger.error(`WebSocket authentication error: ${error.message}`, error.stack);
			return {
				authenticated: false,
				error: 'Authentication failed',
			};
		}
	}

	/**
   * Validates JWT token with cryptographic signature verification and extracts user ID
   * @param token JWT token
   * @returns User ID or null if invalid
   */
	private async validateToken(token: string): Promise<string | null> {
		try {
			if (!this.jwtService) {
				this.logger.error('JwtService not available — WebSocket authentication cannot verify token signatures');
				return null;
			}

			// Verify token with cryptographic signature validation
			const payload = await this.jwtService.verifyAsync(token);

			if (!payload?.sub) {
				return null;
			}

			return payload.sub;
		} catch (error: any) {
			this.logger.warn(`Token validation error: ${error.message}`);
			return null;
		}
	}

	/**
   * Extracts token from connection parameters
   * @param connectionParams Connection parameters
   * @returns Token string or null
   */
	private extractToken(connectionParams: any): string | null {
		// Try different sources for the token
		return (
			connectionParams.authorization ?? 
      connectionParams.Authorization ?? 
      connectionParams.token ?? 
      connectionParams.authToken ?? 
      null
		);
	}
}
