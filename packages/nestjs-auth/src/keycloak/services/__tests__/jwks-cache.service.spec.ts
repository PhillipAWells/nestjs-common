import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwksCacheService } from '../jwks-cache.service.js';
import { KEYCLOAK_MODULE_OPTIONS } from '../../keycloak.constants.js';
import type { KeycloakModuleOptions } from '../../keycloak.types.js';

describe('JwksCacheService', () => {
	let service: JwksCacheService;
	let options: KeycloakModuleOptions;

	const mockJwksResponse = {
		keys: [
			{
				kid: 'key-1',
				kty: 'RSA',
				use: 'sig',
				n: 'xGOr-H0A-6_BOXMq83kU00T...',
				e: 'AQAB',
			},
			{
				kid: 'key-2',
				kty: 'RSA',
				use: 'sig',
				n: 'yHPs-I1B-7_CPYNr84lV11T...',
				e: 'AQAB',
			},
		],
	};

	beforeEach(async () => {
		options = {
			authServerUrl: 'http://keycloak:8080',
			realm: 'myrealm',
			clientId: 'my-client',
			clientSecret: 'secret',
			validationMode: 'offline',
			jwksCacheTtlMs: 5000, // 5 seconds for testing
		};

		const module = await Test.createTestingModule({
			providers: [
				JwksCacheService,
				{
					provide: KEYCLOAK_MODULE_OPTIONS,
					useValue: options,
				},
			],
		}).compile();

		service = module.get(JwksCacheService);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('onModuleInit', () => {
		it('should fetch JWKS on module initialization in offline mode', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(mockJwksResponse),
			});

			await service.onModuleInit();

			expect(global.fetch).toHaveBeenCalledWith(
				'http://keycloak:8080/realms/myrealm/protocol/openid-connect/certs',
			);
		});

		it('should skip JWKS fetch in online mode', async () => {
			const onlineOptions = { ...options, validationMode: 'online' };
			const testModule = await Test.createTestingModule({
				providers: [
					JwksCacheService,
					{
						provide: KEYCLOAK_MODULE_OPTIONS,
						useValue: onlineOptions,
					},
				],
			}).compile();

			const onlineService = testModule.get(JwksCacheService);
			global.fetch = vi.fn();

			await onlineService.onModuleInit();

			expect(global.fetch).not.toHaveBeenCalled();
		});
	});

	describe('getKey', () => {
		beforeEach(async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(mockJwksResponse),
			});
			await service.onModuleInit();
		});

		it('should return cached key without making new network request', async () => {
			global.fetch = vi.fn(); // Reset fetch mock

			const key = await service.getKey('key-1');

			expect(key).toBeDefined();
			expect(key).toContain('BEGIN PUBLIC KEY');
			expect(global.fetch).not.toHaveBeenCalled();
		});

		it('should throw UnauthorizedException for unknown key ID', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(mockJwksResponse),
			});

			await expect(service.getKey('unknown-key')).rejects.toThrow(UnauthorizedException);
		});

		it('should fetch JWKS when cache expires', async () => {
			// Wait for cache to expire
			vi.useFakeTimers();
			vi.advanceTimersByTime(5100); // Advance past TTL

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(mockJwksResponse),
			});

			const key = await service.getKey('key-1');

			expect(key).toBeDefined();
			expect(global.fetch).toHaveBeenCalled();

			vi.useRealTimers();
		});
	});

	describe('Concurrent fetch handling', () => {
		it('should only make one HTTP request for concurrent getKey calls', async () => {
			const fetchMock = vi.fn().mockImplementation(() =>
				new Promise((resolve) => {
					setTimeout(() => {
						resolve({
							ok: true,
							json: vi.fn().mockResolvedValue(mockJwksResponse),
						});
					}, 100);
				}),
			);

			global.fetch = fetchMock;

			// Make concurrent calls before cache is populated
			const promises = [service.getKey('key-1'), service.getKey('key-2'), service.getKey('key-1')];

			await Promise.all(promises);

			// Should only fetch once despite three concurrent requests
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it('should all concurrent requests resolve to the same keys after fetch completes', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(mockJwksResponse),
			});

			// Start concurrent requests
			const [key1, key2] = await Promise.all([
				service.getKey('key-1'),
				service.getKey('key-2'),
			]);

			expect(key1).toBeDefined();
			expect(key2).toBeDefined();
			expect(key1).not.toBe(key2);
		});
	});

	describe('JWKS fetch error handling', () => {
		it('should throw error when JWKS endpoint returns error status', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
			});

			await expect(service.onModuleInit()).rejects.toThrow();
		});

		it('should throw error when JWKS response is invalid', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({
					keys: 'not-an-array',
				}),
			});

			await expect(service.onModuleInit()).rejects.toThrow();
		});
	});
});
