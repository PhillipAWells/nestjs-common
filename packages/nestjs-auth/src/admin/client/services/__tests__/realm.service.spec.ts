import { describe, it, expect, beforeEach, vi } from 'vitest';
import type KcAdminClient from '@keycloak/keycloak-admin-client';
import { RealmService } from '../realm.service.js';
import { KeycloakAdminScopeError } from '../../../permissions/keycloak-admin.permissions.js';
import type { KeycloakAdminScope } from '../../../permissions/keycloak-admin.permissions.js';

describe('RealmService', () => {
	let service: RealmService;
	let mockAdminClient: any;
	let allScopes: Set<KeycloakAdminScope>;
	let readOnlyScopes: Set<KeycloakAdminScope>;
	let noScopes: Set<KeycloakAdminScope>;

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

		allScopes = new Set(['realms:read', 'realms:write'] as KeycloakAdminScope[]);
		readOnlyScopes = new Set(['realms:read'] as KeycloakAdminScope[]);
		noScopes = new Set([] as KeycloakAdminScope[]);
	});

	describe('list', () => {
		it('throws KeycloakAdminScopeError when realms:read scope is not granted', async () => {
			service = new RealmService(mockAdminClient, noScopes);
			await expect(service.list()).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.realms.find).not.toHaveBeenCalled();
		});

		it('calls adminClient.realms.find when realms:read scope is granted', async () => {
			mockAdminClient.realms.find.mockResolvedValue([{ realm: 'master', id: 'realm1' }]);
			service = new RealmService(mockAdminClient, readOnlyScopes);
			const result = await service.list();
			expect(result).toEqual([{ realm: 'master', id: 'realm1' }]);
			expect(mockAdminClient.realms.find).toHaveBeenCalledWith();
		});

		it('returns empty array when no realms found', async () => {
			mockAdminClient.realms.find.mockResolvedValue([]);
			service = new RealmService(mockAdminClient, readOnlyScopes);
			const result = await service.list();
			expect(result).toEqual([]);
		});
	});

	describe('get', () => {
		it('throws KeycloakAdminScopeError when realms:read scope is not granted', async () => {
			service = new RealmService(mockAdminClient, noScopes);
			await expect(service.get('master')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.realms.findOne).not.toHaveBeenCalled();
		});

		it('calls adminClient.realms.findOne when realms:read scope is granted', async () => {
			mockAdminClient.realms.findOne.mockResolvedValue({ realm: 'master', id: 'realm1' });
			service = new RealmService(mockAdminClient, readOnlyScopes);
			const result = await service.get('master');
			expect(result).toEqual({ realm: 'master', id: 'realm1' });
			expect(mockAdminClient.realms.findOne).toHaveBeenCalledWith({ realm: 'master' });
		});
	});

	describe('create', () => {
		it('throws KeycloakAdminScopeError when realms:write scope is not granted', async () => {
			service = new RealmService(mockAdminClient, readOnlyScopes);
			await expect(
				service.create({ realm: 'new-realm' }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.realms.create).not.toHaveBeenCalled();
		});

		it('calls adminClient.realms.create when realms:write scope is granted', async () => {
			mockAdminClient.realms.create.mockResolvedValue(undefined);
			service = new RealmService(mockAdminClient, allScopes);
			await service.create({ realm: 'new-realm' });
			expect(mockAdminClient.realms.create).toHaveBeenCalledWith({ realm: 'new-realm' });
		});
	});

	describe('update', () => {
		it('throws KeycloakAdminScopeError when realms:write scope is not granted', async () => {
			service = new RealmService(mockAdminClient, readOnlyScopes);
			await expect(
				service.update('master', { enabled: false }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.realms.update).not.toHaveBeenCalled();
		});

		it('calls adminClient.realms.update when realms:write scope is granted', async () => {
			mockAdminClient.realms.update.mockResolvedValue(undefined);
			service = new RealmService(mockAdminClient, allScopes);
			await service.update('master', { enabled: false });
			expect(mockAdminClient.realms.update).toHaveBeenCalledWith(
				{ realm: 'master' },
				{ enabled: false },
			);
		});
	});

	describe('delete', () => {
		it('throws KeycloakAdminScopeError when realms:write scope is not granted', async () => {
			service = new RealmService(mockAdminClient, readOnlyScopes);
			await expect(service.delete('old-realm')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.realms.del).not.toHaveBeenCalled();
		});

		it('calls adminClient.realms.del when realms:write scope is granted', async () => {
			mockAdminClient.realms.del.mockResolvedValue(undefined);
			service = new RealmService(mockAdminClient, allScopes);
			await service.delete('old-realm');
			expect(mockAdminClient.realms.del).toHaveBeenCalledWith({ realm: 'old-realm' });
		});
	});
});
