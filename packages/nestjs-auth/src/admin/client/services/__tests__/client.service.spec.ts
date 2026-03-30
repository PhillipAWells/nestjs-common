import { describe, it, expect, beforeEach, vi } from 'vitest';
import type KcAdminClient from '@keycloak/keycloak-admin-client';
import { ClientService } from '../client.service.js';
import { KeycloakAdminScopeError } from '../../../permissions/keycloak-admin.permissions.js';
import type { TKeycloakAdminScope } from '../../../permissions/keycloak-admin.permissions.js';

describe('ClientService', () => {
	let service: ClientService;
	let mockAdminClient: any;
	let allScopes: Set<TKeycloakAdminScope>;
	let readOnlyScopes: Set<TKeycloakAdminScope>;
	let noScopes: Set<TKeycloakAdminScope>;

	beforeEach(() => {
		mockAdminClient = {
			clients: {
				find: vi.fn(),
				findOne: vi.fn(),
				create: vi.fn(),
				update: vi.fn(),
				del: vi.fn(),
				getClientSecret: vi.fn(),
				addProtocolMapper: vi.fn(),
				listProtocolMappers: vi.fn(),
				delProtocolMapper: vi.fn(),
				createRole: vi.fn(),
				listRoles: vi.fn(),
				findRole: vi.fn(),
				delRole: vi.fn(),
			},
		} as unknown as KcAdminClient;

		allScopes = new Set(['clients:read', 'clients:write'] as TKeycloakAdminScope[]);
		readOnlyScopes = new Set(['clients:read'] as TKeycloakAdminScope[]);
		noScopes = new Set([] as TKeycloakAdminScope[]);
	});

	describe('list', () => {
		it('throws KeycloakAdminScopeError when clients:read scope is not granted', async () => {
			service = new ClientService(mockAdminClient, noScopes);
			await expect(service.list('realm')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.clients.find).not.toHaveBeenCalled();
		});

		it('calls adminClient.clients.find when clients:read scope is granted', async () => {
			mockAdminClient.clients.find.mockResolvedValue([{ id: 'client1', clientId: 'my-app' }]);
			service = new ClientService(mockAdminClient, readOnlyScopes);
			const result = await service.list('realm');
			expect(result).toEqual([{ id: 'client1', clientId: 'my-app' }]);
			expect(mockAdminClient.clients.find).toHaveBeenCalledWith({ realm: 'realm' });
		});

		it('returns empty array when no clients found', async () => {
			mockAdminClient.clients.find.mockResolvedValue([]);
			service = new ClientService(mockAdminClient, readOnlyScopes);
			const result = await service.list('realm');
			expect(result).toEqual([]);
		});
	});

	describe('get', () => {
		it('throws KeycloakAdminScopeError when clients:read scope is not granted', async () => {
			service = new ClientService(mockAdminClient, noScopes);
			await expect(service.get('realm', 'client-id')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.clients.findOne).not.toHaveBeenCalled();
		});

		it('calls adminClient.clients.findOne when clients:read scope is granted', async () => {
			mockAdminClient.clients.findOne.mockResolvedValue({ id: 'client-id', clientId: 'my-app' });
			service = new ClientService(mockAdminClient, readOnlyScopes);
			const result = await service.get('realm', 'client-id');
			expect(result).toEqual({ id: 'client-id', clientId: 'my-app' });
			expect(mockAdminClient.clients.findOne).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'client-id',
			});
		});
	});

	describe('findByClientId', () => {
		it('throws KeycloakAdminScopeError when clients:read scope is not granted', async () => {
			service = new ClientService(mockAdminClient, noScopes);
			await expect(service.findByClientId('realm', 'my-app')).rejects.toThrow(
				KeycloakAdminScopeError,
			);
			expect(mockAdminClient.clients.find).not.toHaveBeenCalled();
		});

		it('returns first client when clients:read scope is granted and client found', async () => {
			mockAdminClient.clients.find.mockResolvedValue([{ id: 'client-id', clientId: 'my-app' }]);
			service = new ClientService(mockAdminClient, readOnlyScopes);
			const result = await service.findByClientId('realm', 'my-app');
			expect(result).toEqual({ id: 'client-id', clientId: 'my-app' });
			expect(mockAdminClient.clients.find).toHaveBeenCalledWith({
				realm: 'realm',
				clientId: 'my-app',
			});
		});

		it('returns undefined when no client found', async () => {
			mockAdminClient.clients.find.mockResolvedValue([]);
			service = new ClientService(mockAdminClient, readOnlyScopes);
			const result = await service.findByClientId('realm', 'my-app');
			expect(result).toBeUndefined();
		});
	});

	describe('create', () => {
		it('throws KeycloakAdminScopeError when clients:write scope is not granted', async () => {
			service = new ClientService(mockAdminClient, readOnlyScopes);
			await expect(
				service.create('realm', { clientId: 'my-app' }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.clients.create).not.toHaveBeenCalled();
		});

		it('calls adminClient.clients.create when clients:write scope is granted', async () => {
			mockAdminClient.clients.create.mockResolvedValue({ id: 'new-client-id' });
			service = new ClientService(mockAdminClient, allScopes);
			const result = await service.create('realm', { clientId: 'my-app' });
			expect(result).toEqual({ id: 'new-client-id' });
			expect(mockAdminClient.clients.create).toHaveBeenCalledWith({
				realm: 'realm',
				clientId: 'my-app',
			});
		});
	});

	describe('update', () => {
		it('throws KeycloakAdminScopeError when clients:write scope is not granted', async () => {
			service = new ClientService(mockAdminClient, readOnlyScopes);
			await expect(
				service.update('realm', 'client-id', { clientId: 'updated-app' }),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.clients.update).not.toHaveBeenCalled();
		});

		it('calls adminClient.clients.update when clients:write scope is granted', async () => {
			mockAdminClient.clients.update.mockResolvedValue(undefined);
			service = new ClientService(mockAdminClient, allScopes);
			await service.update('realm', 'client-id', { clientId: 'updated-app' });
			expect(mockAdminClient.clients.update).toHaveBeenCalledWith(
				{ realm: 'realm', id: 'client-id' },
				{ clientId: 'updated-app' },
			);
		});
	});

	describe('delete', () => {
		it('throws KeycloakAdminScopeError when clients:write scope is not granted', async () => {
			service = new ClientService(mockAdminClient, readOnlyScopes);
			await expect(service.delete('realm', 'client-id')).rejects.toThrow(
				KeycloakAdminScopeError,
			);
			expect(mockAdminClient.clients.del).not.toHaveBeenCalled();
		});

		it('calls adminClient.clients.del when clients:write scope is granted', async () => {
			mockAdminClient.clients.del.mockResolvedValue(undefined);
			service = new ClientService(mockAdminClient, allScopes);
			await service.delete('realm', 'client-id');
			expect(mockAdminClient.clients.del).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'client-id',
			});
		});
	});

	describe('getSecret', () => {
		it('throws KeycloakAdminScopeError when clients:read scope is not granted', async () => {
			service = new ClientService(mockAdminClient, noScopes);
			await expect(service.getSecret('realm', 'client-id')).rejects.toThrow(
				KeycloakAdminScopeError,
			);
			expect(mockAdminClient.clients.getClientSecret).not.toHaveBeenCalled();
		});

		it('calls adminClient.clients.getClientSecret when clients:read scope is granted', async () => {
			mockAdminClient.clients.getClientSecret.mockResolvedValue({ value: 'secret123' });
			service = new ClientService(mockAdminClient, readOnlyScopes);
			const result = await service.getSecret('realm', 'client-id');
			expect(result).toEqual({ value: 'secret123' });
			expect(mockAdminClient.clients.getClientSecret).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'client-id',
			});
		});
	});

	describe('createProtocolMapper', () => {
		it('throws KeycloakAdminScopeError when clients:write scope is not granted', async () => {
			service = new ClientService(mockAdminClient, readOnlyScopes);
			const mapper = { name: 'mapper1', protocolMapper: 'openid-connect-usermodel-attribute-mapper' };
			await expect(
				service.createProtocolMapper('realm', 'client-id', mapper),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.clients.addProtocolMapper).not.toHaveBeenCalled();
		});

		it('calls adminClient.clients.addProtocolMapper when clients:write scope is granted', async () => {
			mockAdminClient.clients.addProtocolMapper.mockResolvedValue(undefined);
			service = new ClientService(mockAdminClient, allScopes);
			const mapper = { name: 'mapper1', protocolMapper: 'openid-connect-usermodel-attribute-mapper' };
			await service.createProtocolMapper('realm', 'client-id', mapper);
			expect(mockAdminClient.clients.addProtocolMapper).toHaveBeenCalledWith(
				{ realm: 'realm', id: 'client-id' },
				mapper,
			);
		});
	});

	describe('listProtocolMappers', () => {
		it('throws KeycloakAdminScopeError when clients:read scope is not granted', async () => {
			service = new ClientService(mockAdminClient, noScopes);
			await expect(service.listProtocolMappers('realm', 'client-id')).rejects.toThrow(
				KeycloakAdminScopeError,
			);
			expect(mockAdminClient.clients.listProtocolMappers).not.toHaveBeenCalled();
		});

		it('calls adminClient.clients.listProtocolMappers when clients:read scope is granted', async () => {
			mockAdminClient.clients.listProtocolMappers.mockResolvedValue([{ id: 'mapper1' }]);
			service = new ClientService(mockAdminClient, readOnlyScopes);
			const result = await service.listProtocolMappers('realm', 'client-id');
			expect(result).toEqual([{ id: 'mapper1' }]);
			expect(mockAdminClient.clients.listProtocolMappers).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'client-id',
			});
		});
	});

	describe('deleteProtocolMapper', () => {
		it('throws KeycloakAdminScopeError when clients:write scope is not granted', async () => {
			service = new ClientService(mockAdminClient, readOnlyScopes);
			await expect(
				service.deleteProtocolMapper('realm', 'client-id', 'mapper-id'),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.clients.delProtocolMapper).not.toHaveBeenCalled();
		});

		it('calls adminClient.clients.delProtocolMapper when clients:write scope is granted', async () => {
			mockAdminClient.clients.delProtocolMapper.mockResolvedValue(undefined);
			service = new ClientService(mockAdminClient, allScopes);
			await service.deleteProtocolMapper('realm', 'client-id', 'mapper-id');
			expect(mockAdminClient.clients.delProtocolMapper).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'client-id',
				mapperId: 'mapper-id',
			});
		});
	});

	describe('createRole', () => {
		it('throws KeycloakAdminScopeError when clients:write scope is not granted', async () => {
			service = new ClientService(mockAdminClient, readOnlyScopes);
			const role = { name: 'client-admin' };
			await expect(
				service.createRole('realm', 'client-id', role),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.clients.createRole).not.toHaveBeenCalled();
		});

		it('calls adminClient.clients.createRole when clients:write scope is granted', async () => {
			mockAdminClient.clients.createRole.mockResolvedValue(undefined);
			service = new ClientService(mockAdminClient, allScopes);
			const role = { name: 'client-admin' };
			await service.createRole('realm', 'client-id', role);
			expect(mockAdminClient.clients.createRole).toHaveBeenCalledWith(
				{ realm: 'realm', id: 'client-id' },
				role,
			);
		});
	});

	describe('listRoles', () => {
		it('throws KeycloakAdminScopeError when clients:read scope is not granted', async () => {
			service = new ClientService(mockAdminClient, noScopes);
			await expect(service.listRoles('realm', 'client-id')).rejects.toThrow(
				KeycloakAdminScopeError,
			);
			expect(mockAdminClient.clients.listRoles).not.toHaveBeenCalled();
		});

		it('calls adminClient.clients.listRoles when clients:read scope is granted', async () => {
			mockAdminClient.clients.listRoles.mockResolvedValue([{ id: 'role1', name: 'client-admin' }]);
			service = new ClientService(mockAdminClient, readOnlyScopes);
			const result = await service.listRoles('realm', 'client-id');
			expect(result).toEqual([{ id: 'role1', name: 'client-admin' }]);
			expect(mockAdminClient.clients.listRoles).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'client-id',
			});
		});
	});

	describe('findRole', () => {
		it('throws KeycloakAdminScopeError when clients:read scope is not granted', async () => {
			service = new ClientService(mockAdminClient, noScopes);
			await expect(
				service.findRole('realm', 'client-id', 'client-admin'),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.clients.findRole).not.toHaveBeenCalled();
		});

		it('calls adminClient.clients.findRole when clients:read scope is granted', async () => {
			mockAdminClient.clients.findRole.mockResolvedValue({ id: 'role1', name: 'client-admin' });
			service = new ClientService(mockAdminClient, readOnlyScopes);
			const result = await service.findRole('realm', 'client-id', 'client-admin');
			expect(result).toEqual({ id: 'role1', name: 'client-admin' });
			expect(mockAdminClient.clients.findRole).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'client-id',
				roleName: 'client-admin',
			});
		});
	});

	describe('deleteRole', () => {
		it('throws KeycloakAdminScopeError when clients:write scope is not granted', async () => {
			service = new ClientService(mockAdminClient, readOnlyScopes);
			await expect(
				service.deleteRole('realm', 'client-id', 'client-admin'),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.clients.delRole).not.toHaveBeenCalled();
		});

		it('calls adminClient.clients.delRole when clients:write scope is granted', async () => {
			mockAdminClient.clients.delRole.mockResolvedValue(undefined);
			service = new ClientService(mockAdminClient, allScopes);
			await service.deleteRole('realm', 'client-id', 'client-admin');
			expect(mockAdminClient.clients.delRole).toHaveBeenCalledWith({
				realm: 'realm',
				id: 'client-id',
				roleName: 'client-admin',
			});
		});
	});
});
