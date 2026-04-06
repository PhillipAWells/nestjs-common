import { describe, it, expect, beforeEach, vi } from 'vitest';
import type KcAdminClient from '@keycloak/keycloak-admin-client';
import { RealmService } from '../realm.service.js';
import { KeycloakAdminScopeError } from '../../../permissions/keycloak-admin.permissions.js';
import type { TKeycloakAdminScope } from '../../../permissions/keycloak-admin.permissions.js';

describe('RealmService', () => {
	let service: RealmService;
	let mockAdminClient: any;
	let allScopes: Set<TKeycloakAdminScope>;
	let readOnlyScopes: Set<TKeycloakAdminScope>;
	let noScopes: Set<TKeycloakAdminScope>;

	beforeEach(() => {
		mockAdminClient = {
			realms: {
				find: vi.fn(),
				findOne: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
				del: vi.fn(),
			},
		} as unknown as KcAdminClient;

		allScopes = new Set(['realms:read', 'realms:write'] as TKeycloakAdminScope[]);
		readOnlyScopes = new Set(['realms:read'] as TKeycloakAdminScope[]);
		noScopes = new Set([] as TKeycloakAdminScope[]);
	});

	describe('list', () => {
		it('throws KeycloakAdminScopeError when realms:read scope is not granted', async () => {
			service = new RealmService(mockAdminClient, noScopes);
			await expect(service.List()).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.realms.find).not.toHaveBeenCalled();
		});

		it('calls adminClient.realms.find when realms:read scope is granted', async () => {
			mockAdminClient.realms.find.mockResolvedValue([{ realm: 'master', id: 'realm1' }]);
			service = new RealmService(mockAdminClient, readOnlyScopes);
			const result = await service.List();
			expect(result).toEqual([{ realm: 'master', id: 'realm1' }]);
			expect(mockAdminClient.realms.find).toHaveBeenCalledWith();
		});

		it('returns empty array when no realms found', async () => {
			mockAdminClient.realms.find.mockResolvedValue([]);
			service = new RealmService(mockAdminClient, readOnlyScopes);
			const result = await service.List();
			expect(result).toEqual([]);
		});
	});

	describe('get', () => {
		it('throws KeycloakAdminScopeError when realms:read scope is not granted', async () => {
			service = new RealmService(mockAdminClient, noScopes);
			await expect(service.Get('master')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.realms.findOne).not.toHaveBeenCalled();
		});

		it('calls adminClient.realms.findOne when realms:read scope is granted', async () => {
			mockAdminClient.realms.findOne.mockResolvedValue({ realm: 'master', id: 'realm1' });
			service = new RealmService(mockAdminClient, readOnlyScopes);
			const result = await service.Get('master');
			expect(result).toEqual({ realm: 'master', id: 'realm1' });
			expect(mockAdminClient.realms.findOne).toHaveBeenCalledWith({ realm: 'master' });
		});
	});

	describe('create', () => {
		it('throws KeycloakAdminScopeError when realms:write scope is not granted', async () => {
			service = new RealmService(mockAdminClient, readOnlyScopes);
			await expect(
				service.Create({ realm: 'new-realm' }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.realms.create).not.toHaveBeenCalled();
		});

		it('calls adminClient.realms.create when realms:write scope is granted', async () => {
			mockAdminClient.realms.create.mockResolvedValue(undefined);
			service = new RealmService(mockAdminClient, allScopes);
			await service.Create({ realm: 'new-realm' });
			expect(mockAdminClient.realms.create).toHaveBeenCalledWith({ realm: 'new-realm' });
		});
	});

	describe('update', () => {
		it('throws KeycloakAdminScopeError when realms:write scope is not granted', async () => {
			service = new RealmService(mockAdminClient, readOnlyScopes);
			await expect(
				service.Update('master', { enabled: false }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.realms.update).not.toHaveBeenCalled();
		});

		it('calls adminClient.realms.update when realms:write scope is granted', async () => {
			mockAdminClient.realms.update.mockResolvedValue(undefined);
			service = new RealmService(mockAdminClient, allScopes);
			await service.Update('master', { enabled: false });
			expect(mockAdminClient.realms.update).toHaveBeenCalledWith(
				{ realm: 'master' },
				{ enabled: false },
			);
		});
	});

	describe('delete', () => {
		it('throws KeycloakAdminScopeError when realms:write scope is not granted', async () => {
			service = new RealmService(mockAdminClient, readOnlyScopes);
			await expect(service.Delete('old-realm')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.realms.del).not.toHaveBeenCalled();
		});

		it('calls adminClient.realms.del when realms:write scope is granted', async () => {
			mockAdminClient.realms.del.mockResolvedValue(undefined);
			service = new RealmService(mockAdminClient, allScopes);
			await service.Delete('old-realm');
			expect(mockAdminClient.realms.del).toHaveBeenCalledWith({ realm: 'old-realm' });
		});
	});
});
