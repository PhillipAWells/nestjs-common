import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionResolver } from '../session.resolver.js';
import { SessionService } from '../session.service.js';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';
import type { Redis } from 'ioredis';

describe('SessionResolver', () => {
	let resolver: SessionResolver;
	let mockSessionService: any;
	let mockRedisClient: any;
	let mockLogger: any;

	beforeEach(() => {
		mockSessionService = {
			CreateOrGetSession: vi.fn(),
			GetSession: vi.fn(),
			AuthenticateSession: vi.fn(),
			LogoutSession: vi.fn(),
			RefreshSessionToken: vi.fn(),
			UpdateSessionPreferences: vi.fn(),
			InvalidateAllUserSessions: vi.fn(),
			RevokeSession: vi.fn(),
			GetUserSessions: vi.fn(),
			UpdateLastActivity: vi.fn(),
			SetMaxConcurrentSessions: vi.fn(),
		} as unknown as SessionService;

		mockRedisClient = {
			duplicate: vi.fn(),
		} as unknown as Redis;

		mockLogger = {
			warn: vi.fn(),
		} as unknown as AppLogger;

		resolver = new SessionResolver(mockSessionService, mockRedisClient, mockLogger);
	});

	describe('getCurrentSession', () => {
		it('should return current session', async () => {
			const sessionId = uuidv4();
			const mockSession = {
				sessionId,
				isAuthenticated: false,
				deviceInfo: { userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
				createdAt: new Date(),
				lastActivityAt: new Date(),
				expiresAt: new Date(),
				loginHistory: [],
			};

			mockSessionService.GetSession.mockResolvedValue(mockSession);

			const result = await resolver.getCurrentSession({ sessionId } as any);

			expect(mockSessionService.GetSession).toHaveBeenCalledWith(sessionId);
			expect(result).toEqual(mockSession);
		});

		it('should return null when sessionId is not provided', async () => {
			const result = await resolver.getCurrentSession({} as any);
			expect(result).toBeNull();
		});
	});

	describe('getUserSessions', () => {
		it('should return user sessions', async () => {
			const userId = 'user-123';
			const mockSessions = [
				{
					sessionId: uuidv4(),
					userId,
					isAuthenticated: true,
					deviceInfo: { userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
					createdAt: new Date(),
					lastActivityAt: new Date(),
					expiresAt: new Date(),
					loginHistory: [],
				},
			];

			mockSessionService.GetUserSessions.mockResolvedValue(mockSessions);

			const result = await resolver.getUserSessions({} as any, userId);

			expect(mockSessionService.GetUserSessions).toHaveBeenCalledWith(userId);
			expect(result).toEqual(mockSessions);
		});
	});

	describe('logout', () => {
		it('should logout and return true', async () => {
			const sessionId = uuidv4();
			mockSessionService.LogoutSession.mockResolvedValue(undefined);

			const result = await resolver.logout({ sessionId } as any);

			expect(mockSessionService.LogoutSession).toHaveBeenCalledWith(sessionId);
			expect(result).toBe(true);
		});

		it('should throw BadRequestException when sessionId is not provided', async () => {
			await expect(resolver.logout({} as any)).rejects.toThrow(BadRequestException);
		});
	});

	describe('refreshToken', () => {
		it('should throw BadRequestException when not yet implemented', async () => {
			const sessionId = uuidv4();
			const mockSession = {
				sessionId,
				isAuthenticated: true,
				userId: 'user-123',
				accessToken: 'new-token',
				refreshToken: 'new-refresh-token',
				deviceInfo: { userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
				createdAt: new Date(),
				lastActivityAt: new Date(),
				expiresAt: new Date(),
				loginHistory: [],
			};

			mockSessionService.GetSession.mockResolvedValue(mockSession);

			await expect(resolver.refreshToken({ sessionId } as any)).rejects.toThrow(
				BadRequestException,
			);
		});

		it('should throw BadRequestException when sessionId is not provided', async () => {
			await expect(resolver.refreshToken({} as any)).rejects.toThrow(BadRequestException);
		});

		it('should throw BadRequestException when no refresh token available', async () => {
			const sessionId = uuidv4();
			const mockSession = {
				sessionId,
				isAuthenticated: true,
				userId: 'user-123',
				accessToken: 'token',
				// no refreshToken
				deviceInfo: { userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
				createdAt: new Date(),
				lastActivityAt: new Date(),
				expiresAt: new Date(),
				loginHistory: [],
			};

			mockSessionService.GetSession.mockResolvedValue(mockSession);

			await expect(resolver.refreshToken({ sessionId } as any)).rejects.toThrow(
				BadRequestException,
			);
		});
	});

	describe('updatePreferences', () => {
		it('should update session preferences', async () => {
			const sessionId = uuidv4();
			const preferences = { theme: 'dark', language: 'en' };
			const mockSession = {
				sessionId,
				isAuthenticated: true,
				deviceInfo: { userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
				preferences,
				createdAt: new Date(),
				lastActivityAt: new Date(),
				expiresAt: new Date(),
				loginHistory: [],
			};

			mockSessionService.UpdateSessionPreferences.mockResolvedValue(mockSession);

			const result = await resolver.updatePreferences(
				{ sessionId } as any,
				{ preferences },
			);

			expect(mockSessionService.UpdateSessionPreferences).toHaveBeenCalledWith(sessionId, preferences);
			expect(result).toEqual(mockSession);
		});

		it('should throw BadRequestException when sessionId is not provided', async () => {
			await expect(
				resolver.updatePreferences({} as any, { preferences: {} }),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('invalidateAllSessions', () => {
		it('should invalidate all user sessions', async () => {
			const sessionId = uuidv4();
			const userId = 'user-123';
			const mockSession = {
				sessionId,
				userId,
				isAuthenticated: true,
				deviceInfo: { userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
				createdAt: new Date(),
				lastActivityAt: new Date(),
				expiresAt: new Date(),
				loginHistory: [],
			};

			mockSessionService.GetSession.mockResolvedValue(mockSession);
			mockSessionService.InvalidateAllUserSessions.mockResolvedValue(undefined);

			const result = await resolver.invalidateAllSessions({ sessionId } as any);

			expect(mockSessionService.GetSession).toHaveBeenCalledWith(sessionId);
			expect(mockSessionService.InvalidateAllUserSessions).toHaveBeenCalledWith(userId);
			expect(result).toBe(true);
		});

		it('should throw BadRequestException when user not authenticated', async () => {
			const sessionId = uuidv4();
			const mockSession = {
				sessionId,
				isAuthenticated: false,
				deviceInfo: { userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
				createdAt: new Date(),
				lastActivityAt: new Date(),
				expiresAt: new Date(),
				loginHistory: [],
			};

			mockSessionService.GetSession.mockResolvedValue(mockSession);

			await expect(resolver.invalidateAllSessions({ sessionId } as any)).rejects.toThrow(
				BadRequestException,
			);
		});
	});

	describe('revokeSession', () => {
		it('should revoke session', async () => {
			const sessionId = uuidv4();
			mockSessionService.RevokeSession.mockResolvedValue(undefined);

			const result = await resolver.revokeSession({} as any, sessionId);

			expect(mockSessionService.RevokeSession).toHaveBeenCalledWith(sessionId);
			expect(result).toBe(true);
		});
	});

	describe('setMaxConcurrentSessions', () => {
		it('should set max concurrent sessions', async () => {
			const sessionId = uuidv4();
			const userId = 'user-123';
			const maxSessions = 5;
			const mockSession = {
				sessionId,
				userId,
				isAuthenticated: true,
				maxConcurrentSessions: maxSessions,
				deviceInfo: { userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
				createdAt: new Date(),
				lastActivityAt: new Date(),
				expiresAt: new Date(),
				loginHistory: [],
			};

			mockSessionService.GetSession.mockResolvedValue(mockSession);
			mockSessionService.SetMaxConcurrentSessions.mockResolvedValue(undefined);

			const result = await resolver.setMaxConcurrentSessions(
				{ sessionId } as any,
				maxSessions,
			);

			expect(mockSessionService.GetSession).toHaveBeenCalledWith(sessionId);
			expect(mockSessionService.SetMaxConcurrentSessions).toHaveBeenCalledWith(userId, maxSessions);
			expect(result).toBe(true);
		});

		it('should reset max concurrent sessions when null', async () => {
			const sessionId = uuidv4();
			const userId = 'user-123';
			const mockSession = {
				sessionId,
				userId,
				isAuthenticated: true,
				deviceInfo: { userAgent: 'Mozilla', ipAddress: '127.0.0.1' },
				createdAt: new Date(),
				lastActivityAt: new Date(),
				expiresAt: new Date(),
				loginHistory: [],
			};

			mockSessionService.GetSession.mockResolvedValue(mockSession);
			mockSessionService.SetMaxConcurrentSessions.mockResolvedValue(undefined);

			const result = await resolver.setMaxConcurrentSessions({ sessionId } as any, null);

			expect(mockSessionService.SetMaxConcurrentSessions).toHaveBeenCalledWith(userId, null);
			expect(result).toBe(true);
		});
	});
});
