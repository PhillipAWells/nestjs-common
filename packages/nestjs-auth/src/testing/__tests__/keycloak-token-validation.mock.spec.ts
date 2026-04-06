import { describe, it, expect, beforeEach } from 'vitest';
import { MockKeycloakTokenValidationService } from '../mocks/keycloak-token-validation.mock.js';

describe('MockKeycloakTokenValidationService', () => {
	let service: MockKeycloakTokenValidationService;

	beforeEach(() => {
		service = new MockKeycloakTokenValidationService();
	});

	describe('validateToken()', () => {
		it('returns valid result by default', async () => {
			const result = await service.ValidateToken('any-token');
			expect(result.valid).toBe(true);
			expect(result.claims).toBeDefined();
		});

		it('returns overridden result after setValidateTokenResult()', async () => {
			service.SetValidateTokenResult({ valid: false, error: 'token_inactive' });
			const result = await service.ValidateToken('any-token');
			expect(result.valid).toBe(false);
			expect(result.error).toBe('token_inactive');
		});

		it('ignores the token argument', async () => {
			const a = await service.ValidateToken('token-a');
			const b = await service.ValidateToken('token-b');
			expect(a).toEqual(b);
		});
	});

	describe('extractUser()', () => {
		it('returns default user', () => {
			const user = service.ExtractUser({} as any);
			expect(user.id).toBe('test-user-id');
			expect(user.realmRoles).toEqual([]);
			expect(user.clientRoles).toEqual([]);
		});

		it('returns overridden user after setExtractUserResult()', () => {
			service.SetExtractUserResult({
				id: 'admin-id',
				realmRoles: ['admin'],
				clientRoles: ['read'],
			});
			const user = service.ExtractUser({} as any);
			expect(user.id).toBe('admin-id');
			expect(user.realmRoles).toEqual(['admin']);
		});
	});

	describe('reset()', () => {
		it('restores defaults after overrides', async () => {
			service.SetValidateTokenResult({ valid: false, error: 'token_inactive' });
			service.SetExtractUserResult({ id: 'other', realmRoles: [], clientRoles: [] });
			service.Reset();

			const result = await service.ValidateToken('any-token');
			expect(result.valid).toBe(true);

			const user = service.ExtractUser({} as any);
			expect(user.id).toBe('test-user-id');
		});
	});
});
