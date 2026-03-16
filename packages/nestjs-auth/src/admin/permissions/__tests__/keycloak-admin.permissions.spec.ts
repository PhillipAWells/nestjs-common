import { describe, it, expect } from 'vitest';
import {
	KeycloakAdminScopeError,
	KEYCLOAK_DEFAULT_SCOPES,
	KEYCLOAK_ALL_SCOPES,
} from '../keycloak-admin.permissions.js';

describe('KeycloakAdminScopeError', () => {
	it('should have the correct name', () => {
		const error = new KeycloakAdminScopeError('users:write');
		expect(error.name).toBe('KeycloakAdminScopeError');
	});

	it('should include the scope in the message', () => {
		const error = new KeycloakAdminScopeError('roles:write');
		expect(error.message).toContain('roles:write');
	});

	it('should hint at the config field in the message', () => {
		const error = new KeycloakAdminScopeError('users:write');
		expect(error.message).toContain('permissions');
		expect(error.message).toContain('KeycloakAdminModule.forRoot()');
	});

	it('should expose the scope property', () => {
		const error = new KeycloakAdminScopeError('federated-identity:write');
		expect(error.scope).toBe('federated-identity:write');
	});

	it('should be an instance of Error', () => {
		const error = new KeycloakAdminScopeError('users:write');
		expect(error).toBeInstanceOf(Error);
	});
});

describe('KEYCLOAK_DEFAULT_SCOPES', () => {
	it('should contain only read scopes', () => {
		for (const scope of KEYCLOAK_DEFAULT_SCOPES) {
			expect(scope.endsWith(':read')).toBe(true);
		}
	});

	it('should contain all nine read scopes', () => {
		expect(KEYCLOAK_DEFAULT_SCOPES).toContain('users:read');
		expect(KEYCLOAK_DEFAULT_SCOPES).toContain('roles:read');
		expect(KEYCLOAK_DEFAULT_SCOPES).toContain('groups:read');
		expect(KEYCLOAK_DEFAULT_SCOPES).toContain('federated-identity:read');
		expect(KEYCLOAK_DEFAULT_SCOPES).toContain('events:read');
		expect(KEYCLOAK_DEFAULT_SCOPES).toContain('clients:read');
		expect(KEYCLOAK_DEFAULT_SCOPES).toContain('realms:read');
		expect(KEYCLOAK_DEFAULT_SCOPES).toContain('identity-providers:read');
		expect(KEYCLOAK_DEFAULT_SCOPES).toContain('authentication:read');
	});

	it('should be frozen', () => {
		expect(Object.isFrozen(KEYCLOAK_DEFAULT_SCOPES)).toBe(true);
	});
});

describe('KEYCLOAK_ALL_SCOPES', () => {
	it('should be a superset of KEYCLOAK_DEFAULT_SCOPES', () => {
		for (const scope of KEYCLOAK_DEFAULT_SCOPES) {
			expect(KEYCLOAK_ALL_SCOPES).toContain(scope);
		}
	});

	it('should contain all write scopes', () => {
		expect(KEYCLOAK_ALL_SCOPES).toContain('users:write');
		expect(KEYCLOAK_ALL_SCOPES).toContain('roles:write');
		expect(KEYCLOAK_ALL_SCOPES).toContain('groups:write');
		expect(KEYCLOAK_ALL_SCOPES).toContain('federated-identity:write');
		expect(KEYCLOAK_ALL_SCOPES).toContain('clients:write');
		expect(KEYCLOAK_ALL_SCOPES).toContain('realms:write');
		expect(KEYCLOAK_ALL_SCOPES).toContain('identity-providers:write');
		expect(KEYCLOAK_ALL_SCOPES).toContain('authentication:write');
	});

	it('should be frozen', () => {
		expect(Object.isFrozen(KEYCLOAK_ALL_SCOPES)).toBe(true);
	});

	it('should have more entries than KEYCLOAK_DEFAULT_SCOPES', () => {
		expect(KEYCLOAK_ALL_SCOPES.length).toBeGreaterThan(KEYCLOAK_DEFAULT_SCOPES.length);
	});
});
