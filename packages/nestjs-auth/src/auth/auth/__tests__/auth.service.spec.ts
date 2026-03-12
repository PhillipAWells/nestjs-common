import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { CacheService } from '@pawells/nestjs-graphql';
import { AppLogger, AuditLoggerService } from '@pawells/nestjs-shared/common';
import { AuthService } from '../auth.service.js';
import { User, JWTPayload } from '../auth.types.js';
import type { IUserRepository } from '../interfaces/user-repository.interface.js';
import { USER_REPOSITORY } from '../tokens.js';
import { jest } from '@jest/globals';

describe('AuthService', () => {
	let service: AuthService;
	let jwtService: jest.Mocked<JwtService>;
	let cacheService: jest.Mocked<CacheService>;

	const mockUser: User = {
		id: 'user_123',
		email: 'test@example.com',
		role: 'user',
		firstName: 'Test',
		lastName: 'User',
		isActive: true,
	};

	beforeEach(async () => {
		const mockJwtService = {
			sign: jest.fn(),
			verify: jest.fn(),
			decode: jest.fn(),
		};

		const mockCacheService = {
			exists: jest.fn(),
			set: jest.fn(),
		};

		const mockAppLogger = {
			createContextualLogger: jest.fn().mockReturnValue({
				debug: jest.fn(),
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
			}),
		};

		// Create a mock repository
		const mockRepository = {
			findByEmail: jest.fn(),
			findById: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		};

		const mockAuditLogger = {
			logAuthenticationAttempt: jest.fn(),
			logTokenGeneration: jest.fn(),
			logTokenRevocation: jest.fn(),
			logSessionCreated: jest.fn(),
			logSessionTerminated: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{
					provide: USER_REPOSITORY,
					useValue: mockRepository,
				},
				{
					provide: JwtService,
					useValue: mockJwtService,
				},
				{
					provide: CacheService,
					useValue: mockCacheService,
				},
				{
					provide: AppLogger,
					useValue: mockAppLogger,
				},
				{
					provide: AuditLoggerService,
					useValue: mockAuditLogger,
				},
			],
		}).compile();

		service = module.get<AuthService>(AuthService);
		jwtService = module.get(JwtService);
		cacheService = module.get(CacheService);
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

			jwtService.decode.mockReturnValue(mockPayload);

			const result = service.decodeToken('valid.token');
			expect(result).toEqual(mockPayload);
			expect(jwtService.decode).toHaveBeenCalledWith('valid.token');
		});

		it('should return null for invalid token', () => {
			jwtService.decode.mockImplementation(() => {
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

		const userLookupFn = jest.fn<(userId: string) => Promise<User | null>>();

		beforeEach(() => {
			jwtService.verify.mockReturnValue(mockPayload);
			jwtService.sign.mockReturnValue('new.access.token');
			cacheService.exists.mockResolvedValue(false);
			userLookupFn.mockResolvedValue(mockUser);
		});

		it('should refresh token successfully', async () => {
			const result = await service.refreshToken(mockRefreshToken, userLookupFn);

			expect(result).toEqual({
				accessToken: 'new.access.token',
				expiresIn: 900,
				tokenType: 'Bearer',
			});

			expect(jwtService.verify).toHaveBeenCalledWith(mockRefreshToken);
			expect(userLookupFn).toHaveBeenCalledWith('user_123');
			expect(cacheService.exists).toHaveBeenCalledWith(`blacklist:${mockRefreshToken}`);
			expect(cacheService.set).toHaveBeenCalledWith(
				`blacklist:${mockRefreshToken}`,
				true,
				expect.any(Number),
			);
			expect(jwtService.sign).toHaveBeenCalledWith({
				email: 'test@example.com',
				sub: 'user_123',
				role: 'user',
			}, {
				expiresIn: '15m',
				algorithm: 'HS256',
			});
		});

		it('should reject expired refresh token', async () => {
			jwtService.verify.mockImplementation(() => {
				throw new Error('Token expired');
			});

			await expect(service.refreshToken(mockRefreshToken, userLookupFn))
				.rejects.toThrow('Invalid refresh token');
		});

		it('should reject blacklisted refresh token', async () => {
			cacheService.exists.mockResolvedValue(true);

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

			jwtService.sign
				.mockReturnValueOnce(mockAccessToken)
				.mockReturnValueOnce(mockRefreshToken);
			jwtService.decode
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

			expect(jwtService.sign).toHaveBeenCalledWith({
				email: 'test@example.com',
				sub: 'user_123',
				role: 'user',
			}, {
				expiresIn: '15m',
				algorithm: 'HS256',
			});
			expect(jwtService.sign).toHaveBeenCalledWith(
				{
					email: 'test@example.com',
					sub: 'user_123',
					role: 'user',
				},
				{
					expiresIn: '3d',
					algorithm: 'HS256',
				},
			);
		});
	});

	describe('AuthService with UserRepository', () => {
		let mockRepository: jest.Mocked<IUserRepository>;
		let mockAuditLogger: jest.Mocked<AuditLoggerService>;

		beforeEach(async () => {
			mockRepository = {
				findByEmail: jest.fn(),
				findById: jest.fn(),
				create: jest.fn(),
				update: jest.fn(),
				delete: jest.fn(),
			};

			mockAuditLogger = {
				logAuthenticationAttempt: jest.fn(),
				logTokenGeneration: jest.fn(),
				logTokenRevocation: jest.fn(),
				logSessionCreated: jest.fn(),
				logSessionTerminated: jest.fn(),
			} as any;

			const mockJwtService = {
				sign: jest.fn(),
				verify: jest.fn(),
				decode: jest.fn(),
			};

			const mockAppLogger = {
				createContextualLogger: jest.fn().mockReturnValue({
					debug: jest.fn(),
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
				}),
			};

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					AuthService,
					{
						provide: USER_REPOSITORY,
						useValue: mockRepository,
					},
					{
						provide: JwtService,
						useValue: mockJwtService,
					},
					{
						provide: AppLogger,
						useValue: mockAppLogger,
					},
					{
						provide: AuditLoggerService,
						useValue: mockAuditLogger,
					},
				],
			}).compile();

			service = module.get<AuthService>(AuthService);
			jwtService = module.get(JwtService);
		});

		describe('validateOAuthUser', () => {
			it('should create new user when not found', async () => {
				mockRepository.findByEmail.mockResolvedValue(null);
				mockRepository.create.mockResolvedValue({
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

				expect(mockRepository.findByEmail).toHaveBeenCalledWith('new@example.com');
				expect(mockRepository.create).toHaveBeenCalled();
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

				mockRepository.findByEmail.mockResolvedValue(existingUser);
				mockRepository.update.mockResolvedValue({
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

				expect(mockRepository.findByEmail).toHaveBeenCalledWith('existing@example.com');
				expect(mockRepository.update).toHaveBeenCalledWith(
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
