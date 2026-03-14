import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionService } from '../session.service.js';
import { SessionRepository } from '../session.repository.js';
import { SessionEventEmitter } from '../session-event.emitter.js';
import { IDeviceInfo, IUserProfile, SessionEventType } from '../session.types.js';
import { v4 as uuidv4 } from 'uuid';

// Session timing constants
const SESSION_TTL_MS = 900_000; // 15 minutes
const USER_SESSION_TTL_MS = 86_400_000; // 24 hours
const SESSION_TTL_MINUTES = 1_440; // 24 hours in minutes
const INACTIVITY_TIMEOUT_MINUTES = 60; // 1 hour
const REFRESH_TIMEOUT_MINUTES = 30; // 30 minutes
const SHORT_SESSION_TTL_MINUTES = 60; // 1 hour

// Concurrent session constants
const DEFAULT_MAX_CONCURRENT_SESSIONS = 2;
const MAX_CONCURRENT_SESSIONS_TEST_VALUE = 3;
const MAX_CONCURRENT_SESSIONS_LIMIT = 5;

// Time offset constants for testing
const TEN_SECONDS_AGO_MS = 10_000;
const FIVE_SECONDS_AGO_MS = 5_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_SECOND = 1_000;
const ONE_HOUR_MS = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * MILLISECONDS_PER_SECOND;

// Tolerance constant for time assertions (milliseconds)
const TIME_ASSERTION_TOLERANCE_MS = 100;

function createService(mockRepository: any, mockEventEmitter: any, config: any): SessionService {
	const mockModuleRef = {
		get: (token: any, _opts?: any) => {
			if (token === SessionRepository) return mockRepository;
			if (token === SessionEventEmitter) return mockEventEmitter;
			if (token === 'SESSION_CONFIG') return config;
			return null;
		},
	};
	return new SessionService(mockModuleRef as any);
}

