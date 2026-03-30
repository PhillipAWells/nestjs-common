import { describe, it, expect, beforeEach, vi } from 'vitest';
import type KcAdminClient from '@keycloak/keycloak-admin-client';
import { FederatedIdentityService } from '../federated-identity.service.js';
import { ConflictError } from '../../errors/index.js';
import { KeycloakAdminScopeError } from '../../../permissions/keycloak-admin.permissions.js';
import type { TKeycloakAdminScope } from '../../../permissions/keycloak-admin.permissions.js';

describe('FederatedIdentityService', () => {
	let service: FederatedIdentityService;
	let mockAdminClient: any;
	let allScopes: Set<TKeycloakAdminScope>;
	let readOnlyScopes: Set<TKeycloakAdminScope>;
	let writeOnlyScopes: Set<TKeycloakAdminScope>;
	let noScopes: Set<TKeycloakAdminScope>;

	beforeEach(() => {
		mockAdminClient = {
			users: {
				listFederatedIdentities: vi.fn(),
				addToFederatedIdentity: vi.fn(),
				delFromFederatedIdentity: vi.fn(),
				find: vi.fn(),
			},
		} as unknown as KcAdminClient;

		allScopes = new Set([
			'federated-identity:read',
			'federated-identity:write',
		] as TKeycloakAdminScope[]);
		readOnlyScopes = new Set(['federated-identity:read'] as TKeycloakAdminScope[]);
		writeOnlyScopes = new Set(['federated-identity:write'] as TKeycloakAdminScope[]);
		noScopes = new Set([] as TKeycloakAdminScope[]);
	});

	describe('list', () => {
		it('throws KeycloakAdminScopeError when federated-identity:read scope is not granted', async () => {
			service = new FederatedIdentityService(mockAdminClient, noScopes);
			await expect(service.list('user-id')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.listFederatedIdentities).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.listFederatedIdentities when scope is granted', async () => {
			mockAdminClient.users.listFederatedIdentities.mockResolvedValue([
				{ identityProvider: 'github', userId: 'octocat', userName: 'octocat' },
			]);
			service = new FederatedIdentityService(mockAdminClient, readOnlyScopes);
			const result = await service.list('user-id');
			expect(result).toEqual([
				{ identityProvider: 'github', userId: 'octocat', userName: 'octocat' },
			]);
			expect(mockAdminClient.users.listFederatedIdentities).toHaveBeenCalledWith({
				id: 'user-id',
			});
		});

		it('returns empty array when no federated identities found', async () => {
			mockAdminClient.users.listFederatedIdentities.mockResolvedValue([]);
			service = new FederatedIdentityService(mockAdminClient, readOnlyScopes);
			const result = await service.list('user-id');
			expect(result).toEqual([]);
		});
	});

	describe('unlink', () => {
		it('throws KeycloakAdminScopeError when federated-identity:write scope is not granted', async () => {
			service = new FederatedIdentityService(mockAdminClient, readOnlyScopes);
			await expect(service.unlink('user-id', 'github')).rejects.toThrow(
				KeycloakAdminScopeError,
			);
			expect(mockAdminClient.users.delFromFederatedIdentity).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.delFromFederatedIdentity when scope is granted', async () => {
			mockAdminClient.users.delFromFederatedIdentity.mockResolvedValue(undefined);
			service = new FederatedIdentityService(mockAdminClient, allScopes);
			await service.unlink('user-id', 'github');
			expect(mockAdminClient.users.delFromFederatedIdentity).toHaveBeenCalledWith({
				id: 'user-id',
				federatedIdentityId: 'github',
			});
		});
	});

	describe('link', () => {
		it('throws KeycloakAdminScopeError when federated-identity:write scope is not granted', async () => {
			service = new FederatedIdentityService(mockAdminClient, readOnlyScopes);
			await expect(
				service.link('user-id', 'github', { userId: 'octocat', userName: 'octocat' }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.addToFederatedIdentity).not.toHaveBeenCalled();
		});

		it('throws KeycloakAdminScopeError when federated-identity:read scope is not granted (needed for internal list check)', async () => {
			service = new FederatedIdentityService(mockAdminClient, writeOnlyScopes);
			await expect(
				service.link('user-id', 'github', { userId: 'octocat', userName: 'octocat' }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.addToFederatedIdentity).not.toHaveBeenCalled();
		});

		it('links identity when both scopes are granted and no conflict exists', async () => {
			mockAdminClient.users.listFederatedIdentities.mockResolvedValue([]);
			mockAdminClient.users.addToFederatedIdentity.mockResolvedValue(undefined);
			service = new FederatedIdentityService(mockAdminClient, allScopes);
			await service.link('user-id', 'github', { userId: 'octocat', userName: 'octocat' });
			expect(mockAdminClient.users.addToFederatedIdentity).toHaveBeenCalledWith({
				id: 'user-id',
				federatedIdentityId: 'github',
				federatedIdentity: {
					identityProvider: 'github',
					userId: 'octocat',
					userName: 'octocat',
				},
			});
		});

		it('throws ConflictError when link with same provider and userId already exists', async () => {
			mockAdminClient.users.listFederatedIdentities.mockResolvedValue([
				{ identityProvider: 'github', userId: 'octocat', userName: 'octocat' },
			]);
			service = new FederatedIdentityService(mockAdminClient, allScopes);
			await expect(
				service.link('user-id', 'github', { userId: 'octocat', userName: 'octocat' }),
			).rejects.toThrow(ConflictError);
			expect(mockAdminClient.users.addToFederatedIdentity).not.toHaveBeenCalled();
		});

		it('allows linking different provider even if one already exists', async () => {
			mockAdminClient.users.listFederatedIdentities.mockResolvedValue([
				{ identityProvider: 'github', userId: 'octocat', userName: 'octocat' },
			]);
			mockAdminClient.users.addToFederatedIdentity.mockResolvedValue(undefined);
			service = new FederatedIdentityService(mockAdminClient, allScopes);
			await service.link('user-id', 'google', { userId: 'user@example.com', userName: 'user' });
			expect(mockAdminClient.users.addToFederatedIdentity).toHaveBeenCalled();
		});

		it('allows linking different userId with same provider', async () => {
			mockAdminClient.users.listFederatedIdentities.mockResolvedValue([
				{ identityProvider: 'github', userId: 'octocat', userName: 'octocat' },
			]);
			mockAdminClient.users.addToFederatedIdentity.mockResolvedValue(undefined);
			service = new FederatedIdentityService(mockAdminClient, allScopes);
			await service.link('user-id', 'github', { userId: 'other-user', userName: 'other' });
			expect(mockAdminClient.users.addToFederatedIdentity).toHaveBeenCalled();
		});

		it('includes error details in ConflictError message', async () => {
			mockAdminClient.users.listFederatedIdentities.mockResolvedValue([
				{ identityProvider: 'github', userId: 'octocat', userName: 'octocat' },
			]);
			service = new FederatedIdentityService(mockAdminClient, allScopes);
			try {
				await service.link('user-id', 'github', { userId: 'octocat', userName: 'octocat' });
				expect.fail('Should have thrown ConflictError');
			} catch (error) {
				expect(error).toBeInstanceOf(ConflictError);
				expect((error as ConflictError).message).toContain('github');
				expect((error as ConflictError).message).toContain('octocat');
			}
		});
	});
});
