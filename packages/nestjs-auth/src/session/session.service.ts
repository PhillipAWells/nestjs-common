import { Injectable, NotFoundException } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { v4 as uuidv4 } from 'uuid';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { SessionRepository } from './session.repository.js';
import { SessionEventEmitter } from './session-event.emitter.js';
import { Session } from './session.entity.js';
import { IDeviceInfo, ISessionConfig, IUserProfile, SessionEventType } from './session.types.js';

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MINUTES_TO_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;

@Injectable()
export class SessionService implements LazyModuleRefService {
	constructor(public readonly moduleRef: ModuleRef) {}

	public get Repository(): SessionRepository {
		return this.moduleRef.get(SessionRepository);
	}

	public get EventEmitter(): SessionEventEmitter {
		return this.moduleRef.get(SessionEventEmitter);
	}

	public get Config(): ISessionConfig {
		// String token for session configuration
		return this.moduleRef.get('SESSION_CONFIG');
	}

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

	public async GetSession(sessionId: string): Promise<Session> {
		const session = await this.Repository.FindBySessionId(sessionId);
		if (!session) {
			throw new NotFoundException('Session not found');
		}
		return session;
	}

	public async GetUserSessions(userId: string): Promise<Session[]> {
		const sessions = await this.Repository.FindUserSessions(userId);
		return sessions;
	}

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

	public async UpdateLastActivity(sessionId: string): Promise<void> {
		await this.Repository.UpdateSessionActivity(sessionId);
	}

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