describe('SessionService', () => {
	let service: SessionService;
	let mockRepository: any;
	let mockEventEmitter: any;

	beforeEach(() => {
		mockRepository = {
			Create: vi.fn(),
			FindBySessionId: vi.fn(),
			FindUserSessions: vi.fn(),
			Update: vi.fn(),
			UpdateSessionActivity: vi.fn(),
			DeleteSession: vi.fn(),
			DeleteUserSessions: vi.fn(),
			FindActiveSessions: vi.fn(),
		};

		mockEventEmitter = {
			EmitSessionEvent: vi.fn(),
		};

		service = createService(mockRepository, mockEventEmitter, {
			sessionTtlMinutes: SESSION_TTL_MINUTES,
			inactivityTimeoutMinutes: INACTIVITY_TIMEOUT_MINUTES,
			defaultMaxConcurrentSessions: null,
			enforceSessionLimit: false,
		});
	});

	describe('CreateOrGetSession', () => {
		it('should create a new unauthenticated session', async () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
			};

			const mockSession = {
				sessionId: expect.any(String),
				userId: undefined,
				isAuthenticated: false,
				deviceInfo,
				createdAt: expect.any(Date),
				lastActivityAt: expect.any(Date),
				expiresAt: expect.any(Date),
				loginHistory: [],
			};

			mockRepository.Create.mockResolvedValue(mockSession);

			const result = await service.CreateOrGetSession(deviceInfo);

			expect(mockRepository.Create).toHaveBeenCalled();
			expect(result.isAuthenticated).toBe(false);
			expect(result.deviceInfo).toEqual(deviceInfo);
		});
	});

	describe('AuthenticateSession', () => {
		it('should authenticate a session with user data', async () => {
			const sessionId = uuidv4();
			const userProfile: IUserProfile = {
				id: 'user-123',
				email: 'test@example.com',
				name: 'Test User',
				roles: ['user'],
				permissions: ['read:streams'],
			};

			const updatedSession = {
				sessionId,
				userId: userProfile.id,
				isAuthenticated: true,
				userProfile,
				accessToken: 'access-token',
				accessTokenExpiresAt: new Date(),
				refreshToken: 'refresh-token',
				refreshTokenExpiresAt: new Date(),
				deviceInfo: { userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
				createdAt: new Date(),
				lastActivityAt: new Date(),
				expiresAt: new Date(),
				loginHistory: [
					{
						timestamp: new Date(),
						deviceInfo: { userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
						success: true,
						provider: 'keycloak',
					},
				],
			};

			mockRepository.FindBySessionId.mockResolvedValue({ loginHistory: [] });
			mockRepository.Update.mockResolvedValue(updatedSession);

			const result = await service.AuthenticateSession(
				sessionId,
				userProfile,
				'access-token',
				'refresh-token',
				new Date(Date.now() + SESSION_TTL_MS),
				new Date(Date.now() + USER_SESSION_TTL_MS),
				{ userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
			);

			expect(mockRepository.Update).toHaveBeenCalled();
			expect(mockEventEmitter.EmitSessionEvent).toHaveBeenCalledWith(
				sessionId,
				SessionEventType.AUTHENTICATED,
				expect.any(Object),
			);
			expect(result.isAuthenticated).toBe(true);
		});
	});

	describe('LogoutSession', () => {
		it('should clear authentication from session', async () => {
			const sessionId = uuidv4();
			const session = {
				sessionId,
				userId: 'user-123',
				isAuthenticated: true,
				deviceInfo: { userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
				createdAt: new Date(),
				lastActivityAt: new Date(),
				expiresAt: new Date(),
			};

			mockRepository.FindBySessionId.mockResolvedValue(session);
			mockRepository.Update.mockResolvedValue({
				...session,
				userId: undefined,
				isAuthenticated: false,
				accessToken: undefined,
				refreshToken: undefined,
			});

			await service.LogoutSession(sessionId);

			expect(mockRepository.Update).toHaveBeenCalledWith(sessionId, expect.objectContaining({
				isAuthenticated: false,
				userId: undefined,
			}));
			expect(mockEventEmitter.EmitSessionEvent).toHaveBeenCalledWith(
				sessionId,
				SessionEventType.LOGGED_OUT,
				expect.any(Object),
			);
		});
	});

	describe('GetSession', () => {
		it('should retrieve a session by ID', async () => {
			const sessionId = uuidv4();
			const session = { sessionId, isAuthenticated: false };

			mockRepository.FindBySessionId.mockResolvedValue(session);

			const result = await service.GetSession(sessionId);

			expect(mockRepository.FindBySessionId).toHaveBeenCalledWith(sessionId);
			expect(result).toEqual(session);
		});

		it('should throw error if session not found', async () => {
			mockRepository.FindBySessionId.mockResolvedValue(null);

			await expect(service.GetSession('invalid-id')).rejects.toThrow('Session not found');
		});
	});

	describe('UpdateLastActivity', () => {
		it('should update last activity timestamp', async () => {
			const sessionId = uuidv4();
			mockRepository.UpdateSessionActivity.mockResolvedValue(undefined);

			await service.UpdateLastActivity(sessionId);

			expect(mockRepository.UpdateSessionActivity).toHaveBeenCalledWith(sessionId);
		});
	});

	describe('RefreshSessionToken', () => {
		it('should refresh access token only', async () => {
			const sessionId = uuidv4();
			const session = {
				sessionId,
				userId: 'user-123',
				isAuthenticated: true,
				deviceInfo: { userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
				createdAt: new Date(),
				lastActivityAt: new Date(),
				expiresAt: new Date(),
				loginHistory: [],
			};

			const updatedSession = {
				...session,
				accessToken: 'new-access-token',
				accessTokenExpiresAt: new Date(Date.now() + SESSION_TTL_MS),
				lastActivityAt: expect.any(Date),
			};

			mockRepository.FindBySessionId.mockResolvedValue(session);
			mockRepository.Update.mockResolvedValue(updatedSession);

			const result = await service.RefreshSessionToken(
				sessionId,
				'new-access-token',
				new Date(Date.now() + SESSION_TTL_MS),
			);

			expect(mockRepository.Update).toHaveBeenCalledWith(
				sessionId,
				expect.objectContaining({
					accessToken: 'new-access-token',
				}),
			);
			expect(mockEventEmitter.EmitSessionEvent).toHaveBeenCalledWith(
				sessionId,
				SessionEventType.TOKEN_REFRESHED,
				expect.any(Object),
			);
			expect(result.accessToken).toBe('new-access-token');
		});

		it('should refresh both access and refresh tokens', async () => {
			const sessionId = uuidv4();
			const session = {
				sessionId,
				userId: 'user-123',
				isAuthenticated: true,
				deviceInfo: { userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
				createdAt: new Date(),
				lastActivityAt: new Date(),
				expiresAt: new Date(),
				loginHistory: [],
			};

			const newAccessTokenExpiry = new Date(Date.now() + SESSION_TTL_MS);
			const newRefreshTokenExpiry = new Date(Date.now() + USER_SESSION_TTL_MS);

			const updatedSession = {
				...session,
				accessToken: 'new-access-token',
				refreshToken: 'new-refresh-token',
				accessTokenExpiresAt: newAccessTokenExpiry,
				refreshTokenExpiresAt: newRefreshTokenExpiry,
				lastActivityAt: expect.any(Date),
			};

			mockRepository.FindBySessionId.mockResolvedValue(session);
			mockRepository.Update.mockResolvedValue(updatedSession);

			const result = await service.RefreshSessionToken(
				sessionId,
				'new-access-token',
				newAccessTokenExpiry,
				'new-refresh-token',
				newRefreshTokenExpiry,
			);

			expect(mockRepository.Update).toHaveBeenCalledWith(
				sessionId,
				expect.objectContaining({
					accessToken: 'new-access-token',
					refreshToken: 'new-refresh-token',
				}),
			);
			expect(result.refreshToken).toBe('new-refresh-token');
		});

		it('should throw error if session not found', async () => {
			mockRepository.FindBySessionId.mockResolvedValue(null);

			await expect(
				service.RefreshSessionToken(
					'invalid-id',
					'new-token',
					new Date(),
				),
			).rejects.toThrow('Session not found');
		});

		it('should throw error if update fails', async () => {
			const sessionId = uuidv4();
			const session = {
				sessionId,
				userId: 'user-123',
				isAuthenticated: true,
			};

			mockRepository.FindBySessionId.mockResolvedValue(session);
			mockRepository.Update.mockResolvedValue(null);

			await expect(
				service.RefreshSessionToken(
					sessionId,
					'new-token',
					new Date(),
				),
			).rejects.toThrow('Failed to refresh token');
		});

		it('should update last activity on token refresh', async () => {
			const sessionId = uuidv4();
			const session = {
				sessionId,
				userId: 'user-123',
				isAuthenticated: true,
				loginHistory: [],
			};

			const beforeRefresh = Date.now();
			mockRepository.FindBySessionId.mockResolvedValue(session);
			mockRepository.Update.mockResolvedValue(session);

			await service.RefreshSessionToken(
				sessionId,
				'new-token',
				new Date(),
			);

			const afterRefresh = Date.now();
			const [[, callArgs]] = mockRepository.Update.mock.calls;
			const lastActivityTime = (callArgs as any).lastActivityAt.getTime();

			expect(lastActivityTime).toBeGreaterThanOrEqual(beforeRefresh);
			expect(lastActivityTime).toBeLessThanOrEqual(afterRefresh);
		});
	});

	describe('GetUserSessions', () => {
		it('should retrieve all sessions for a user', async () => {
			const userId = 'user-123';
			const sessions = [
				{ sessionId: uuidv4(), userId, isAuthenticated: true },
				{ sessionId: uuidv4(), userId, isAuthenticated: true },
			];

			mockRepository.FindUserSessions.mockResolvedValue(sessions);

			const result = await service.GetUserSessions(userId);

			expect(mockRepository.FindUserSessions).toHaveBeenCalledWith(userId);
			expect(result).toHaveLength(2);
			expect(result).toEqual(sessions);
		});

		it('should return empty array if user has no sessions', async () => {
			mockRepository.FindUserSessions.mockResolvedValue([]);

			const result = await service.GetUserSessions('user-no-sessions');

			expect(result).toEqual([]);
			expect(mockRepository.FindUserSessions).toHaveBeenCalled();
		});
	});

	describe('InvalidateAllUserSessions', () => {
		it('should invalidate all sessions for a user', async () => {
			const userId = 'user-123';
			const sessions = [
				{ sessionId: uuidv4(), userId, isAuthenticated: true },
				{ sessionId: uuidv4(), userId, isAuthenticated: true },
			];

			mockRepository.FindUserSessions.mockResolvedValue(sessions);
			mockRepository.DeleteSession.mockResolvedValue(undefined);

			await service.InvalidateAllUserSessions(userId);

			expect(mockRepository.DeleteSession).toHaveBeenCalledTimes(2);
			sessions.forEach(session => {
				expect(mockRepository.DeleteSession).toHaveBeenCalledWith(session.sessionId);
			});
		});

		it('should emit session revoked events', async () => {
			const userId = 'user-123';
			const sessionIds = [uuidv4(), uuidv4()];
			const sessions = sessionIds.map(sessionId => ({
				sessionId,
				userId,
				isAuthenticated: true,
			}));

			mockRepository.FindUserSessions.mockResolvedValue(sessions);
			mockRepository.DeleteSession.mockResolvedValue(undefined);

			await service.InvalidateAllUserSessions(userId);

			expect(mockEventEmitter.EmitSessionEvent).toHaveBeenCalledTimes(2);
			sessions.forEach(session => {
				expect(mockEventEmitter.EmitSessionEvent).toHaveBeenCalledWith(
					session.sessionId,
					SessionEventType.SESSION_REVOKED,
					expect.any(Object),
				);
			});
		});

		it('should handle user with no sessions', async () => {
			mockRepository.FindUserSessions.mockResolvedValue([]);

			await service.InvalidateAllUserSessions('user-no-sessions');

			expect(mockRepository.DeleteSession).not.toHaveBeenCalled();
			expect(mockEventEmitter.EmitSessionEvent).not.toHaveBeenCalled();
		});
	});

	describe('RevokeSession', () => {
		it('should revoke a specific session', async () => {
			const sessionId = uuidv4();
			const session = {
				sessionId,
				userId: 'user-123',
				isAuthenticated: true,
			};

			mockRepository.FindBySessionId.mockResolvedValue(session);
			mockRepository.DeleteSession.mockResolvedValue(undefined);

			await service.RevokeSession(sessionId);

			expect(mockRepository.DeleteSession).toHaveBeenCalledWith(sessionId);
			expect(mockEventEmitter.EmitSessionEvent).toHaveBeenCalledWith(
				sessionId,
				SessionEventType.SESSION_REVOKED,
				expect.objectContaining({ reason: 'Session revoked by administrator' }),
			);
		});

		it('should throw error if session not found', async () => {
			mockRepository.FindBySessionId.mockResolvedValue(null);

			await expect(service.RevokeSession('invalid-id')).rejects.toThrow('Session not found');
		});

		it('should include user ID in revoke event', async () => {
			const sessionId = uuidv4();
			const userId = 'user-456';
			const session = {
				sessionId,
				userId,
				isAuthenticated: true,
			};

			mockRepository.FindBySessionId.mockResolvedValue(session);
			mockRepository.DeleteSession.mockResolvedValue(undefined);

			await service.RevokeSession(sessionId);

			expect(mockEventEmitter.EmitSessionEvent).toHaveBeenCalledWith(
				sessionId,
				SessionEventType.SESSION_REVOKED,
				expect.objectContaining({ userId }),
			);
		});
	});

	describe('UpdateSessionPreferences', () => {
		it('should update session preferences', async () => {
			const sessionId = uuidv4();
			const session = {
				sessionId,
				userId: 'user-123',
				isAuthenticated: true,
			};

			const preferences = { theme: 'dark', language: 'en' };
			const updatedSession = {
				...session,
				preferences: new Map(Object.entries(preferences)),
				lastActivityAt: expect.any(Date),
			};

			mockRepository.FindBySessionId.mockResolvedValue(session);
			mockRepository.Update.mockResolvedValue(updatedSession);

			const result = await service.UpdateSessionPreferences(sessionId, preferences);

			expect(mockRepository.Update).toHaveBeenCalledWith(
				sessionId,
				expect.objectContaining({
					preferences: expect.any(Object),
				}),
			);
			expect(result.preferences).toEqual(new Map(Object.entries(preferences)));
		});

		it('should throw error if session not found', async () => {
			mockRepository.FindBySessionId.mockResolvedValue(null);

			await expect(
				service.UpdateSessionPreferences('invalid-id', { theme: 'dark' }),
			).rejects.toThrow('Session not found');
		});

		it('should throw error if update fails', async () => {
			const sessionId = uuidv4();
			const session = { sessionId, userId: 'user-123' };

			mockRepository.FindBySessionId.mockResolvedValue(session);
			mockRepository.Update.mockResolvedValue(null);

			await expect(
				service.UpdateSessionPreferences(sessionId, { theme: 'dark' }),
			).rejects.toThrow('Failed to update preferences');
		});

		it('should update last activity when preferences change', async () => {
			const sessionId = uuidv4();
			const session = { sessionId };

			const beforeUpdate = Date.now();
			mockRepository.FindBySessionId.mockResolvedValue(session);
			mockRepository.Update.mockResolvedValue(session);

			await service.UpdateSessionPreferences(sessionId, { theme: 'dark' });

			const afterUpdate = Date.now();
			const [[, callArgs]] = mockRepository.Update.mock.calls;
			const lastActivityTime = (callArgs as any).lastActivityAt.getTime();

			expect(lastActivityTime).toBeGreaterThanOrEqual(beforeUpdate);
			expect(lastActivityTime).toBeLessThanOrEqual(afterUpdate);
		});
	});

	describe('SetMaxConcurrentSessions', () => {
		it('should set max concurrent sessions for user', async () => {
			const userId = 'user-123';
			const sessions = [
				{ sessionId: uuidv4(), userId },
				{ sessionId: uuidv4(), userId },
			];

			mockRepository.FindUserSessions.mockResolvedValue(sessions);
			mockRepository.Update.mockResolvedValue({});

			await service.SetMaxConcurrentSessions(userId, MAX_CONCURRENT_SESSIONS_TEST_VALUE);

			expect(mockRepository.Update).toHaveBeenCalledTimes(2);
			sessions.forEach(session => {
				expect(mockRepository.Update).toHaveBeenCalledWith(
					session.sessionId,
					expect.objectContaining({ maxConcurrentSessions: MAX_CONCURRENT_SESSIONS_TEST_VALUE }),
				);
			});
		});

		it('should clear max concurrent sessions when passed null', async () => {
			const userId = 'user-123';
			const sessions = [{ sessionId: uuidv4(), userId }];

			mockRepository.FindUserSessions.mockResolvedValue(sessions);
			mockRepository.Update.mockResolvedValue({});

			await service.SetMaxConcurrentSessions(userId, null);

			expect(mockRepository.Update).toHaveBeenCalledWith(
				sessions[0].sessionId,
				expect.objectContaining({ maxConcurrentSessions: undefined }),
			);
		});

		it('should handle user with no sessions', async () => {
			mockRepository.FindUserSessions.mockResolvedValue([]);

			await service.SetMaxConcurrentSessions('user-no-sessions', MAX_CONCURRENT_SESSIONS_LIMIT);

			expect(mockRepository.Update).not.toHaveBeenCalled();
		});
	});

	describe('AuthenticateSession - concurrent session enforcement', () => {
		it('should enforce max concurrent sessions limit', async () => {
			const sessionId = uuidv4();
			const userId = 'user-123';
			const userProfile: IUserProfile = {
				id: userId,
				email: 'test@example.com',
				name: 'Test User',
				roles: ['user'],
				permissions: ['read:streams'],
			};

			const existingSessions = [
				{ sessionId: uuidv4(), userId, createdAt: new Date(Date.now() - TEN_SECONDS_AGO_MS) },
				{ sessionId: uuidv4(), userId, createdAt: new Date(Date.now() - FIVE_SECONDS_AGO_MS) },
			];

			mockRepository.FindBySessionId.mockResolvedValue({ loginHistory: [] });
			mockRepository.FindActiveSessions.mockResolvedValue(existingSessions);
			mockRepository.DeleteSession.mockResolvedValue(undefined);
			mockRepository.Update.mockResolvedValue({ isAuthenticated: true });

			const testService = createService(mockRepository, mockEventEmitter, {
				sessionTtlMinutes: SESSION_TTL_MINUTES,
				inactivityTimeoutMinutes: INACTIVITY_TIMEOUT_MINUTES,
				defaultMaxConcurrentSessions: DEFAULT_MAX_CONCURRENT_SESSIONS,
				enforceSessionLimit: true,
			});

			await testService.AuthenticateSession(
				sessionId,
				userProfile,
				'access-token',
				'refresh-token',
				new Date(Date.now() + SESSION_TTL_MS),
				new Date(Date.now() + USER_SESSION_TTL_MS),
				{ userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
			);

			// Should have deleted the oldest session
			expect(mockRepository.DeleteSession).toHaveBeenCalledWith(existingSessions[0].sessionId);
		});

		it('should not enforce limit when enforceSessionLimit is false', async () => {
			const sessionId = uuidv4();
			const userProfile: IUserProfile = {
				id: 'user-123',
				email: 'test@example.com',
				name: 'Test User',
				roles: ['user'],
				permissions: [],
			};

			mockRepository.FindBySessionId.mockResolvedValue({ loginHistory: [] });
			mockRepository.Update.mockResolvedValue({ isAuthenticated: true });

			const testService = createService(mockRepository, mockEventEmitter, {
				sessionTtlMinutes: SESSION_TTL_MINUTES,
				inactivityTimeoutMinutes: INACTIVITY_TIMEOUT_MINUTES,
				defaultMaxConcurrentSessions: DEFAULT_MAX_CONCURRENT_SESSIONS,
				enforceSessionLimit: false,
			});

			await testService.AuthenticateSession(
				sessionId,
				userProfile,
				'access-token',
				'refresh-token',
				new Date(Date.now() + SESSION_TTL_MS),
				new Date(Date.now() + USER_SESSION_TTL_MS),
				{ userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
			);

			// Should not call FindActiveSessions
			expect(mockRepository.FindActiveSessions).not.toHaveBeenCalled();
		});
	});

	describe('AuthenticateSession - error handling', () => {
		it('should throw error if session not found', async () => {
			mockRepository.FindBySessionId.mockResolvedValue(null);

			await expect(
				service.AuthenticateSession(
					'invalid-id',
					{ id: 'user', email: 'test@test.com', name: 'Test', roles: [], permissions: [] },
					'token',
					'refresh',
					new Date(),
					new Date(),
					{ userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' },
				),
			).rejects.toThrow('Session not found');
		});

		it('should throw error if update fails', async () => {
			const sessionId = uuidv4();
			mockRepository.FindBySessionId.mockResolvedValue({ loginHistory: [] });
			mockRepository.Update.mockResolvedValue(null);

			await expect(
				service.AuthenticateSession(
					sessionId,
					{ id: 'user', email: 'test@test.com', name: 'Test', roles: [], permissions: [] },
					'token',
					'refresh',
					new Date(),
					new Date(),
					{ userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' },
				),
			).rejects.toThrow('Failed to authenticate session');
		});
	});

	describe('CreateOrGetSession - edge cases', () => {
		it('should set correct expiration time based on config', async () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla',
				ipAddress: '127.0.0.1',
			};

			const testService = createService(mockRepository, mockEventEmitter, {
				sessionTtlMinutes: SHORT_SESSION_TTL_MINUTES,
				inactivityTimeoutMinutes: REFRESH_TIMEOUT_MINUTES,
				enforceSessionLimit: false,
			});

			const beforeCreate = Date.now();
			mockRepository.Create.mockResolvedValue({
				sessionId: uuidv4(),
				createdAt: new Date(),
				expiresAt: expect.any(Date),
				deviceInfo,
			});

			await testService.CreateOrGetSession(deviceInfo);

			const afterCreate = Date.now();
			const [[callArgs]] = mockRepository.Create.mock.calls;
			const expiryTime = (callArgs as any).expiresAt.getTime();
			const expectedMinExpiry = beforeCreate + ONE_HOUR_MS;
			const expectedMaxExpiry = afterCreate + ONE_HOUR_MS;

			expect(expiryTime).toBeGreaterThanOrEqual(expectedMinExpiry - TIME_ASSERTION_TOLERANCE_MS);
			expect(expiryTime).toBeLessThanOrEqual(expectedMaxExpiry + TIME_ASSERTION_TOLERANCE_MS);
		});
	});

	describe('GetSession - error cases', () => {
		it('should throw NotFoundException when session not found', async () => {
			mockRepository.FindBySessionId.mockResolvedValue(null);

			await expect(service.GetSession('nonexistent')).rejects.toThrow('Session not found');
			expect(mockRepository.FindBySessionId).toHaveBeenCalledWith('nonexistent');
		});
	});
});
