import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';

/**
 * Connection parameters for WebSocket authentication
 */
interface IWebSocketConnectionParams {
	authorization?: string;
	Authorization?: string;
	token?: string;
	authToken?: string;
	[key: string]: unknown;
}

const BEARER_PREFIX_LENGTH = 7; // 'Bearer '.length

/**
 * Service for WebSocket connection authentication
 */
@Injectable()
export class WebSocketAuthService implements ILazyModuleRefService {
	public readonly Module: ModuleRef;

	private get AppLogger(): AppLogger | undefined {
		try {
			return this.Module.get(AppLogger, { strict: false });
		} catch {
			return undefined;
		}
	}

	private get Logger(): AppLogger | undefined {
		try {
			return this.AppLogger?.createContextualLogger(WebSocketAuthService.name);
		} catch {
			return undefined;
		}
	}

	private get jwtService(): JwtService | undefined {
		try {
			return this.Module.get(JwtService, { strict: false });
		} catch {
			return undefined;
		}
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

	/**
   * Authenticates a WebSocket connection
   * @param connectionParams Connection parameters from client
   * @returns Authentication result
   */
	public async authenticate(connectionParams: IWebSocketConnectionParams): Promise<{
		authenticated: boolean;
		userId?: string;
		error?: string;
	}> {
		try {
			this.Logger?.debug('Authenticating WebSocket connection');

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

			const USER_ID_MASK_LENGTH = 8;
			const maskedUserId = userId && userId.length > USER_ID_MASK_LENGTH ? `${userId.substring(0, USER_ID_MASK_LENGTH)}...` : userId;
			this.Logger?.debug(`WebSocket connection authenticated for user: ${maskedUserId}`);
			return {
				authenticated: true,
				userId,
			};
		} catch (error: unknown) {
			this.Logger?.error(
				`WebSocket authentication error: ${getErrorMessage(error)}`,
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
   * @returns IUser ID or null if invalid
   */
	private async validateToken(token: string): Promise<string | null> {
		try {
			const { jwtService } = this;
			if (!jwtService) {
				// JwtService is required for signature verification — fail closed per security policy
				this.Logger?.error('JwtService unavailable — WebSocket authentication denied (signature verification required)');
				return null;
			}

			// Strip Bearer prefix if present
			const bearerToken = token.startsWith('Bearer ') ? token.slice(BEARER_PREFIX_LENGTH) : token;

			// Verify token with cryptographic signature validation
			const payload = await jwtService.verifyAsync(bearerToken);

			if (!payload?.sub) {
				return null;
			}

			return payload.sub;
		} catch (error: unknown) {
			this.Logger?.info(`Token validation error: ${getErrorMessage(error)}`);
			return null;
		}
	}

	/**
   * Extracts token from connection parameters
   * @param connectionParams Connection parameters
   * @returns Token string or null
   */
	private extractToken(connectionParams: IWebSocketConnectionParams): string | null {
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
