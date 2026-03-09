import { NotFoundException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionService } from '../session.service.js';
import type { IDeviceInfo, IUserProfile } from '../session.types.js';
describe('Session Service - Session Lifecycle & Concurrent Limits', () => {
	let service: SessionService;
	let mockRepository: any;
	let mockEventEmitter: any;
	let mockModuleRef: any;
	let repositoryCalls: any[];
	let eventCalls: any[];
	beforeEach(() => {
		repositoryCalls = [];
		eventCalls = [];
		mockRepository = {
			Create: async (sessionData: any) => {
				repositoryCalls.push({ method: 'Create', data: sessionData });
				return {
					sessionId: sessionData.sessionId,
					isAuthenticated: false,
					deviceInfo: sessionData.deviceInfo,
					createdAt: sessionData.createdAt,
					lastActivityAt: sessionData.lastActivityAt,
					expiresAt: sessionData.expiresAt,
					loginHistory: [],
				};
			},
			FindBySessionId: async (sessionId: string) => {
				repositoryCalls.push({ method: 'FindBySessionId', sessionId });
				if (sessionId === 'valid-session-id') {
					return {
						sessionId: 'valid-session-id',
						isAuthenticated: false,
						deviceInfo: { userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' },
						createdAt: new Date(),
						lastActivityAt: new Date(),
						expiresAt: new Date(Date.now() + 86400000),
						loginHistory: [],
					};
				}
				return null;
			},
			FindActiveSessions: async (userId: string) => {
				repositoryCalls.push({ method: 'FindActiveSessions', userId });
				// Simulate user with 2 active sessions
				if (userId === 'user-with-sessions') {
					return [
						{
							sessionId: 'old-session-id',
							userId: 'user-with-sessions',
							isAuthenticated: true,
							createdAt: new Date(Date.now() - 3600000),
							expiresAt: new Date(Date.now() + 86400000),
						},
						{
							sessionId: 'newer-session-id',
							userId: 'user-with-sessions',
							isAuthenticated: true,
							createdAt: new Date(Date.now() - 1800000),
							expiresAt: new Date(Date.now() + 86400000),
						},
					];
				}
				return [];
			},
			Update: async (sessionId: string, updates: any) => {
				repositoryCalls.push({ method: 'Update', sessionId, updates });
				return {
					sessionId,
					...updates,
				};
			},
			DeleteSession: async (sessionId: string) => {
				repositoryCalls.push({ method: 'DeleteSession', sessionId });
				return true;
			},
		};
		mockEventEmitter = {
			EmitSessionEvent: (sessionId: string, eventType: string, data: any) => {
				eventCalls.push({ sessionId, eventType, data });
			},
		};
		mockModuleRef = {
			get: (token: any, defaultValue?: any) => {
				if (token === 'SESSION_CONFIG') {
					return {
						sessionTtlMinutes: 1440, // 24 hours
						enforceSessionLimit: false,
						defaultMaxConcurrentSessions: 5,
					};
				}
				if (token === 'SessionRepository') return mockRepository;
				if (token === 'SessionEventEmitter') return mockEventEmitter;
				return defaultValue ?? null;
			},
		};
		service = new SessionService(mockModuleRef);
	});
	describe('CreateOrGetSession() - Normal Operation', () => {
		it('should create new session with device info', async () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
				ipAddress: '192.168.1.1',
			};
			const session = await service.CreateOrGetSession(deviceInfo);
			expect(session).toBeDefined();
			expect(session.sessionId).toBeDefined();
			expect(session.isAuthenticated).toBe(false);
			expect(session.deviceInfo).toEqual(deviceInfo);
		});
		it('should set session TTL from configuration', async () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
			};
			const beforeCreate = Date.now();
			const session = await service.CreateOrGetSession(deviceInfo);
			const afterCreate = Date.now();
			expect(session.expiresAt).toBeDefined();
			expect(session.expiresAt.getTime()).toBeGreaterThan(beforeCreate);
		});
		it('should call repository.Create with proper session data', async () => {
			const deviceInfo: IDeviceInfo = { userAgent: 'Test Agent', browser: 'Test' };
			await service.CreateOrGetSession(deviceInfo);
			expect(repositoryCalls).toContainEqual(
				expect.objectContaining({
					method: 'Create',
				}),
			);
		});
		it('should initialize loginHistory as empty array', async () => {
			const deviceInfo: IDeviceInfo = { userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' };
			const session = await service.CreateOrGetSession(deviceInfo);
			expect(session.loginHistory).toEqual([]);
		});
	});
	describe('AuthenticateSession() - Normal Operation', () => {
		it('should authenticate session with user profile', async () => {
			const userProfile = {
				id: 'user-123',
				email: 'user@example.com',
				roles: ['user'], permissions: [],
			};
			const deviceInfo: IDeviceInfo = { userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' };
			const now = new Date();
			const session = await service.AuthenticateSession(
				'valid-session-id',
				userProfile,
				'access-token-xyz',
				'refresh-token-abc',
				new Date(now.getTime() + 900000), // 15 minutes
				new Date(now.getTime() + 259200000), // 3 days
				deviceInfo,
				'keycloak',
			);
			expect(session).toBeDefined();
			expect(session.userId).toBe('user-123');
			expect(session.isAuthenticated).toBe(true);
		});
		it('should add login record to loginHistory', async () => {
			const userProfile = { id: 'user-456', email: 'test@example.com', roles: ['user'], permissions: [] };
			const deviceInfo: IDeviceInfo = { userAgent: 'Safari', browser: 'Safari' };
			const session = await service.AuthenticateSession(
				'valid-session-id',
				userProfile,
				'access-token',
				'refresh-token',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 259200000),
				deviceInfo,
			);
			expect(session.loginHistory).toBeDefined();
			expect(session.loginHistory.length).toBeGreaterThan(0);
			expect(session.loginHistory[0]).toMatchObject({
				success: true,
				deviceInfo,
			});
		});
		it('should throw NotFoundException when session not found', async () => {
			const userProfile = { id: 'user-id', email: 'user@example.com', name: 'Test User', roles: ['user'], permissions: [] };
			const deviceInfo: IDeviceInfo = { userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' };
			await expect(
				service.AuthenticateSession(
					'non-existent-session-id',
					userProfile,
					'token',
					'refresh',
					new Date(Date.now() + 900000),
					new Date(Date.now() + 259200000),
					deviceInfo,
				),
			).rejects.toThrow(NotFoundException);
			await expect(
				service.AuthenticateSession(
					'non-existent-session-id',
					userProfile,
					'token',
					'refresh',
					new Date(Date.now() + 900000),
					new Date(Date.now() + 259200000),
					deviceInfo,
				),
			).rejects.toThrow('Session not found');
		});
	});
	describe('AuthenticateSession() - Concurrent Session Limits', () => {
		beforeEach(() => {
			// Enable session limit enforcement
			mockModuleRef.get = (token: any) => {
				if (token === 'SESSION_CONFIG') {
					return {
						sessionTtlMinutes: 1440,
						enforceSessionLimit: true,
						defaultMaxConcurrentSessions: 2, // Max 2 sessions per user
					};
				}
				if (token === 'SessionRepository') return mockRepository;
				if (token === 'SessionEventEmitter') return mockEventEmitter;
				return null;
			};
			service = new SessionService(mockModuleRef);
		});
		it('should enforce session limit when enabled', async () => {
			const userProfile = { id: 'user-with-sessions', email: 'user@example.com', roles: ['user'], permissions: [] };
			const deviceInfo: IDeviceInfo = { userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' };
			// User already has 2 active sessions (mocked above)
			// Creating a new session should delete the oldest one
			await service.AuthenticateSession(
				'valid-session-id',
				userProfile,
				'access-token',
				'refresh-token',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 259200000),
				deviceInfo,
			);
			// Should have called DeleteSession for the oldest session
			expect(repositoryCalls).toContainEqual(
				expect.objectContaining({
					method: 'DeleteSession',
					sessionId: 'old-session-id',
				}),
			);
		});
		it('should emit SESSION_REVOKED event when max sessions exceeded', async () => {
			const userProfile = { id: 'user-with-sessions', email: 'user@example.com', roles: ['user'], permissions: [] };
			const deviceInfo: IDeviceInfo = { userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' };
			await service.AuthenticateSession(
				'valid-session-id',
				userProfile,
				'access-token',
				'refresh-token',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 259200000),
				deviceInfo,
			);
			expect(eventCalls).toContainEqual(
				expect.objectContaining({
					sessionId: 'old-session-id',
					eventType: 'SESSION_REVOKED',
				}),
			);
		});
		it('should skip limit enforcement when enforceSessionLimit is false', async () => {
			mockModuleRef.get = (token: any, defaultValue?: any) => {
				if (token === 'SESSION_CONFIG') {
					return {
						sessionTtlMinutes: 1440,
						enforceSessionLimit: false, // Disabled
						defaultMaxConcurrentSessions: 1,
					};
				}
				if (token === 'SessionRepository') return mockRepository;
				if (token === 'SessionEventEmitter') return mockEventEmitter;
				return defaultValue ?? null;
			};
			service = new SessionService(mockModuleRef);
			const userProfile = { id: 'user-with-sessions', email: 'user@example.com', roles: ['user'], permissions: [] };
			const deviceInfo: IDeviceInfo = { userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' };
			await service.AuthenticateSession(
				'valid-session-id',
				userProfile,
				'access-token',
				'refresh-token',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 259200000),
				deviceInfo,
			);
			// Should not have called DeleteSession
			expect(repositoryCalls.filter(c => c.method === 'DeleteSession')).toHaveLength(0);
		});
		it('should identify oldest session by createdAt timestamp', async () => {
			// The mock returns sessions with different createdAt times
			// The oldest one should be deleted
			const userProfile = { id: 'user-with-sessions', email: 'user@example.com', roles: ['user'], permissions: [] };
			const deviceInfo: IDeviceInfo = { userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' };
			await service.AuthenticateSession(
				'valid-session-id',
				userProfile,
				'access-token',
				'refresh-token',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 259200000),
				deviceInfo,
			);
			const deleteCalls = repositoryCalls.filter(c => c.method === 'DeleteSession');
			expect(deleteCalls[0]?.sessionId).toBe('old-session-id');
		});
	});
	describe('AuthenticateSession() - Token Storage', () => {
		it('should store access and refresh tokens', async () => {
			const userProfile = { id: 'user-789', email: 'user@example.com', roles: ['user'], permissions: [] };
			const deviceInfo: IDeviceInfo = { userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' };
			const accessToken = 'my-access-token-value';
			const refreshToken = 'my-refresh-token-value';
			const session = await service.AuthenticateSession(
				'valid-session-id',
				userProfile,
				accessToken,
				refreshToken,
				new Date(Date.now() + 900000),
				new Date(Date.now() + 259200000),
				deviceInfo,
			);
			expect(session.accessToken).toBe('my-access-token-value');
			expect(session.refreshToken).toBe('my-refresh-token-value');
		});
		it('should store token expiration times', async () => {
			const userProfile = { id: 'user-id', email: 'user@example.com', name: 'Test User', roles: ['user'], permissions: [] };
			const deviceInfo: IDeviceInfo = { userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' };
			const accessExpiresAt = new Date(Date.now() + 900000);
			const refreshExpiresAt = new Date(Date.now() + 259200000);
			const session = await service.AuthenticateSession(
				'valid-session-id',
				userProfile,
				'access-token',
				'refresh-token',
				accessExpiresAt,
				refreshExpiresAt,
				deviceInfo,
			);
			expect(session.accessTokenExpiresAt).toEqual(accessExpiresAt);
			expect(session.refreshTokenExpiresAt).toEqual(refreshExpiresAt);
		});
	});
	describe('AuthenticateSession() - Provider Tracking', () => {
		it('should store provider in login history', async () => {
			const userProfile = { id: 'user-id', email: 'user@example.com', name: 'Test User', roles: ['user'], permissions: [] };
			const deviceInfo: IDeviceInfo = { userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' };
			const session = await service.AuthenticateSession(
				'valid-session-id',
				userProfile,
				'access-token',
				'refresh-token',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 259200000),
				deviceInfo,
				'google',
			);
			expect(session.loginHistory[0].provider).toBe('google');
		});
		it('should default to keycloak provider', async () => {
			const userProfile = { id: 'user-id', email: 'user@example.com', name: 'Test User', roles: ['user'], permissions: [] };
			const deviceInfo: IDeviceInfo = { userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' };
			const session = await service.AuthenticateSession(
				'valid-session-id',
				userProfile,
				'access-token',
				'refresh-token',
				new Date(Date.now() + 900000),
				new Date(Date.now() + 259200000),
				deviceInfo,
				// No provider specified
			);
			expect(session.loginHistory[0].provider).toBe('keycloak');
		});
	});
	describe('AuthenticateSession() - Error Cases', () => {
		it('should throw when repository.Update fails', async () => {
			const failureService = new SessionService(
			{
				get: (token: any, defaultValue?: any) => {
					if (token === 'SESSION_CONFIG') {

						return {
							sessionTtlMinutes: 1440,
							enforceSessionLimit: false,
							defaultMaxConcurrentSessions: 5,
						};
					}
					if (token === 'SessionRepository') {
						return {
							FindBySessionId: async () => ({
								sessionId: 'valid-session-id',
								isAuthenticated: false,
								deviceInfo: {},
								loginHistory: [],
							}),
							FindActiveSessions: async () => [],
							Update: async () => null, // Simulate update failure
						};
					}
					if (token === 'SessionEventEmitter') return mockEventEmitter;
					return defaultValue ?? null;
				},
			} as any);
			const userProfile = { id: 'user-id', email: 'user@example.com', name: 'Test User', roles: ['user'], permissions: [] };
			const deviceInfo: IDeviceInfo = { userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' };
			await expect(
				failureService.AuthenticateSession(
					'valid-session-id',
					userProfile,
					'token',
					'refresh',
					new Date(Date.now() + 900000),
					new Date(Date.now() + 259200000),
					deviceInfo,
				),
			).rejects.toThrow(NotFoundException);
		});
	});
});
