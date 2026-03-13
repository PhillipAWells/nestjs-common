import { vi, describe, it, expect, beforeEach } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { AppLogger, AuditLoggerService, CACHE_PROVIDER } from '@pawells/nestjs-shared/common';
import { AuthService } from '../auth.service.js';
import { User, JWTPayload } from '../auth.types.js';
import type { IUserRepository } from '../interfaces/user-repository.interface.js';
import { USER_REPOSITORY } from '../tokens.js';
import { TokenBlacklistService } from '../token-blacklist.service.js';

describe('AuthService', () => {
	let service: AuthService;
	let mockJwtService: any;
	let mockCacheService: any;
	let mockRepository: any;
	let mockAuditLogger: any;
	let mockModuleRef: any;

	const mockUser: User = {
		id: 'user_123',
		email: 'test@example.com',
		role: 'user',
		firstName: 'Test',
		lastName: 'User',
		isActive: true,
	};

	beforeEach(() => {
		mockJwtService = {
			sign: vi.fn(),
			verify: vi.fn(),
			decode: vi.fn(),
		};

		mockCacheService = {
			exists: vi.fn(),
			set: vi.fn(),
		};

		const mockAppLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			}),
		};

		mockRepository = {
			findByEmail: vi.fn(),
			findById: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		};

		mockAuditLogger = {
			logAuthenticationAttempt: vi.fn(),
			logTokenGeneration: vi.fn(),
			logTokenRevocation: vi.fn(),
			logSessionCreated: vi.fn(),
			logSessionTerminated: vi.fn(),
		};

		const mockTokenBlacklistService = new TokenBlacklistService({
			get: (token: any) => {
				if (token === AppLogger) return mockAppLogger;
				if (token === CACHE_PROVIDER) return mockCacheService;
				return null;
			},
		} as any);

		mockModuleRef = {
			get: (token: any, _opts?: any) => {
				if (token === USER_REPOSITORY) return mockRepository;
				if (token === JwtService) return mockJwtService;
				if (token === AppLogger) return mockAppLogger;
				if (token === AuditLoggerService) return mockAuditLogger;
				if (token === TokenBlacklistService) return mockTokenBlacklistService;
				if (token === CACHE_PROVIDER) return mockCacheService;
				return null;
			},
		};

		service = new AuthService(mockModuleRef);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('decodeToken', () => {
		it('should decode valid token', () => {
			const mockPayload: JWTPayload = {
				sub: 'user_123',
				email: 'test@example.com',
				role: 'user',
				exp: Math.floor(Date.now() / 1000) + 900,
			};

			mockJwtService.decode.mockReturnValue(mockPayload);

			const result = service.decodeToken('valid.token');
			expect(result).toEqual(mockPayload);
			expect(mockJwtService.decode).toHaveBeenCalledWith('valid.token');
		});

		it('should return null for invalid token', () => {
			mockJwtService.decode.mockImplementation(() => {
				throw new Error('Invalid token');
			});

			const result = service.decodeToken('invalid.token');
			expect(result).toBeNull();
		});
	});

	describe('refreshToken', () => {
		const mockRefreshToken = 'refresh.token';
		const mockPayload: JWTPayload = {
			sub: 'user_123',
			email: 'test@example.com',
			role: 'user',
			exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
		};

		const userLookupFn = vi.fn<(userId: string) => Promise<User | null>>();

		beforeEach(() => {
			mockJwtService.verify.mockReturnValue(mockPayload);
			mockJwtService.sign.mockReturnValue('new.access.token');
			mockCacheService.exists.mockResolvedValue(false);
			userLookupFn.mockResolvedValue(mockUser);
		});

		it('should refresh token successfully', async () => {
			const result = await service.refreshToken(mockRefreshToken, userLookupFn);

			expect(result).toEqual({
				accessToken: 'new.access.token',
				expiresIn: 900,
				tokenType: 'Bearer',
			});

			expect(mockJwtService.verify).toHaveBeenCalledWith(mockRefreshToken);
			expect(userLookupFn).toHaveBeenCalledWith('user_123');
			expect(mockCacheService.exists).toHaveBeenCalledWith(`blacklist:${mockRefreshToken}`);
			expect(mockCacheService.set).toHaveBeenCalledWith(
				`blacklist:${mockRefreshToken}`,
				true,
				expect.any(Number),
			);
			expect(mockJwtService.sign).toHaveBeenCalledWith({
				email: 'test@example.com',
				sub: 'user_123',
				role: 'user',
				type: 'access',
				iss: 'nestjs-app',
				aud: 'nestjs-api',
			}, {
				expiresIn: '15m',
				algorithm: 'HS256',
			});
		});

		it('should reject expired refresh token', async () => {
			mockJwtService.verify.mockImplementation(() => {
				throw new Error('Token expired');
			});

			await expect(service.refreshToken(mockRefreshToken, userLookupFn))
				.rejects.toThrow('Invalid refresh token');
		});

		it('should reject blacklisted refresh token', async () => {
			mockCacheService.exists.mockResolvedValue(true);

			await expect(service.refreshToken(mockRefreshToken, userLookupFn))
				.rejects.toThrow('Refresh token has been revoked');
		});

		it('should reject when user not found', async () => {
			userLookupFn.mockResolvedValue(null);

			await expect(service.refreshToken(mockRefreshToken, userLookupFn))
				.rejects.toThrow('Invalid refresh token');
		});

		it('should reject when user is inactive', async () => {
			userLookupFn.mockResolvedValue({ ...mockUser, isActive: false });

			await expect(service.refreshToken(mockRefreshToken, userLookupFn))
				.rejects.toThrow('Invalid refresh token');
		});
	});

	describe('validateUser', () => {
		it('should validate active user with correct password', async () => {
			const bcrypt = await import('bcryptjs');
			const passwordHash = await bcrypt.hash('password123', 10);
			const userWithHash = {
				...mockUser,
				passwordHash,
			};

			const result = await service.validateUser(userWithHash, 'password123');
			expect(result).toEqual({
				id: 'user_123',
				email: 'test@example.com',
				role: 'user',
				firstName: 'Test',
				lastName: 'User',
				isActive: true,
			});
		});

		it('should reject inactive user', async () => {
			const inactiveUser = { ...mockUser, isActive: false };
			const result = await service.validateUser(inactiveUser, 'password123');
			expect(result).toBeNull();
		});

		it('should reject user without password hash', async () => {
			const userWithoutHash = { ...mockUser };
			const result = await service.validateUser(userWithoutHash, 'password123');
			expect(result).toBeNull();
		});

		it('should reject incorrect password', async () => {
			const bcrypt = await import('bcryptjs');
			const passwordHash = await bcrypt.hash('password123', 10);
			const userWithHash = {
				...mockUser,
				passwordHash,
			};

			const result = await service.validateUser(userWithHash, 'wrongpassword');
			expect(result).toBeNull();
		});

		it('should return actual validated user, not hardcoded test user', async () => {
			const bcrypt = await import('bcryptjs');
			const passwordHash = await bcrypt.hash('password123', 10);
			const mockUserDifferent: User & { passwordHash: string } = {
				id: 'user_456',
				email: 'real@example.com',
				role: 'admin',
				firstName: 'Real',
				lastName: 'User',
				isActive: true,
				passwordHash,
			};

			const result = await service.validateUser(mockUserDifferent, 'password123');

			expect(result).not.toBeNull();
			expect(result?.id).toBe('user_456');
			expect(result?.email).toBe('real@example.com');
			expect(result?.firstName).toBe('Real');
			expect(result?.role).toBe('admin');
		});
	});

	describe('login', () => {
		it('should generate tokens for valid user', async () => {
			const mockAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
			const mockRefreshToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

			mockJwtService.sign
				.mockReturnValueOnce(mockAccessToken)
				.mockReturnValueOnce(mockRefreshToken);
			mockJwtService.decode
				.mockReturnValueOnce({ exp: Math.floor(Date.now() / 1000) + 900, iat: Math.floor(Date.now() / 1000) })
				.mockReturnValueOnce({ exp: Math.floor(Date.now() / 1000) + 259200, iat: Math.floor(Date.now() / 1000) });

			const result = await service.login(mockUser);

			expect(result).toEqual({
				accessToken: mockAccessToken,
				refreshToken: mockRefreshToken,
				expiresIn: 900,
				tokenType: 'Bearer',
				user: {
					id: 'user_123',
					email: 'test@example.com',
					role: 'user',
					firstName: 'Test',
					lastName: 'User',
				},
			});

			expect(mockJwtService.sign).toHaveBeenCalledWith({
				email: 'test@example.com',
				sub: 'user_123',
				role: 'user',
				type: 'access',
				iss: 'nestjs-app',
				aud: 'nestjs-api',
			}, {
				expiresIn: '15m',
				algorithm: 'HS256',
			});
			expect(mockJwtService.sign).toHaveBeenCalledWith(
				{
					email: 'test@example.com',
					sub: 'user_123',
					role: 'user',
					type: 'refresh',
					iss: 'nestjs-app',
					aud: 'nestjs-api',
				},
				{
					expiresIn: '3d',
					algorithm: 'HS256',
				},
			);
		});
	});

	describe('AuthService with UserRepository', () => {
		let localRepository: IUserRepository;
		let localAuditLogger: any;

		beforeEach(() => {
			localRepository = {
				findByEmail: vi.fn(),
				findById: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
				delete: vi.fn(),
			};

			localAuditLogger = {
				logAuthenticationAttempt: vi.fn(),
				logTokenGeneration: vi.fn(),
				logTokenRevocation: vi.fn(),
				logSessionCreated: vi.fn(),
				logSessionTerminated: vi.fn(),
			};

			const localJwtService = {
				sign: vi.fn(),
				verify: vi.fn(),
				decode: vi.fn(),
			};

			const mockAppLogger = {
				createContextualLogger: vi.fn().mockReturnValue({
					debug: vi.fn(),
					info: vi.fn(),
					warn: vi.fn(),
					error: vi.fn(),
				}),
			};

			const localTokenBlacklistService = new TokenBlacklistService({
				get: (token: any) => {
					if (token === AppLogger) return mockAppLogger;
					if (token === CACHE_PROVIDER) return null;
					return null;
				},
			} as any);

			const localModuleRef = {
				get: (token: any, _opts?: any) => {
					if (token === USER_REPOSITORY) return localRepository;
					if (token === JwtService) return localJwtService;
					if (token === AppLogger) return mockAppLogger;
					if (token === AuditLoggerService) return localAuditLogger;
					if (token === TokenBlacklistService) return localTokenBlacklistService;
					if (token === CACHE_PROVIDER) return null;
					return null;
				},
			};

			service = new AuthService(localModuleRef as any);
			mockJwtService = localJwtService;
		});

		describe('validateOAuthUser', () => {
			it('should create new user when not found', async () => {
				(localRepository.findByEmail as any).mockResolvedValue(null);
				(localRepository.create as any).mockResolvedValue({
					id: 'new_user_123',
					email: 'new@example.com',
					isActive: true,
					displayName: 'New User',
					role: 'user',
				});

				const profile = {
					emails: [{ value: 'new@example.com' }],
					displayName: 'New User',
				};

				const result = await service.validateOAuthUser(profile, 'access', 'refresh');

				expect(localRepository.findByEmail).toHaveBeenCalledWith('new@example.com');
				expect(localRepository.create).toHaveBeenCalled();
				expect(result.id).toBe('new_user_123');
				expect(result.email).toBe('new@example.com');
			});

			it('should update existing user when found', async () => {
				const existingUser = {
					id: 'existing_123',
					email: 'existing@example.com',
					isActive: true,
					role: 'user',
				};

				(localRepository.findByEmail as any).mockResolvedValue(existingUser);
				(localRepository.update as any).mockResolvedValue({
					...existingUser,
					oauthProfile: { id: 'oauth_123' },
					updatedAt: new Date(),
				});

				const profile = {
					id: 'oauth_123',
					emails: [{ value: 'existing@example.com' }],
					displayName: 'Existing User',
				};

				const result = await service.validateOAuthUser(profile, 'access', 'refresh');

				expect(localRepository.findByEmail).toHaveBeenCalledWith('existing@example.com');
				expect(localRepository.update).toHaveBeenCalledWith(
					'existing_123',
					expect.objectContaining({
						oauthProfile: profile,
					}),
				);
				expect(result.id).toBe('existing_123');
			});
		});
	});
});
