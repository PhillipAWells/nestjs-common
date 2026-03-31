import { describe, it, expect, beforeEach, vi } from 'vitest';
import type KcAdminClient from '@keycloak/keycloak-admin-client';
import { UserService } from '../user.service.js';
import { KeycloakAdminScopeError } from '../../../permissions/keycloak-admin.permissions.js';
import type { TKeycloakAdminScope } from '../../../permissions/keycloak-admin.permissions.js';

describe('UserService', () => {
	let service: UserService;
	let mockAdminClient: any;
	let allScopes: Set<TKeycloakAdminScope>;
	let readOnlyScopes: Set<TKeycloakAdminScope>;
	let noScopes: Set<TKeycloakAdminScope>;

	beforeEach(() => {
		mockAdminClient = {
			users: {
				find: vi.fn(),
				findOne: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
				del: vi.fn(),
				resetPassword: vi.fn(),
				addRealmRoleMappings: vi.fn(),
				delRealmRoleMappings: vi.fn(),
				listRealmRoleMappings: vi.fn(),
				addClientRoleMappings: vi.fn(),
				delClientRoleMappings: vi.fn(),
				listClientRoleMappings: vi.fn(),
			},
		} as unknown as KcAdminClient;

		allScopes = new Set(['users:read', 'users:write'] as TKeycloakAdminScope[]);
		readOnlyScopes = new Set(['users:read'] as TKeycloakAdminScope[]);
		noScopes = new Set([] as TKeycloakAdminScope[]);
	});

	describe('list', () => {
		it('throws KeycloakAdminScopeError when users:read scope is not granted', async () => {
			service = new UserService(mockAdminClient, noScopes);
			await expect(service.List('realm')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.find).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.find when users:read scope is granted', async () => {
			mockAdminClient.users.find.mockResolvedValue([{ id: 'user1' }]);
			service = new UserService(mockAdminClient, readOnlyScopes);
			const result = await service.List('realm');
			expect(result).toEqual([{ id: 'user1' }]);
			expect(mockAdminClient.users.find).toHaveBeenCalledWith({ realm: 'realm' });
		});

		it('returns empty array when no users found', async () => {
			mockAdminClient.users.find.mockResolvedValue([]);
			service = new UserService(mockAdminClient, readOnlyScopes);
			const result = await service.List('realm');
			expect(result).toEqual([]);
		});

		it('passes query parameters to adminClient', async () => {
			mockAdminClient.users.find.mockResolvedValue([]);
			service = new UserService(mockAdminClient, readOnlyScopes);
			await service.List('realm', { max: 10, first: 5 });
			expect(mockAdminClient.users.find).toHaveBeenCalledWith({
				realm: 'realm',
				max: 10,
				first: 5,
			});
		});
	});

	describe('get', () => {
		it('throws KeycloakAdminScopeError when users:read scope is not granted', async () => {
			service = new UserService(mockAdminClient, noScopes);
			await expect(service.Get('realm', 'user-id')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.findOne).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.findOne when users:read scope is granted', async () => {
			mockAdminClient.users.findOne.mockResolvedValue({ id: 'user-id' });
			service = new UserService(mockAdminClient, readOnlyScopes);
			const result = await service.Get('realm', 'user-id');
			expect(result).toEqual({ id: 'user-id' });
			expect(mockAdminClient.users.findOne).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'user-id',
			});
		});
	});

	describe('create', () => {
		it('throws KeycloakAdminScopeError when users:write scope is not granted', async () => {
			service = new UserService(mockAdminClient, readOnlyScopes);
			await expect(
				service.Create('realm', { username: 'test' }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.create).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.create when users:write scope is granted', async () => {
			mockAdminClient.users.create.mockResolvedValue({ id: 'new-user-id' });
			service = new UserService(mockAdminClient, allScopes);
			const result = await service.Create('realm', { username: 'test' });
			expect(result).toEqual({ id: 'new-user-id' });
			expect(mockAdminClient.users.create).toHaveBeenCalledWith({
				realm: 'realm',
				username: 'test',
			});
		});
	});

	describe('update', () => {
		it('throws KeycloakAdminScopeError when users:write scope is not granted', async () => {
			service = new UserService(mockAdminClient, readOnlyScopes);
			await expect(
				service.Update('realm', 'user-id', { username: 'updated' }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.update).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.update when users:write scope is granted', async () => {
			mockAdminClient.users.update.mockResolvedValue(undefined);
			service = new UserService(mockAdminClient, allScopes);
			await service.Update('realm', 'user-id', { username: 'updated' });
			expect(mockAdminClient.users.update).toHaveBeenCalledWith(
				{ realm: 'realm', id: 'user-id' },
				{ username: 'updated' },
			);
		});
	});

	describe('delete', () => {
		it('throws KeycloakAdminScopeError when users:write scope is not granted', async () => {
			service = new UserService(mockAdminClient, readOnlyScopes);
			await expect(service.Delete('realm', 'user-id')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.del).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.del when users:write scope is granted', async () => {
			mockAdminClient.users.del.mockResolvedValue(undefined);
			service = new UserService(mockAdminClient, allScopes);
			await service.Delete('realm', 'user-id');
			expect(mockAdminClient.users.del).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'user-id',
			});
		});
	});

	describe('resetPassword', () => {
		it('throws KeycloakAdminScopeError when users:write scope is not granted', async () => {
			service = new UserService(mockAdminClient, readOnlyScopes);
			const credential = { type: 'password', value: 'newpass' };
			await expect(
				service.ResetPassword('realm', 'user-id', credential),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.resetPassword).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.resetPassword when users:write scope is granted', async () => {
			mockAdminClient.users.resetPassword.mockResolvedValue(undefined);
			service = new UserService(mockAdminClient, allScopes);
			const credential = { type: 'password', value: 'newpass' };
			await service.ResetPassword('realm', 'user-id', credential);
			expect(mockAdminClient.users.resetPassword).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'user-id',
				credential,
			});
		});
	});

	describe('addRealmRoles', () => {
		it('throws KeycloakAdminScopeError when users:write scope is not granted', async () => {
			service = new UserService(mockAdminClient, readOnlyScopes);
			const roles = [{ id: 'role1', name: 'admin' }];
			await expect(
				service.AddRealmRoles('realm', 'user-id', roles),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.addRealmRoleMappings).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.addRealmRoleMappings when users:write scope is granted', async () => {
			mockAdminClient.users.addRealmRoleMappings.mockResolvedValue(undefined);
			service = new UserService(mockAdminClient, allScopes);
			const roles = [{ id: 'role1', name: 'admin' }];
			await service.AddRealmRoles('realm', 'user-id', roles);
			expect(mockAdminClient.users.addRealmRoleMappings).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'user-id',
				roles,
			});
		});
	});

	describe('getRealmRoles', () => {
		it('throws KeycloakAdminScopeError when users:read scope is not granted', async () => {
			service = new UserService(mockAdminClient, noScopes);
			await expect(service.GetRealmRoles('realm', 'user-id')).rejects.toThrow(
				KeycloakAdminScopeError,
			);
			expect(mockAdminClient.users.listRealmRoleMappings).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.listRealmRoleMappings when users:read scope is granted', async () => {
			mockAdminClient.users.listRealmRoleMappings.mockResolvedValue([{ id: 'role1' }]);
			service = new UserService(mockAdminClient, readOnlyScopes);
			const result = await service.GetRealmRoles('realm', 'user-id');
			expect(result).toEqual([{ id: 'role1' }]);
			expect(mockAdminClient.users.listRealmRoleMappings).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'user-id',
			});
		});
	});

	describe('deleteRealmRoles', () => {
		it('throws KeycloakAdminScopeError when users:write scope is not granted', async () => {
			service = new UserService(mockAdminClient, readOnlyScopes);
			const roles = [{ id: 'role1', name: 'admin' }];
			await expect(
				service.DeleteRealmRoles('realm', 'user-id', roles),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.delRealmRoleMappings).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.delRealmRoleMappings when users:write scope is granted', async () => {
			mockAdminClient.users.delRealmRoleMappings.mockResolvedValue(undefined);
			service = new UserService(mockAdminClient, allScopes);
			const roles = [{ id: 'role1', name: 'admin' }];
			await service.DeleteRealmRoles('realm', 'user-id', roles);
			expect(mockAdminClient.users.delRealmRoleMappings).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'user-id',
				roles,
			});
		});
	});

	describe('addClientRoles', () => {
		it('throws KeycloakAdminScopeError when users:write scope is not granted', async () => {
			service = new UserService(mockAdminClient, readOnlyScopes);
			const roles = [{ id: 'role1', name: 'client-admin' }];
			await expect(
				service.AddClientRoles('realm', 'user-id', 'client-id', roles),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.addClientRoleMappings).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.addClientRoleMappings when users:write scope is granted', async () => {
			mockAdminClient.users.addClientRoleMappings.mockResolvedValue(undefined);
			service = new UserService(mockAdminClient, allScopes);
			const roles = [{ id: 'role1', name: 'client-admin' }];
			await service.AddClientRoles('realm', 'user-id', 'client-id', roles);
			expect(mockAdminClient.users.addClientRoleMappings).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'user-id',
				clientUniqueId: 'client-id',
				roles,
			});
		});
	});

	describe('getClientRoles', () => {
		it('throws KeycloakAdminScopeError when users:read scope is not granted', async () => {
			service = new UserService(mockAdminClient, noScopes);
			await expect(
				service.GetClientRoles('realm', 'user-id', 'client-id'),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.listClientRoleMappings).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.listClientRoleMappings when users:read scope is granted', async () => {
			mockAdminClient.users.listClientRoleMappings.mockResolvedValue([{ id: 'role1' }]);
			service = new UserService(mockAdminClient, readOnlyScopes);
			const result = await service.GetClientRoles('realm', 'user-id', 'client-id');
			expect(result).toEqual([{ id: 'role1' }]);
			expect(mockAdminClient.users.listClientRoleMappings).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'user-id',
				clientUniqueId: 'client-id',
			});
		});
	});

	describe('deleteClientRoles', () => {
		it('throws KeycloakAdminScopeError when users:write scope is not granted', async () => {
			service = new UserService(mockAdminClient, readOnlyScopes);
			const roles = [{ id: 'role1', name: 'client-admin' }];
			await expect(
				service.DeleteClientRoles('realm', 'user-id', 'client-id', roles),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.delClientRoleMappings).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.delClientRoleMappings when users:write scope is granted', async () => {
			mockAdminClient.users.delClientRoleMappings.mockResolvedValue(undefined);
			service = new UserService(mockAdminClient, allScopes);
			const roles = [{ id: 'role1', name: 'client-admin' }];
			await service.DeleteClientRoles('realm', 'user-id', 'client-id', roles);
			expect(mockAdminClient.users.delClientRoleMappings).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'user-id',
				clientUniqueId: 'client-id',
				roles,
			});
		});
	});

	describe('findByFederatedIdentity', () => {
		it('throws KeycloakAdminScopeError when users:read scope is not granted', async () => {
			service = new UserService(mockAdminClient, noScopes);
			await expect(
				service.FindByFederatedIdentity('steam', 'steam-123'),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.find).not.toHaveBeenCalled();
		});

		it('returns first user when users:read scope is granted and user found', async () => {
			mockAdminClient.users.find.mockResolvedValue([{ id: 'user-id', username: 'test' }]);
			service = new UserService(mockAdminClient, readOnlyScopes);
			const result = await service.FindByFederatedIdentity('steam', 'steam-123');
			expect(result).toEqual({ id: 'user-id', username: 'test' });
			expect(mockAdminClient.users.find).toHaveBeenCalledWith({
				idpAlias: 'steam',
				idpUserId: 'steam-123',
				exact: true,
			});
		});

		it('returns null when no user found', async () => {
			mockAdminClient.users.find.mockResolvedValue([]);
			service = new UserService(mockAdminClient, readOnlyScopes);
			const result = await service.FindByFederatedIdentity('steam', 'steam-123');
			expect(result).toBeNull();
		});
	});
});
