import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SessionService } from '../session.service.js';
import { SessionRepository } from '../session.repository.js';
import { SessionEventEmitter } from '../session-event.emitter.js';
import { Session } from '../session.entity.js';
import { IDeviceInfo, IUserProfile, SessionEventType } from '../session.types.js';

/**
 * Session Module Integration Tests
 *
 * These tests verify the integration of SessionService with SessionRepository
 * and SessionEventEmitter using mocked implementations.
 */

function createService(
	sessionRepository: any,
	sessionEventEmitter: any,
	config: any,
): SessionService {
	const mockModuleRef = {
		get: (token: any, _opts?: any) => {
			if (token === SessionRepository) return sessionRepository;
			if (token === SessionEventEmitter) return sessionEventEmitter;
			if (token === 'SESSION_CONFIG') return config;
			return null;
		},
	};
	return new SessionService(mockModuleRef as any);
}

describe('Session Module Integration Tests', () => {
	let sessionService: SessionService;
	let sessionRepository: any;
	let sessionEventEmitter: any;

	// Mock data storage for repository simulation
	const sessions: Map<string, Session> = new Map();

	beforeAll(() => {
		// Create mock repository with in-memory storage
		sessionRepository = {
			Create: vi.fn(async (sessionData: Partial<Session>): Promise<Session> => {
				const session = { ...sessionData } as Session;
				sessions.set(session.sessionId, session);
				return session;
			}),
			FindBySessionId: vi.fn(async (sessionId: string): Promise<Session | null> => {
				return sessions.get(sessionId) ?? null;
			}),
			FindUserSessions: vi.fn(async (userId: string): Promise<Session[]> => {
				return Array.from(sessions.values()).filter((s) => s.userId === userId);
			}),
			Update: vi.fn(async (sessionId: string, updateData: Partial<Session>): Promise<Session | null> => {
				const session = sessions.get(sessionId);
				if (!session) return null;
				const updated = { ...session, ...updateData };
				sessions.set(sessionId, updated);
				return updated;
			}),
			UpdateSessionActivity: vi.fn(async (sessionId: string): Promise<void> => {
				const session = sessions.get(sessionId);
				if (session) {
					session.lastActivityAt = new Date();
					sessions.set(sessionId, session);
				}
			}),
			DeleteSession: vi.fn(async (sessionId: string): Promise<void> => {
				sessions.delete(sessionId);
			}),
			DeleteUserSessions: vi.fn(async (userId: string): Promise<void> => {
				for (const [key, session] of sessions.entries()) {
					if (session.userId === userId) {
						sessions.delete(key);
					}
				}
			}),
			FindActiveSessions: vi.fn(async (userId: string): Promise<Session[]> => {
				return Array.from(sessions.values()).filter(
					(s) => s.userId === userId && s.expiresAt > new Date(),
				);
			}),
		};

		// Create mock event emitter
		sessionEventEmitter = {
			EmitSessionEvent: vi.fn(),
		};

		sessionService = createService(sessionRepository, sessionEventEmitter, {
			sessionTtlMinutes: 1440,
			inactivityTimeoutMinutes: 60,
			defaultMaxConcurrentSessions: null,
			enforceSessionLimit: false,
		});
	});

	afterAll(() => {
		sessions.clear();
	});

	beforeEach(() => {
		// Clear mock data before each test
		sessions.clear();
		vi.clearAllMocks();
	});

	describe('Full Session Lifecycle', () => {
		it('should create, authenticate, and logout a session', async () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
				ipAddress: '127.0.0.1',
			};

			// Step 1: Create session
			const session = await sessionService.CreateOrGetSession(deviceInfo);
			expect(session.sessionId).toBeDefined();
			expect(session.isAuthenticated).toBe(false);
			expect(session.userId).toBeUndefined();
			expect(session.deviceInfo).toEqual(deviceInfo);
			expect(session.createdAt).toBeInstanceOf(Date);
			expect(session.lastActivityAt).toBeInstanceOf(Date);
			expect(session.expiresAt).toBeInstanceOf(Date);

			// Step 2: Authenticate session
			const userProfile: IUserProfile = {
				id: 'user-123',
				email: 'test@example.com',
				name: 'Test User',
				roles: ['user'],
				permissions: ['read:data'],
			};

			const authSession = await sessionService.AuthenticateSession(
				session.sessionId,
				userProfile,
				'access-token-123',
				'refresh-token-123',
				new Date(Date.now() + 900000), // 15 minutes
				new Date(Date.now() + 86400000), // 24 hours
				deviceInfo,
			);

			expect(authSession.isAuthenticated).toBe(true);
			expect(authSession.userId).toBe('user-123');
			expect(authSession.userProfile).toEqual(userProfile);
			expect(authSession.accessToken).toBe('access-token-123');
			expect(authSession.refreshToken).toBe('refresh-token-123');
			expect(authSession.loginHistory.length).toBe(1);
			expect(authSession.loginHistory[0]?.success).toBe(true);
			expect(authSession.loginHistory[0]?.provider).toBe('keycloak');

			// Step 3: Logout session
			await sessionService.LogoutSession(session.sessionId);

			const loggedOutSession = await sessionService.GetSession(session.sessionId);
			expect(loggedOutSession.isAuthenticated).toBe(false);
			expect(loggedOutSession.userId).toBeUndefined();
			expect(loggedOutSession.accessToken).toBeUndefined();
			expect(loggedOutSession.refreshToken).toBeUndefined();
			expect(loggedOutSession.userProfile).toBeUndefined();
		});

		it('should maintain login history through multiple sessions', async () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '192.168.1.1',
			};

			const userProfile: IUserProfile = {
				id: 'user-456',
				email: 'user@example.com',
				name: 'User',
				roles: ['user'],
				permissions: [],
			};

			// Create first session
			const session1 = await sessionService.CreateOrGetSession(deviceInfo);
			await sessionService.AuthenticateSession(
				session1.sessionId,
				userProfile,
				'token1',
				'refresh1',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 86400000),
				deviceInfo,
			);

			const fetchedSession1 = await sessionService.GetSession(session1.sessionId);
			expect(fetchedSession1.loginHistory.length).toBe(1);

			// Create second session for same user
			const session2 = await sessionService.CreateOrGetSession(deviceInfo);
			await sessionService.AuthenticateSession(
				session2.sessionId,
				userProfile,
				'token2',
				'refresh2',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 86400000),
				deviceInfo,
			);

			const fetchedSession2 = await sessionService.GetSession(session2.sessionId);
			expect(fetchedSession2.loginHistory.length).toBe(1);

			// Check user sessions
			const userSessions = await sessionService.GetUserSessions('user-456');
			expect(userSessions.length).toBe(2);
			expect(userSessions[0]?.userId).toBe('user-456');
			expect(userSessions[1]?.userId).toBe('user-456');
		});
	});

	describe('Token Refresh', () => {
		it('should refresh access token while keeping session active', async () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
			};

			const userProfile: IUserProfile = {
				id: 'user-789',
				email: 'refresh@example.com',
				name: 'Refresh User',
				roles: ['user'],
				permissions: ['read:streams'],
			};

			// Create and authenticate session
			const session = await sessionService.CreateOrGetSession(deviceInfo);
			const initialAccessTokenExpiry = new Date(Date.now() + 900000);
			const initialRefreshTokenExpiry = new Date(Date.now() + 86400000);

			await sessionService.AuthenticateSession(
				session.sessionId,
				userProfile,
				'old-access-token',
				'old-refresh-token',
				initialAccessTokenExpiry,
				initialRefreshTokenExpiry,
				deviceInfo,
			);

			// Refresh token
			const newAccessTokenExpiry = new Date(Date.now() + 900000);
			const newRefreshTokenExpiry = new Date(Date.now() + 86400000);

			const refreshedSession = await sessionService.RefreshSessionToken(
				session.sessionId,
				'new-access-token',
				newAccessTokenExpiry,
				'new-refresh-token',
				newRefreshTokenExpiry,
			);

			expect(refreshedSession.accessToken).toBe('new-access-token');
			expect(refreshedSession.refreshToken).toBe('new-refresh-token');
			expect(refreshedSession.isAuthenticated).toBe(true);
			expect(refreshedSession.userId).toBe('user-789');
		});

		it('should update last activity when token is refreshed', async () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
			};

			const session = await sessionService.CreateOrGetSession(deviceInfo);
			const initialLastActivity = session.lastActivityAt;

			// Wait a bit to ensure time difference
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Refresh token
			await sessionService.RefreshSessionToken(
				session.sessionId,
				'new-token',
				new Date(Date.now() + 900000),
			);

			const refreshedSession = await sessionService.GetSession(session.sessionId);
			expect(refreshedSession.lastActivityAt.getTime()).toBeGreaterThan(
				initialLastActivity.getTime(),
			);
		});
	});

	describe('Session Preferences', () => {
		it('should update and persist session preferences', async () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
			};

			const session = await sessionService.CreateOrGetSession(deviceInfo);

			const preferences = {
				theme: 'dark',
				language: 'en',
				notifications: 'enabled',
			};

			const updatedSession = await sessionService.UpdateSessionPreferences(
				session.sessionId,
				preferences,
			);

			expect(updatedSession.preferences).toBeDefined();
			const preferencesObj = updatedSession.preferences instanceof Map ? Object.fromEntries(updatedSession.preferences) : updatedSession.preferences!;
			expect(preferencesObj['theme']).toBe('dark');
			expect(preferencesObj['language']).toBe('en');
			expect(preferencesObj['notifications']).toBe('enabled');
		});
	});

	describe('Session Activity Tracking', () => {
		it('should update last activity timestamp', async () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
			};

			const session = await sessionService.CreateOrGetSession(deviceInfo);
			const initialLastActivity = session.lastActivityAt;

			// Wait a bit
			await new Promise((resolve) => setTimeout(resolve, 100));

			await sessionService.UpdateLastActivity(session.sessionId);

			const updatedSession = await sessionService.GetSession(session.sessionId);
			expect(updatedSession.lastActivityAt.getTime()).toBeGreaterThan(
				initialLastActivity.getTime(),
			);
		});
	});

	describe('Session Revocation and Invalidation', () => {
		it('should revoke a single session', async () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
			};

			const session = await sessionService.CreateOrGetSession(deviceInfo);

			await sessionService.RevokeSession(session.sessionId);

			await expect(sessionService.GetSession(session.sessionId)).rejects.toThrow(
				'Session not found',
			);
		});

		it('should invalidate all sessions for a user', async () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
			};

			const userProfile: IUserProfile = {
				id: 'user-invalidate',
				email: 'invalidate@example.com',
				name: 'Invalidate User',
				roles: ['user'],
				permissions: [],
			};

			// Create multiple sessions for same user
			const session1 = await sessionService.CreateOrGetSession(deviceInfo);
			const session2 = await sessionService.CreateOrGetSession(deviceInfo);
			const session3 = await sessionService.CreateOrGetSession(deviceInfo);

			await sessionService.AuthenticateSession(
				session1.sessionId,
				userProfile,
				'token1',
				'refresh1',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 86400000),
				deviceInfo,
			);

			await sessionService.AuthenticateSession(
				session2.sessionId,
				userProfile,
				'token2',
				'refresh2',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 86400000),
				deviceInfo,
			);

			await sessionService.AuthenticateSession(
				session3.sessionId,
				userProfile,
				'token3',
				'refresh3',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 86400000),
				deviceInfo,
			);

			// Verify all sessions exist
			let userSessions = await sessionService.GetUserSessions('user-invalidate');
			expect(userSessions.length).toBe(3);

			// Invalidate all
			await sessionService.InvalidateAllUserSessions('user-invalidate');

			// Verify all deleted
			userSessions = await sessionService.GetUserSessions('user-invalidate');
			expect(userSessions.length).toBe(0);
		});
	});

	describe('Session Event Emission', () => {
		it('should emit AUTHENTICATED event on session authentication', async () => {
			const emitSpy = vi.spyOn(sessionEventEmitter, 'EmitSessionEvent');

			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
			};

			const userProfile: IUserProfile = {
				id: 'user-event',
				email: 'event@example.com',
				name: 'Event User',
				roles: ['user'],
				permissions: [],
			};

			const session = await sessionService.CreateOrGetSession(deviceInfo);
			await sessionService.AuthenticateSession(
				session.sessionId,
				userProfile,
				'token',
				'refresh',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 86400000),
				deviceInfo,
			);

			expect(emitSpy).toHaveBeenCalledWith(
				session.sessionId,
				SessionEventType.AUTHENTICATED,
				expect.objectContaining({
					userId: 'user-event',
					provider: 'keycloak',
				}),
			);

			emitSpy.mockRestore();
		});

		it('should emit LOGGED_OUT event on logout', async () => {
			const emitSpy = vi.spyOn(sessionEventEmitter, 'EmitSessionEvent');

			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
			};

			const userProfile: IUserProfile = {
				id: 'user-logout',
				email: 'logout@example.com',
				name: 'Logout User',
				roles: ['user'],
				permissions: [],
			};

			const session = await sessionService.CreateOrGetSession(deviceInfo);
			await sessionService.AuthenticateSession(
				session.sessionId,
				userProfile,
				'token',
				'refresh',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 86400000),
				deviceInfo,
			);

			emitSpy.mockClear();

			await sessionService.LogoutSession(session.sessionId);

			expect(emitSpy).toHaveBeenCalledWith(
				session.sessionId,
				SessionEventType.LOGGED_OUT,
				expect.objectContaining({
					userId: 'user-logout',
				}),
			);

			emitSpy.mockRestore();
		});

		it('should emit TOKEN_REFRESHED event on token refresh', async () => {
			const emitSpy = vi.spyOn(sessionEventEmitter, 'EmitSessionEvent');

			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
			};

			const userProfile: IUserProfile = {
				id: 'user-refresh',
				email: 'refresh@example.com',
				name: 'Refresh User',
				roles: ['user'],
				permissions: [],
			};

			const session = await sessionService.CreateOrGetSession(deviceInfo);
			await sessionService.AuthenticateSession(
				session.sessionId,
				userProfile,
				'token',
				'refresh',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 86400000),
				deviceInfo,
			);

			emitSpy.mockClear();

			await sessionService.RefreshSessionToken(
				session.sessionId,
				'new-token',
				new Date(Date.now() + 900000),
			);

			expect(emitSpy).toHaveBeenCalledWith(
				session.sessionId,
				SessionEventType.TOKEN_REFRESHED,
				expect.objectContaining({
					userId: 'user-refresh',
				}),
			);

			emitSpy.mockRestore();
		});

		it('should emit SESSION_REVOKED event on revocation', async () => {
			const emitSpy = vi.spyOn(sessionEventEmitter, 'EmitSessionEvent');

			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
			};

			const userProfile: IUserProfile = {
				id: 'user-revoke',
				email: 'revoke@example.com',
				name: 'Revoke User',
				roles: ['user'],
				permissions: [],
			};

			const session = await sessionService.CreateOrGetSession(deviceInfo);
			await sessionService.AuthenticateSession(
				session.sessionId,
				userProfile,
				'token',
				'refresh',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 86400000),
				deviceInfo,
			);

			emitSpy.mockClear();

			await sessionService.RevokeSession(session.sessionId);

			expect(emitSpy).toHaveBeenCalledWith(
				session.sessionId,
				SessionEventType.SESSION_REVOKED,
				expect.objectContaining({
					userId: 'user-revoke',
					reason: 'Session revoked by administrator',
				}),
			);

			emitSpy.mockRestore();
		});
	});

	describe('Concurrent Session Limits (when enforced)', () => {
		it('should enforce max concurrent sessions when enabled', async () => {
			// Create new mock repository for limited sessions test
			const limitedSessions: Map<string, Session> = new Map();

			const limitedRepository = {
				Create: vi.fn(async (sessionData: Partial<Session>): Promise<Session> => {
					const session = { ...sessionData } as Session;
					limitedSessions.set(session.sessionId, session);
					return session;
				}),
				FindBySessionId: vi.fn(async (sessionId: string): Promise<Session | null> => {
					return limitedSessions.get(sessionId) ?? null;
				}),
				FindUserSessions: vi.fn(async (userId: string): Promise<Session[]> => {
					return Array.from(limitedSessions.values()).filter((s) => s.userId === userId);
				}),
				Update: vi.fn(async (sessionId: string, updateData: Partial<Session>): Promise<Session | null> => {
					const session = limitedSessions.get(sessionId);
					if (!session) return null;
					const updated = { ...session, ...updateData };
					limitedSessions.set(sessionId, updated);
					return updated;
				}),
				UpdateSessionActivity: vi.fn(async (sessionId: string): Promise<void> => {
					const session = limitedSessions.get(sessionId);
					if (session) {
						session.lastActivityAt = new Date();
						limitedSessions.set(sessionId, session);
					}
				}),
				DeleteSession: vi.fn(async (sessionId: string): Promise<void> => {
					limitedSessions.delete(sessionId);
				}),
				DeleteUserSessions: vi.fn(async (userId: string): Promise<void> => {
					for (const [key, session] of limitedSessions.entries()) {
						if (session.userId === userId) {
							limitedSessions.delete(key);
						}
					}
				}),
				FindActiveSessions: vi.fn(async (userId: string): Promise<Session[]> => {
					return Array.from(limitedSessions.values()).filter(
						(s) => s.userId === userId && s.expiresAt > new Date(),
					);
				}),
			};

			const limitedSessionService = createService(limitedRepository, sessionEventEmitter, {
				sessionTtlMinutes: 1440,
				inactivityTimeoutMinutes: 60,
				defaultMaxConcurrentSessions: 2,
				enforceSessionLimit: true,
			});

			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
			};

			const userProfile: IUserProfile = {
				id: 'user-limit',
				email: 'limit@example.com',
				name: 'Limit User',
				roles: ['user'],
				permissions: [],
			};

			// Create first session
			const session1 = await limitedSessionService.CreateOrGetSession(deviceInfo);
			await limitedSessionService.AuthenticateSession(
				session1.sessionId,
				userProfile,
				'token1',
				'refresh1',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 86400000),
				deviceInfo,
			);

			// Create second session
			const session2 = await limitedSessionService.CreateOrGetSession(deviceInfo);
			await limitedSessionService.AuthenticateSession(
				session2.sessionId,
				userProfile,
				'token2',
				'refresh2',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 86400000),
				deviceInfo,
			);

			// Create third session (should trigger removal of oldest)
			const session3 = await limitedSessionService.CreateOrGetSession(deviceInfo);
			await limitedSessionService.AuthenticateSession(
				session3.sessionId,
				userProfile,
				'token3',
				'refresh3',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 86400000),
				deviceInfo,
			);

			// Check that max 2 active sessions exist
			const activeSessions = await limitedSessionService.GetUserSessions('user-limit');
			expect(activeSessions.length).toBeLessThanOrEqual(2);
		});
	});

	describe('Error Handling', () => {
		it('should throw NotFoundException when authenticating non-existent session', async () => {
			const userProfile: IUserProfile = {
				id: 'user-not-found',
				email: 'notfound@example.com',
				name: 'Not Found User',
				roles: ['user'],
				permissions: [],
			};

			await expect(
				sessionService.AuthenticateSession(
					'non-existent-session-id',
					userProfile,
					'token',
					'refresh',
					new Date(Date.now() + 900000),
					new Date(Date.now() + 86400000),
					{ userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
				),
			).rejects.toThrow('Session not found');
		});

		it('should throw NotFoundException when logging out non-existent session', async () => {
			await expect(sessionService.LogoutSession('non-existent-session')).rejects.toThrow(
				'Session not found',
			);
		});

		it('should throw NotFoundException when refreshing non-existent session', async () => {
			await expect(
				sessionService.RefreshSessionToken(
					'non-existent-session',
					'new-token',
					new Date(Date.now() + 900000),
				),
			).rejects.toThrow('Session not found');
		});

		it('should throw NotFoundException when getting non-existent session', async () => {
			await expect(sessionService.GetSession('non-existent-session')).rejects.toThrow(
				'Session not found',
			);
		});
	});
});
