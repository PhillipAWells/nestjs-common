import { Injectable, Logger } from '@nestjs/common';

/**
 * Service for WebSocket connection authentication
 */
@Injectable()
export class WebSocketAuthService {
	private readonly logger = new Logger(WebSocketAuthService.name);

	constructor() {}

	/**
   * Authenticates a WebSocket connection
   * @param connectionParams Connection parameters from client
   * @returns Authentication result
   */
	async authenticate(connectionParams: any): Promise<{
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
   * Validates JWT token and extracts user ID
   * @param token JWT token
   * @returns User ID or null if invalid
   */
	private async validateToken(token: string): Promise<string | null> {
		try {
			// This is a simplified JWT validation
			// In a real implementation, you would use @nestjs/jwt or similar
			const payload = this.decodeToken(token);

			if (!payload?.sub) {
				return null;
			}

			// Check token expiration
			if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
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

	/**
   * Decodes JWT token (simplified implementation)
   * @param token JWT token
   * @returns Decoded payload or null
   */
	private decodeToken(token: string): any {
		try {
			const parts = token.split('.');
			if (parts.length !== 3) {
				return null;
			}

			const payload = Buffer.from(parts[1] ?? '', 'base64url').toString();
			return JSON.parse(payload);
		} catch {
			return null;
		}
	}
}
