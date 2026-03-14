import { Injectable, Logger } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';

/**
 * Connection parameters for WebSocket authentication
 */
interface WebSocketConnectionParams {
	authorization?: string;
	Authorization?: string;
	token?: string;
	authToken?: string;
	[key: string]: unknown;
}

/**
 * Service for WebSocket connection authentication
 */
@Injectable()
export class WebSocketAuthService implements LazyModuleRefService {
	private readonly logger = new Logger(WebSocketAuthService.name);

	private get jwtService(): JwtService | undefined {
		try {
			return this.Module.get(JwtService, { strict: false });
		} catch {
			return undefined;
		}
	}

	constructor(public readonly Module: ModuleRef) {}

	/**
   * Authenticates a WebSocket connection
   * @param connectionParams Connection parameters from client
   * @returns Authentication result
   */
	public async authenticate(connectionParams: WebSocketConnectionParams): Promise<{
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
		} catch (error: unknown) {
			this.logger.error(
				`WebSocket authentication error: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error.stack : undefined,
			);
			return {
				authenticated: false,
				error: 'Authentication failed',
			};
		}
	}

	/**
   * Validates JWT token with cryptographic signature verification and extracts user ID.
   * @param token JWT token
   * @returns User ID or null if invalid
   */
	private async validateToken(token: string): Promise<string | null> {
		try {
			const { jwtService } = this;
			if (!jwtService) {
				// JwtService is required for signature verification — fail closed per security policy
				this.logger.error('JwtService unavailable — WebSocket authentication denied (signature verification required)');
				return null;
			}

			// Verify token with cryptographic signature validation
			const payload = await jwtService.verifyAsync(token);

			if (!payload?.sub) {
				return null;
			}

			return payload.sub;
		} catch (error: unknown) {
			this.logger.warn(`Token validation error: ${error instanceof Error ? error.message : String(error)}`);
			return null;
		}
	}

	/**
   * Extracts token from connection parameters
   * @param connectionParams Connection parameters
   * @returns Token string or null
   */
	private extractToken(connectionParams: WebSocketConnectionParams): string | null {
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
