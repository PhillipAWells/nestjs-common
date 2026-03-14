import { Injectable, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { v4 as uuidv4 } from 'uuid';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { SessionRepository } from './session.repository.js';
import { SessionEventEmitter } from './session-event.emitter.js';
import { Session } from './session.entity.js';
import { IDeviceInfo, ISessionConfig, IUserProfile, SessionEventType } from './session.types.js';

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MINUTES_TO_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;

/**
 * Session service for managing user sessions and device tracking.
 * Handles session lifecycle, concurrent session limits, token management, and event emission.
 *
 * @class SessionService
 * @implements {LazyModuleRefService}
 */
@Injectable()
export class SessionService implements LazyModuleRefService {
	constructor(public readonly Module: ModuleRef) {}

	public get Repository(): SessionRepository {
		return this.Module.get(SessionRepository);
	}

	public get EventEmitter(): SessionEventEmitter {
		return this.Module.get(SessionEventEmitter);
	}

	public get Config(): ISessionConfig {
		// String token for session configuration
		return this.Module.get('SESSION_CONFIG');
	}

	/**
	 * Create a new session for a device
	 * @param deviceInfo Device information including browser, OS, IP
	 * @returns Newly created unauthenticated session
	 */
	public async CreateOrGetSession(deviceInfo: IDeviceInfo): Promise<Session> {
		const sessionId = uuidv4();
		const now = new Date();
		const expiresAt = new Date(now.getTime() + this.Config.sessionTtlMinutes * MINUTES_TO_MS);

		const session = await this.Repository.Create({
			sessionId,
			isAuthenticated: false,
			deviceInfo,
			createdAt: now,
			lastActivityAt: now,
			expiresAt,
			loginHistory: [],
		});

		return session;
	}

	/**
	 * Authenticate a session with user profile and tokens
	 * Enforces concurrent session limits if configured
	 * @param sessionId Session ID to authenticate
	 * @param userProfile User profile information
	 * @param accessToken OAuth/JWT access token
	 * @param refreshToken OAuth/JWT refresh token
	 * @param accessTokenExpiresAt Access token expiration time
	 * @param refreshTokenExpiresAt Refresh token expiration time
	 * @param deviceInfo Device information
	 * @param provider Authentication provider (default: 'keycloak')
	 * @returns Authenticated session
	 * @throws NotFoundException if session not found
	 */
	public async AuthenticateSession(
		sessionId: string,
		userProfile: IUserProfile,
		accessToken: string,
		refreshToken: string,
		accessTokenExpiresAt: Date,
		refreshTokenExpiresAt: Date,
		deviceInfo: IDeviceInfo,
		provider: string = 'keycloak',
	): Promise<Session> {
		const session = await this.Repository.FindBySessionId(sessionId);
		if (!session) {
			throw new NotFoundException('Session not found');
		}

		// Check concurrent session limits if enforced
		if (this.Config.enforceSessionLimit && this.Config.defaultMaxConcurrentSessions) {
			const activeSessions = await this.Repository.FindActiveSessions(userProfile.id);
			if (activeSessions.length >= this.Config.defaultMaxConcurrentSessions) {
				// Delete oldest session
				const [oldestSession] = activeSessions;
				if (oldestSession) {
					await this.Repository.DeleteSession(oldestSession.sessionId);
					this.EventEmitter.EmitSessionEvent(
						oldestSession.sessionId,
						SessionEventType.SESSION_REVOKED,
						{ reason: 'Max concurrent sessions exceeded' },
					);
				}
			}
		}

		const now = new Date();
		const loginRecord = {
			timestamp: now,
			deviceInfo,
			success: true,
			provider,
		};

		const updatedSession = await this.Repository.Update(sessionId, {
			userId: userProfile.id,
			isAuthenticated: true,
			userProfile,
			accessToken,
			refreshToken,
			accessTokenExpiresAt,
			refreshTokenExpiresAt,
			lastActivityAt: now,
			loginHistory: [...(session.loginHistory || []), loginRecord],
		});

		if (!updatedSession) {
			throw new NotFoundException('Failed to authenticate session');
		}

		this.EventEmitter.EmitSessionEvent(sessionId, SessionEventType.AUTHENTICATED, {
			userId: userProfile.id,
			provider,
		});

		return updatedSession;
	}

	/**
	 * Logout a session by removing authentication data
	 * @param sessionId Session ID to logout
	 * @throws NotFoundException if session not found
	 */
	public async LogoutSession(sessionId: string): Promise<void> {
		const session = await this.Repository.FindBySessionId(sessionId);
		if (!session) {
			throw new NotFoundException('Session not found');
		}

		const updateData: Record<string, any> = {
			isAuthenticated: false,
		};

		// Set optional fields to undefined explicitly
		updateData['userId'] = undefined;
		updateData['accessToken'] = undefined;
		updateData['refreshToken'] = undefined;
		updateData['userProfile'] = undefined;

		await this.Repository.Update(sessionId, updateData);

		this.EventEmitter.EmitSessionEvent(sessionId, SessionEventType.LOGGED_OUT, {
			userId: session.userId,
		});
	}

	/**
	 * Refresh session tokens with new access/refresh tokens
	 * @param sessionId Session ID to refresh
	 * @param newAccessToken New access token
	 * @param newAccessTokenExpiresAt Access token expiration time
	 * @param newRefreshToken Optional new refresh token
	 * @param newRefreshTokenExpiresAt Refresh token expiration time
	 * @returns Updated session
	 * @throws NotFoundException if session not found
	 */
	public async RefreshSessionToken(
		sessionId: string,
		newAccessToken: string,
		newAccessTokenExpiresAt: Date,
		newRefreshToken?: string,
		newRefreshTokenExpiresAt?: Date,
	): Promise<Session> {
		const session = await this.Repository.FindBySessionId(sessionId);
		if (!session) {
			throw new NotFoundException('Session not found');
		}

		const updateData: Partial<Session> = {
			accessToken: newAccessToken,
			accessTokenExpiresAt: newAccessTokenExpiresAt,
			lastActivityAt: new Date(),
		};

		if (newRefreshToken && newRefreshTokenExpiresAt) {
			updateData.refreshToken = newRefreshToken;
			updateData.refreshTokenExpiresAt = newRefreshTokenExpiresAt;
		}

		const updatedSession = await this.Repository.Update(sessionId, updateData);

		if (!updatedSession) {
			throw new NotFoundException('Failed to refresh token');
		}

		this.EventEmitter.EmitSessionEvent(sessionId, SessionEventType.TOKEN_REFRESHED, {
			userId: session.userId,
		});

		return updatedSession;
	}

	/**
	 * Retrieve a session by ID
	 * @param sessionId Session ID to retrieve
	 * @returns Session document
	 * @throws NotFoundException if session not found
	 */
	public async GetSession(sessionId: string): Promise<Session> {
		const session = await this.Repository.FindBySessionId(sessionId);
		if (!session) {
			throw new NotFoundException('Session not found');
		}
		return session;
	}

	/**
	 * Get all active sessions for a user
	 * @param userId User ID to query sessions for
	 * @returns Array of sessions for the user
	 */
	public async GetUserSessions(userId: string): Promise<Session[]> {
		const sessions = await this.Repository.FindUserSessions(userId);
		return sessions;
	}

	/**
	 * Invalidate all sessions for a user (logout all devices)
	 * @param userId User ID to invalidate sessions for
	 */
	public async InvalidateAllUserSessions(userId: string): Promise<void> {
		const sessions = await this.Repository.FindUserSessions(userId);

		for (const session of sessions) {
			await this.Repository.DeleteSession(session.sessionId);
			this.EventEmitter.EmitSessionEvent(session.sessionId, SessionEventType.SESSION_REVOKED, {
				userId,
				reason: 'User invalidated all sessions',
			});
		}
	}

	/**
	 * Revoke a session by administrator
	 * @param sessionId Session ID to revoke
	 * @throws NotFoundException if session not found
	 */
	public async RevokeSession(sessionId: string): Promise<void> {
		const session = await this.Repository.FindBySessionId(sessionId);
		if (!session) {
			throw new NotFoundException('Session not found');
		}

		await this.Repository.DeleteSession(sessionId);

		this.EventEmitter.EmitSessionEvent(sessionId, SessionEventType.SESSION_REVOKED, {
			userId: session.userId,
			reason: 'Session revoked by administrator',
		});
	}

	/**
	 * Update user preferences stored with session
	 * @param sessionId Session ID to update
	 * @param preferences Key-value preferences object
	 * @returns Updated session
	 * @throws NotFoundException if session not found
	 */
	public async UpdateSessionPreferences(sessionId: string, preferences: Record<string, string>): Promise<Session> {
		const session = await this.Repository.FindBySessionId(sessionId);
		if (!session) {
			throw new NotFoundException('Session not found');
		}

		const updatedSession = await this.Repository.Update(sessionId, {
			preferences: preferences as Record<string, string>,
			lastActivityAt: new Date(),
		});

		if (!updatedSession) {
			throw new NotFoundException('Failed to update preferences');
		}

		return updatedSession;
	}

	/**
	 * Update session's last activity timestamp
	 * @param sessionId Session ID to update
	 */
	public async UpdateLastActivity(sessionId: string): Promise<void> {
		await this.Repository.UpdateSessionActivity(sessionId);
	}

	/**
	 * Set maximum concurrent sessions limit for a user
	 * @param userId User ID to set limit for
	 * @param max Maximum concurrent sessions (null to remove custom limit)
	 */
	public async SetMaxConcurrentSessions(userId: string, max: number | null): Promise<void> {
		const sessions = await this.Repository.FindUserSessions(userId);
		for (const session of sessions) {
			const updateData: Record<string, any> = {};
			if (max !== null) {
				updateData['maxConcurrentSessions'] = max;
			} else {
				updateData['maxConcurrentSessions'] = undefined;
			}
			await this.Repository.Update(session.sessionId, updateData);
		}
	}
}
