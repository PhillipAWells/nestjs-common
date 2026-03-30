import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { KeycloakTokenValidationService } from '../keycloak-token-validation.service.js';
import { KEYCLOAK_MODULE_OPTIONS } from '../../keycloak.constants.js';
import { JwksCacheService } from '../jwks-cache.service.js';
import type { IKeycloakModuleOptions, IKeycloakTokenClaims } from '../../keycloak.types.js';

describe('KeycloakTokenValidationService', () => {
	let service: KeycloakTokenValidationService;
	let mockJwtService: Partial<JwtService>;
	let mockJwksCacheService: Partial<JwksCacheService>;
	let options: IKeycloakModuleOptions;

	const createTestClaims = (): IKeycloakTokenClaims => ({
		sub: 'user-123',
		email: 'user@example.com',
		preferred_username: 'john_doe',
		name: 'John Doe',
		aud: ['my-client'],
		iss: 'http://keycloak:8080/realms/myrealm',
		exp: Math.floor(Date.now() / 1000) + 3600,
		iat: Math.floor(Date.now() / 1000),
		realm_access: { roles: ['user', 'admin'] },
		resource_access: {
			'my-client': {
				roles: ['view', 'edit'],
			},
		},
	});

	beforeEach(async () => {
		mockJwtService = {
			decode: vi.fn(),
			verify: vi.fn(),
		};

		mockJwksCacheService = {
			getKey: vi.fn(),
		};

		options = {
			authServerUrl: 'http://keycloak:8080',
			realm: 'myrealm',
			clientId: 'my-client',
			clientSecret: 'secret',
			validationMode: 'online',
		};

		const module = await Test.createTestingModule({
			providers: [
				KeycloakTokenValidationService,
				{
					provide: JwtService,
					useValue: mockJwtService,
				},
				{
					provide: KEYCLOAK_MODULE_OPTIONS,
					useValue: options,
				},
				{
					provide: JwksCacheService,
					useValue: mockJwksCacheService,
				},
			],
		}).compile();

		service = module.get(KeycloakTokenValidationService);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('validateToken - Online mode', () => {
		beforeEach(() => {
			options.validationMode = 'online';
		});

		it('should return valid result when token is active with matching audience', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					active: true,
					aud: ['my-client'],
					sub: 'user-123',
				}),
			};

			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const result = await service.validateToken('valid.token.here');

			expect(result.valid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should return invalid result when token is inactive', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					active: false,
				}),
			};

			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const result = await service.validateToken('invalid.token');

			expect(result.valid).toBe(false);
			expect(result.error).toBe('token_inactive');
		});

		it('should return invalid result when audience does not match', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({
					active: true,
					aud: ['other-client'],
				}),
			};

			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const result = await service.validateToken('token.with.wrong.audience');

			expect(result.valid).toBe(false);
			expect(result.error).toBe('invalid_audience');
		});

		it('should return invalid result when introspection endpoint fails', async () => {
			const mockResponse = {
				ok: false,
				status: 500,
			};

			global.fetch = vi.fn().mockResolvedValue(mockResponse);

			const result = await service.validateToken('token');

			expect(result.valid).toBe(false);
			expect(result.error).toBe('introspection_failed');
		});
	});

	describe('validateToken - Offline mode', () => {
		let offlineService: KeycloakTokenValidationService;

		beforeEach(() => {
			const offlineOptions: IKeycloakModuleOptions = {
				authServerUrl: 'http://keycloak:8080',
				realm: 'myrealm',
				clientId: 'my-client',
				clientSecret: 'secret',
				validationMode: 'offline',
				issuer: 'http://keycloak:8080/realms/myrealm',
			};

			offlineService = new KeycloakTokenValidationService(
				offlineOptions,
				mockJwtService as JwtService,
				mockJwksCacheService as JwksCacheService,
			);
		});

		it('should return valid result for valid JWT with correct issuer and audience', async () => {
			const claims = createTestClaims();
			const token = 'valid.jwt.token';

			(mockJwtService.decode as Mock).mockReturnValue({
				header: { kid: 'key-123' },
				payload: claims,
			});

			(mockJwksCacheService.getKey as Mock).mockResolvedValue('-----BEGIN PUBLIC KEY-----...');

			(mockJwtService.verify as Mock).mockReturnValue(claims);

			const result = await offlineService.validateToken(token);

			expect(result.valid).toBe(true);
			expect(result.claims).toEqual(claims);
		});

		it('should return invalid result when token is expired', async () => {
			const expiredClaims = createTestClaims();
			expiredClaims.exp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

			const token = 'expired.jwt.token';

			(mockJwtService.decode as Mock).mockReturnValue({
				header: { kid: 'key-123' },
				payload: expiredClaims,
			});

			(mockJwksCacheService.getKey as Mock).mockResolvedValue('-----BEGIN PUBLIC KEY-----...');

			(mockJwtService.verify as Mock).mockReturnValue(expiredClaims);

			const result = await offlineService.validateToken(token);

			expect(result.valid).toBe(false);
			expect(result.error).toBe('token_expired');
		});

		it('should return invalid result when issuer does not match', async () => {
			const badClaims = createTestClaims();
			badClaims.iss = 'http://other-server/realms/otherrealm';

			const token = 'jwt.with.bad.issuer';

			(mockJwtService.decode as Mock).mockReturnValue({
				header: { kid: 'key-123' },
				payload: badClaims,
			});

			(mockJwksCacheService.getKey as Mock).mockResolvedValue('-----BEGIN PUBLIC KEY-----...');

			(mockJwtService.verify as Mock).mockReturnValue(badClaims);

			const result = await offlineService.validateToken(token);

			expect(result.valid).toBe(false);
			expect(result.error).toBe('invalid_issuer');
		});

		it('should return invalid result when audience does not match', async () => {
			const badClaims = createTestClaims();
			badClaims.aud = ['other-client'];

			const token = 'jwt.with.bad.aud';

			(mockJwtService.decode as Mock).mockReturnValue({
				header: { kid: 'key-123' },
				payload: badClaims,
			});

			(mockJwksCacheService.getKey as Mock).mockResolvedValue('-----BEGIN PUBLIC KEY-----...');

			(mockJwtService.verify as Mock).mockReturnValue(badClaims);

			const result = await offlineService.validateToken(token);

			expect(result.valid).toBe(false);
			expect(result.error).toBe('invalid_audience');
		});

		it('should return invalid result when JWT verification fails', async () => {
			const token = 'invalid.jwt.token';

			(mockJwtService.decode as Mock).mockReturnValue({
				header: { kid: 'key-123' },
				payload: createTestClaims(),
			});

			(mockJwksCacheService.getKey as Mock).mockResolvedValue('-----BEGIN PUBLIC KEY-----...');

			(mockJwtService.verify as Mock).mockImplementation(() => {
				throw new Error('Invalid signature');
			});

			const result = await offlineService.validateToken(token);

			expect(result.valid).toBe(false);
			expect(result.error).toBe('jwt_verification_failed');
		});

		it('should return invalid result when kid is missing from token header', async () => {
			const token = 'jwt.without.kid';

			(mockJwtService.decode as Mock).mockReturnValue({
				header: {},
				payload: createTestClaims(),
			});

			const result = await offlineService.validateToken(token);

			expect(result.valid).toBe(false);
			expect(result.error).toBe('missing_kid');
		});
	});

	describe('extractUser', () => {
		it('should extract user from token claims', () => {
			const claims = createTestClaims();

			const user = service.extractUser(claims);

			expect(user.id).toBe('user-123');
			expect(user.email).toBe('user@example.com');
			expect(user.username).toBe('john_doe');
			expect(user.name).toBe('John Doe');
			expect(user.realmRoles).toEqual(['user', 'admin']);
			expect(user.clientRoles).toEqual(['view', 'edit']);
		});

		it('should handle missing realm roles', () => {
			const claims = createTestClaims();
			claims.realm_access = undefined;

			const user = service.extractUser(claims);

			expect(user.realmRoles).toEqual([]);
		});

		it('should handle missing client roles', () => {
			const claims = createTestClaims();
			claims.resource_access = undefined;

			const user = service.extractUser(claims);

			expect(user.clientRoles).toEqual([]);
		});
	});
});
