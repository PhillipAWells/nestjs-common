import { describe, it, expect, beforeEach, vi } from 'vitest';
import type KcAdminClient from '@keycloak/keycloak-admin-client';
import { RoleService } from '../role.service.js';
import { KeycloakAdminScopeError } from '../../../permissions/keycloak-admin.permissions.js';
import type { TKeycloakAdminScope } from '../../../permissions/keycloak-admin.permissions.js';

describe('RoleService', () => {
	let service: RoleService;
	let mockAdminClient: any;
	let allScopes: Set<TKeycloakAdminScope>;
	let readOnlyScopes: Set<TKeycloakAdminScope>;
	let noScopes: Set<TKeycloakAdminScope>;

	beforeEach(() => {
		mockAdminClient = {
			roles: {
				find: vi.fn(),
				findOneByName: vi.fn(),
				create: vi.fn(),
				updateByName: vi.fn(),
				delByName: vi.fn(),
			},
			clients: {
				listRoles: vi.fn(),
			},
		} as unknown as KcAdminClient;

		allScopes = new Set(['roles:read', 'roles:write'] as TKeycloakAdminScope[]);
		readOnlyScopes = new Set(['roles:read'] as TKeycloakAdminScope[]);
		noScopes = new Set([] as TKeycloakAdminScope[]);
	});

	describe('listRealm', () => {
		it('throws KeycloakAdminScopeError when roles:read scope is not granted', async () => {
			service = new RoleService(mockAdminClient, noScopes);
			await expect(service.ListRealm('realm')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.roles.find).not.toHaveBeenCalled();
		});

		it('calls adminClient.roles.find when roles:read scope is granted', async () => {
			mockAdminClient.roles.find.mockResolvedValue([{ id: 'role1', name: 'admin' }]);
			service = new RoleService(mockAdminClient, readOnlyScopes);
			const result = await service.ListRealm('realm');
			expect(result).toEqual([{ id: 'role1', name: 'admin' }]);
			expect(mockAdminClient.roles.find).toHaveBeenCalledWith({ realm: 'realm' });
		});

		it('returns empty array when no roles found', async () => {
			mockAdminClient.roles.find.mockResolvedValue([]);
			service = new RoleService(mockAdminClient, readOnlyScopes);
			const result = await service.ListRealm('realm');
			expect(result).toEqual([]);
		});
	});

	describe('listClient', () => {
		it('throws KeycloakAdminScopeError when roles:read scope is not granted', async () => {
			service = new RoleService(mockAdminClient, noScopes);
			await expect(service.ListClient('realm', 'client-id')).rejects.toThrow(
				KeycloakAdminScopeError,
			);
			expect(mockAdminClient.clients.listRoles).not.toHaveBeenCalled();
		});

		it('calls adminClient.clients.listRoles when roles:read scope is granted', async () => {
			mockAdminClient.clients.listRoles.mockResolvedValue([{ id: 'role1' }]);
			service = new RoleService(mockAdminClient, readOnlyScopes);
			const result = await service.ListClient('realm', 'client-id');
			expect(result).toEqual([{ id: 'role1' }]);
			expect(mockAdminClient.clients.listRoles).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'client-id',
			});
		});
	});

	describe('getByName', () => {
		it('throws KeycloakAdminScopeError when roles:read scope is not granted', async () => {
			service = new RoleService(mockAdminClient, noScopes);
			await expect(service.GetByName('realm', 'admin')).rejects.toThrow(
				KeycloakAdminScopeError,
			);
			expect(mockAdminClient.roles.findOneByName).not.toHaveBeenCalled();
		});

		it('calls adminClient.roles.findOneByName when roles:read scope is granted', async () => {
			mockAdminClient.roles.findOneByName.mockResolvedValue({ id: 'role1', name: 'admin' });
			service = new RoleService(mockAdminClient, readOnlyScopes);
			const result = await service.GetByName('realm', 'admin');
			expect(result).toEqual({ id: 'role1', name: 'admin' });
			expect(mockAdminClient.roles.findOneByName).toHaveBeenCalledWith({
				realm: 'realm',
				name: 'admin',
			});
		});
	});

	describe('create', () => {
		it('throws KeycloakAdminScopeError when roles:write scope is not granted', async () => {
			service = new RoleService(mockAdminClient, readOnlyScopes);
			await expect(
				service.Create('realm', { name: 'new-role' }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.roles.create).not.toHaveBeenCalled();
		});

		it('calls adminClient.roles.create when roles:write scope is granted', async () => {
			mockAdminClient.roles.create.mockResolvedValue(undefined);
			service = new RoleService(mockAdminClient, allScopes);
			await service.Create('realm', { name: 'new-role' });
			expect(mockAdminClient.roles.create).toHaveBeenCalledWith({
				realm: 'realm',
				name: 'new-role',
			});
		});
	});

	describe('update', () => {
		it('throws KeycloakAdminScopeError when roles:write scope is not granted', async () => {
			service = new RoleService(mockAdminClient, readOnlyScopes);
			await expect(
				service.Update('realm', 'old-name', { name: 'new-name' }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.roles.updateByName).not.toHaveBeenCalled();
		});

		it('calls adminClient.roles.updateByName when roles:write scope is granted', async () => {
			mockAdminClient.roles.updateByName.mockResolvedValue(undefined);
			service = new RoleService(mockAdminClient, allScopes);
			await service.Update('realm', 'old-name', { name: 'new-name' });
			expect(mockAdminClient.roles.updateByName).toHaveBeenCalledWith(
				{ realm: 'realm', name: 'old-name' },
				{ name: 'new-name' },
			);
		});
	});

	describe('delete', () => {
		it('throws KeycloakAdminScopeError when roles:write scope is not granted', async () => {
			service = new RoleService(mockAdminClient, readOnlyScopes);
			await expect(service.Delete('realm', 'admin')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.roles.delByName).not.toHaveBeenCalled();
		});

		it('calls adminClient.roles.delByName when roles:write scope is granted', async () => {
			mockAdminClient.roles.delByName.mockResolvedValue(undefined);
			service = new RoleService(mockAdminClient, allScopes);
			await service.Delete('realm', 'admin');
			expect(mockAdminClient.roles.delByName).toHaveBeenCalledWith({
				realm: 'realm',
				name: 'admin',
			});
		});
	});
});
