import { describe, it, expect, beforeEach, vi } from 'vitest';
import type KcAdminClient from '@keycloak/keycloak-admin-client';
import { GroupService } from '../group.service.js';
import { KeycloakAdminScopeError } from '../../../permissions/keycloak-admin.permissions.js';
import type { TKeycloakAdminScope } from '../../../permissions/keycloak-admin.permissions.js';

describe('GroupService', () => {
	let service: GroupService;
	let mockAdminClient: any;
	let allScopes: Set<TKeycloakAdminScope>;
	let readOnlyScopes: Set<TKeycloakAdminScope>;
	let noScopes: Set<TKeycloakAdminScope>;

	beforeEach(() => {
		mockAdminClient = {
			groups: {
				find: vi.fn(),
				findOne: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
				del: vi.fn(),
			},
			users: {
				addToGroup: vi.fn(),
				delFromGroup: vi.fn(),
			},
		} as unknown as KcAdminClient;

		allScopes = new Set(['groups:read', 'groups:write'] as TKeycloakAdminScope[]);
		readOnlyScopes = new Set(['groups:read'] as TKeycloakAdminScope[]);
		noScopes = new Set([] as TKeycloakAdminScope[]);
	});

	describe('list', () => {
		it('throws KeycloakAdminScopeError when groups:read scope is not granted', async () => {
			service = new GroupService(mockAdminClient, noScopes);
			await expect(service.List('realm')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.groups.find).not.toHaveBeenCalled();
		});

		it('calls adminClient.groups.find when groups:read scope is granted', async () => {
			mockAdminClient.groups.find.mockResolvedValue([{ id: 'group1', name: 'admins' }]);
			service = new GroupService(mockAdminClient, readOnlyScopes);
			const result = await service.List('realm');
			expect(result).toEqual([{ id: 'group1', name: 'admins' }]);
			expect(mockAdminClient.groups.find).toHaveBeenCalledWith({ realm: 'realm' });
		});

		it('returns empty array when no groups found', async () => {
			mockAdminClient.groups.find.mockResolvedValue([]);
			service = new GroupService(mockAdminClient, readOnlyScopes);
			const result = await service.List('realm');
			expect(result).toEqual([]);
		});
	});

	describe('get', () => {
		it('throws KeycloakAdminScopeError when groups:read scope is not granted', async () => {
			service = new GroupService(mockAdminClient, noScopes);
			await expect(service.Get('realm', 'group-id')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.groups.findOne).not.toHaveBeenCalled();
		});

		it('calls adminClient.groups.findOne when groups:read scope is granted', async () => {
			mockAdminClient.groups.findOne.mockResolvedValue({ id: 'group-id', name: 'admins' });
			service = new GroupService(mockAdminClient, readOnlyScopes);
			const result = await service.Get('realm', 'group-id');
			expect(result).toEqual({ id: 'group-id', name: 'admins' });
			expect(mockAdminClient.groups.findOne).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'group-id',
			});
		});
	});

	describe('create', () => {
		it('throws KeycloakAdminScopeError when groups:write scope is not granted', async () => {
			service = new GroupService(mockAdminClient, readOnlyScopes);
			await expect(
				service.Create('realm', { name: 'new-group' }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.groups.create).not.toHaveBeenCalled();
		});

		it('calls adminClient.groups.create when groups:write scope is granted', async () => {
			mockAdminClient.groups.create.mockResolvedValue({ id: 'new-group-id' });
			service = new GroupService(mockAdminClient, allScopes);
			const result = await service.Create('realm', { name: 'new-group' });
			expect(result).toEqual({ id: 'new-group-id' });
			expect(mockAdminClient.groups.create).toHaveBeenCalledWith({
				realm: 'realm',
				name: 'new-group',
			});
		});
	});

	describe('update', () => {
		it('throws KeycloakAdminScopeError when groups:write scope is not granted', async () => {
			service = new GroupService(mockAdminClient, readOnlyScopes);
			await expect(
				service.Update('realm', 'group-id', { name: 'updated-group' }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.groups.update).not.toHaveBeenCalled();
		});

		it('calls adminClient.groups.update when groups:write scope is granted', async () => {
			mockAdminClient.groups.update.mockResolvedValue(undefined);
			service = new GroupService(mockAdminClient, allScopes);
			await service.Update('realm', 'group-id', { name: 'updated-group' });
			expect(mockAdminClient.groups.update).toHaveBeenCalledWith(
				{ realm: 'realm', id: 'group-id' },
				{ name: 'updated-group' },
			);
		});
	});

	describe('delete', () => {
		it('throws KeycloakAdminScopeError when groups:write scope is not granted', async () => {
			service = new GroupService(mockAdminClient, readOnlyScopes);
			await expect(service.Delete('realm', 'group-id')).rejects.toThrow(
				KeycloakAdminScopeError,
			);
			expect(mockAdminClient.groups.del).not.toHaveBeenCalled();
		});

		it('calls adminClient.groups.del when groups:write scope is granted', async () => {
			mockAdminClient.groups.del.mockResolvedValue(undefined);
			service = new GroupService(mockAdminClient, allScopes);
			await service.Delete('realm', 'group-id');
			expect(mockAdminClient.groups.del).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'group-id',
			});
		});
	});

	describe('addMember', () => {
		it('throws KeycloakAdminScopeError when groups:write scope is not granted', async () => {
			service = new GroupService(mockAdminClient, readOnlyScopes);
			await expect(
				service.AddMember('realm', 'group-id', 'user-id'),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.addToGroup).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.addToGroup when groups:write scope is granted', async () => {
			mockAdminClient.users.addToGroup.mockResolvedValue(undefined);
			service = new GroupService(mockAdminClient, allScopes);
			await service.AddMember('realm', 'group-id', 'user-id');
			expect(mockAdminClient.users.addToGroup).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'user-id',
				groupId: 'group-id',
			});
		});
	});

	describe('removeMember', () => {
		it('throws KeycloakAdminScopeError when groups:write scope is not granted', async () => {
			service = new GroupService(mockAdminClient, readOnlyScopes);
			await expect(
				service.RemoveMember('realm', 'group-id', 'user-id'),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.users.delFromGroup).not.toHaveBeenCalled();
		});

		it('calls adminClient.users.delFromGroup when groups:write scope is granted', async () => {
			mockAdminClient.users.delFromGroup.mockResolvedValue(undefined);
			service = new GroupService(mockAdminClient, allScopes);
			await service.RemoveMember('realm', 'group-id', 'user-id');
			expect(mockAdminClient.users.delFromGroup).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'user-id',
				groupId: 'group-id',
			});
		});
	});
});
