import { describe, it, expect } from 'vitest';
import { CreateMockKeycloakUser } from '../keycloak.types.js';

describe('createMockKeycloakUser()', () => {
	it('returns default values when called with no arguments', () => {
		const user = CreateMockKeycloakUser();
		expect(user.id).toBe('test-user-id');
		expect(user.email).toBe('test@example.com');
		expect(user.username).toBe('test-user');
		expect(user.name).toBe('Test IUser');
		expect(user.realmRoles).toEqual([]);
		expect(user.clientRoles).toEqual([]);
	});

	it('merges overrides with defaults', () => {
		const user = CreateMockKeycloakUser({ id: 'custom-id', realmRoles: ['admin'] });
		expect(user.id).toBe('custom-id');
		expect(user.realmRoles).toEqual(['admin']);
		expect(user.email).toBe('test@example.com'); // default preserved
	});

	it('returns a new object each call', () => {
		const a = CreateMockKeycloakUser();
		const b = CreateMockKeycloakUser();
		expect(a).not.toBe(b);
	});

	it('arrays in overrides replace defaults', () => {
		const user = CreateMockKeycloakUser({ clientRoles: ['read', 'write'] });
		expect(user.clientRoles).toEqual(['read', 'write']);
	});

	it('can produce a user with no email', () => {
		const user = CreateMockKeycloakUser({ email: undefined });
		expect(user.email).toBeUndefined();
	});
});
