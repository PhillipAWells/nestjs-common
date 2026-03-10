import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SessionResolver } from '../session.resolver.js';
import { SessionService } from '../session.service.js';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException } from '@nestjs/common';
import { Redis } from 'ioredis';

describe('SessionResolver', () => {
	let resolver: SessionResolver;
	let mockSessionService: jest.Mocked<SessionService>;
	let mockRedisClient: jest.Mocked<Redis>;
	let mockLogger: jest.Mocked<AppLogger>;

	beforeEach(async () => {
		mockSessionService = {
			CreateOrGetSession: jest.fn(),
			GetSession: jest.fn(),
			AuthenticateSession: jest.fn(),
			LogoutSession: jest.fn(),
			RefreshSessionToken: jest.fn(),
			UpdateSessionPreferences: jest.fn(),
			InvalidateAllUserSessions: jest.fn(),
			RevokeSession: jest.fn(),
			GetUserSessions: jest.fn(),
			UpdateLastActivity: jest.fn(),
			SetMaxConcurrentSessions: jest.fn(),
		} as any;

		mockRedisClient = {
			duplicate: jest.fn(),
		} as any;

		mockLogger = {
			warn: jest.fn(),
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SessionResolver,
				{ provide: SessionService, useValue: mockSessionService },
				{ provide: 'REDIS_CLIENT', useValue: mockRedisClient },
				{ provide: AppLogger, useValue: mockLogger },
			],
		}).compile();

		resolver = module.get<SessionResolver>(SessionResolver);
	});

	describe('Session_Current', () => {
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

			mockSessionService.GetSession.mockResolvedValue(mockSession as any);

			const result = await resolver.Session_Current({ sessionId } as any);

			expect(mockSessionService.GetSession).toHaveBeenCalledWith(sessionId);
			expect(result).toEqual(mockSession);
		});

		it('should throw BadRequestException when sessionId is not provided', async () => {
			await expect(resolver.Session_Current({} as any)).rejects.toThrow(BadRequestException);
		});
	});

	describe('Session_UserSessions', () => {
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

			mockSessionService.GetUserSessions.mockResolvedValue(mockSessions as any);

			const result = await resolver.Session_UserSessions({} as any, userId);

			expect(mockSessionService.GetUserSessions).toHaveBeenCalledWith(userId);
			expect(result).toEqual(mockSessions);
		});
	});

	describe('Session_Logout', () => {
		it('should logout and return true', async () => {
			const sessionId = uuidv4();
			mockSessionService.LogoutSession.mockResolvedValue(undefined);

			const result = await resolver.Session_Logout({ sessionId } as any);

			expect(mockSessionService.LogoutSession).toHaveBeenCalledWith(sessionId);
			expect(result).toBe(true);
		});

		it('should throw BadRequestException when sessionId is not provided', async () => {
			await expect(resolver.Session_Logout({} as any)).rejects.toThrow(BadRequestException);
		});
	});

	describe('Session_RefreshToken', () => {
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

			mockSessionService.GetSession.mockResolvedValue(mockSession as any);

			await expect(resolver.Session_RefreshToken({ sessionId } as any)).rejects.toThrow(
				BadRequestException,
			);
		});

		it('should throw BadRequestException when sessionId is not provided', async () => {
			await expect(resolver.Session_RefreshToken({} as any)).rejects.toThrow(BadRequestException);
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

			mockSessionService.GetSession.mockResolvedValue(mockSession as any);

			await expect(resolver.Session_RefreshToken({ sessionId } as any)).rejects.toThrow(
				BadRequestException,
			);
		});
	});

	describe('Session_UpdatePreferences', () => {
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

			mockSessionService.UpdateSessionPreferences.mockResolvedValue(mockSession as any);

			const result = await resolver.Session_UpdatePreferences(
				{ sessionId } as any,
				{ preferences },
			);

			expect(mockSessionService.UpdateSessionPreferences).toHaveBeenCalledWith(sessionId, preferences);
			expect(result).toEqual(mockSession);
		});

		it('should throw BadRequestException when sessionId is not provided', async () => {
			await expect(
				resolver.Session_UpdatePreferences({} as any, { preferences: {} }),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('Session_InvalidateAllSessions', () => {
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

			mockSessionService.GetSession.mockResolvedValue(mockSession as any);
			mockSessionService.InvalidateAllUserSessions.mockResolvedValue(undefined);

			const result = await resolver.Session_InvalidateAllSessions({ sessionId } as any);

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

			mockSessionService.GetSession.mockResolvedValue(mockSession as any);

			await expect(resolver.Session_InvalidateAllSessions({ sessionId } as any)).rejects.toThrow(
				BadRequestException,
			);
		});
	});

	describe('Session_RevokeSession', () => {
		it('should revoke session', async () => {
			const sessionId = uuidv4();
			mockSessionService.RevokeSession.mockResolvedValue(undefined);

			const result = await resolver.Session_RevokeSession({} as any, sessionId);

			expect(mockSessionService.RevokeSession).toHaveBeenCalledWith(sessionId);
			expect(result).toBe(true);
		});
	});

	describe('Session_SetMaxConcurrentSessions', () => {
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

			mockSessionService.GetSession.mockResolvedValue(mockSession as any);
			mockSessionService.SetMaxConcurrentSessions.mockResolvedValue(undefined);

			const result = await resolver.Session_SetMaxConcurrentSessions(
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

			mockSessionService.GetSession.mockResolvedValue(mockSession as any);
			mockSessionService.SetMaxConcurrentSessions.mockResolvedValue(undefined);

			const result = await resolver.Session_SetMaxConcurrentSessions({ sessionId } as any, null);

			expect(mockSessionService.SetMaxConcurrentSessions).toHaveBeenCalledWith(userId, null);
			expect(result).toBe(true);
		});
	});
});
