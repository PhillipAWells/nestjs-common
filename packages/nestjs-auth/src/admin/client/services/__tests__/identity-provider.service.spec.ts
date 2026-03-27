import { describe, it, expect, beforeEach, vi } from 'vitest';
import type KcAdminClient from '@keycloak/keycloak-admin-client';
import { IdentityProviderService } from '../identity-provider.service.js';
import { KeycloakAdminScopeError } from '../../../permissions/keycloak-admin.permissions.js';
import type { KeycloakAdminScope } from '../../../permissions/keycloak-admin.permissions.js';

describe('IdentityProviderService', () => {
	let service: IdentityProviderService;
	let mockAdminClient: any;
	let allScopes: Set<KeycloakAdminScope>;
	let readOnlyScopes: Set<KeycloakAdminScope>;
	let noScopes: Set<KeycloakAdminScope>;

	beforeEach(() => {
		mockAdminClient = {
			identityProviders: {
				find: vi.fn(),
				findOne: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
				del: vi.fn(),
			},
		} as unknown as KcAdminClient;

		allScopes = new Set([
			'identity-providers:read',
			'identity-providers:write',
		] as KeycloakAdminScope[]);
		readOnlyScopes = new Set(['identity-providers:read'] as KeycloakAdminScope[]);
		noScopes = new Set([] as KeycloakAdminScope[]);
	});

	describe('list', () => {
		it('throws KeycloakAdminScopeError when identity-providers:read scope is not granted', async () => {
			service = new IdentityProviderService(mockAdminClient, noScopes);
			await expect(service.list('realm')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.identityProviders.find).not.toHaveBeenCalled();
		});

		it('calls adminClient.identityProviders.find when identity-providers:read scope is granted', async () => {
			mockAdminClient.identityProviders.find.mockResolvedValue([
				{ alias: 'github', displayName: 'GitHub' },
			]);
			service = new IdentityProviderService(mockAdminClient, readOnlyScopes);
			const result = await service.list('realm');
			expect(result).toEqual([{ alias: 'github', displayName: 'GitHub' }]);
			expect(mockAdminClient.identityProviders.find).toHaveBeenCalledWith({ realm: 'realm' });
		});

		it('returns empty array when no identity providers found', async () => {
			mockAdminClient.identityProviders.find.mockResolvedValue([]);
			service = new IdentityProviderService(mockAdminClient, readOnlyScopes);
			const result = await service.list('realm');
			expect(result).toEqual([]);
		});
	});

	describe('get', () => {
		it('throws KeycloakAdminScopeError when identity-providers:read scope is not granted', async () => {
			service = new IdentityProviderService(mockAdminClient, noScopes);
			await expect(service.get('realm', 'github')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.identityProviders.findOne).not.toHaveBeenCalled();
		});

		it('calls adminClient.identityProviders.findOne when identity-providers:read scope is granted', async () => {
			mockAdminClient.identityProviders.findOne.mockResolvedValue({
				alias: 'github',
				displayName: 'GitHub',
			});
			service = new IdentityProviderService(mockAdminClient, readOnlyScopes);
			const result = await service.get('realm', 'github');
			expect(result).toEqual({ alias: 'github', displayName: 'GitHub' });
			expect(mockAdminClient.identityProviders.findOne).toHaveBeenCalledWith({
				realm: 'realm',
				alias: 'github',
			});
		});
	});

	describe('create', () => {
		it('throws KeycloakAdminScopeError when identity-providers:write scope is not granted', async () => {
			service = new IdentityProviderService(mockAdminClient, readOnlyScopes);
			await expect(
				service.create('realm', { alias: 'github', displayName: 'GitHub' }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.identityProviders.create).not.toHaveBeenCalled();
		});

		it('calls adminClient.identityProviders.create when identity-providers:write scope is granted', async () => {
			mockAdminClient.identityProviders.create.mockResolvedValue(undefined);
			service = new IdentityProviderService(mockAdminClient, allScopes);
			const idp = { alias: 'github', displayName: 'GitHub' };
			await service.create('realm', idp);
			expect(mockAdminClient.identityProviders.create).toHaveBeenCalledWith({
				realm: 'realm',
				alias: 'github',
				displayName: 'GitHub',
			});
		});
	});

	describe('update', () => {
		it('throws KeycloakAdminScopeError when identity-providers:write scope is not granted', async () => {
			service = new IdentityProviderService(mockAdminClient, readOnlyScopes);
			await expect(
				service.update('realm', 'github', { displayName: 'GitHub Updated' }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.identityProviders.update).not.toHaveBeenCalled();
		});

		it('calls adminClient.identityProviders.update when identity-providers:write scope is granted', async () => {
			mockAdminClient.identityProviders.update.mockResolvedValue(undefined);
			service = new IdentityProviderService(mockAdminClient, allScopes);
			const idp = { displayName: 'GitHub Updated' };
			await service.update('realm', 'github', idp);
			expect(mockAdminClient.identityProviders.update).toHaveBeenCalledWith(
				{ realm: 'realm', alias: 'github' },
				idp,
			);
		});
	});

	describe('delete', () => {
		it('throws KeycloakAdminScopeError when identity-providers:write scope is not granted', async () => {
			service = new IdentityProviderService(mockAdminClient, readOnlyScopes);
			await expect(service.delete('realm', 'github')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.identityProviders.del).not.toHaveBeenCalled();
		});

		it('calls adminClient.identityProviders.del when identity-providers:write scope is granted', async () => {
			mockAdminClient.identityProviders.del.mockResolvedValue(undefined);
			service = new IdentityProviderService(mockAdminClient, allScopes);
			await service.delete('realm', 'github');
			expect(mockAdminClient.identityProviders.del).toHaveBeenCalledWith({
				realm: 'realm',
				alias: 'github',
			});
		});
	});
});
