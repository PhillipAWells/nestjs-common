import { describe, it, expect, beforeEach, vi } from 'vitest';
import type KcAdminClient from '@keycloak/keycloak-admin-client';
import { EventService } from '../event.service.js';
import { KeycloakAdminScopeError } from '../../../permissions/keycloak-admin.permissions.js';
import type { TKeycloakAdminScope } from '../../../permissions/keycloak-admin.permissions.js';

describe('EventService', () => {
	let service: EventService;
	let mockAdminClient: any;
	let readOnlyScopes: Set<TKeycloakAdminScope>;
	let noScopes: Set<TKeycloakAdminScope>;

	beforeEach(() => {
		mockAdminClient = {
			realms: {
				findAdminEvents: vi.fn(),
				findEvents: vi.fn(),
				find: vi.fn(),
			},
			realmName: 'test-realm',
		} as unknown as KcAdminClient;

		readOnlyScopes = new Set(['events:read'] as TKeycloakAdminScope[]);
		noScopes = new Set([] as TKeycloakAdminScope[]);
	});

	describe('getAdminEvents', () => {
		it('throws KeycloakAdminScopeError when events:read scope is not granted', async () => {
			service = new EventService(mockAdminClient, noScopes);
			await expect(service.GetAdminEvents('test-realm')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.realms.findAdminEvents).not.toHaveBeenCalled();
		});

		it('calls adminClient.realms.findAdminEvents when events:read scope is granted', async () => {
			mockAdminClient.realms.findAdminEvents.mockResolvedValue([
				{ id: 'event1', operation: 'CREATE' },
			]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			const result = await service.GetAdminEvents('test-realm');
			expect(result).toEqual([{ id: 'event1', operation: 'CREATE' }]);
			expect(mockAdminClient.realms.findAdminEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
			});
		});

		it('returns empty array when no events found', async () => {
			mockAdminClient.realms.findAdminEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			const result = await service.GetAdminEvents('test-realm');
			expect(result).toEqual([]);
		});

		it('builds query with operation types', async () => {
			mockAdminClient.realms.findAdminEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			await service.GetAdminEvents('test-realm', { operationTypes: ['CREATE', 'UPDATE'] });
			expect(mockAdminClient.realms.findAdminEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
				operationTypes: ['CREATE', 'UPDATE'],
			});
		});

		it('builds query with resource types', async () => {
			mockAdminClient.realms.findAdminEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			await service.GetAdminEvents('test-realm', { resourceTypes: ['USER', 'CLIENT'] });
			expect(mockAdminClient.realms.findAdminEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
				resourceTypes: ['USER', 'CLIENT'],
			});
		});

		it('builds query with resource path', async () => {
			mockAdminClient.realms.findAdminEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			await service.GetAdminEvents('test-realm', { resourcePath: 'users/123' });
			expect(mockAdminClient.realms.findAdminEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
				resourcePath: 'users/123',
			});
		});

		it('builds query with dateFrom as ISO string', async () => {
			mockAdminClient.realms.findAdminEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			const date = new Date('2024-01-01T00:00:00Z');
			await service.GetAdminEvents('test-realm', { dateFrom: date });
			expect(mockAdminClient.realms.findAdminEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
				dateFrom: '2024-01-01T00:00:00.000Z',
			});
		});

		it('builds query with dateTo as ISO string', async () => {
			mockAdminClient.realms.findAdminEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			const date = new Date('2024-12-31T23:59:59Z');
			await service.GetAdminEvents('test-realm', { dateTo: date });
			expect(mockAdminClient.realms.findAdminEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
				dateTo: '2024-12-31T23:59:59.000Z',
			});
		});

		it('builds query with pagination parameters', async () => {
			mockAdminClient.realms.findAdminEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			await service.GetAdminEvents('test-realm', { first: 10, max: 50 });
			expect(mockAdminClient.realms.findAdminEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
				first: 10,
				max: 50,
			});
		});

		it('builds query with all parameters combined', async () => {
			mockAdminClient.realms.findAdminEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			const dateFrom = new Date('2024-01-01T00:00:00Z');
			const dateTo = new Date('2024-12-31T23:59:59Z');
			await service.GetAdminEvents('test-realm', {
				operationTypes: ['CREATE'],
				resourceTypes: ['USER'],
				resourcePath: 'users',
				dateFrom,
				dateTo,
				first: 0,
				max: 100,
			});
			expect(mockAdminClient.realms.findAdminEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
				operationTypes: ['CREATE'],
				resourceTypes: ['USER'],
				resourcePath: 'users',
				dateFrom: dateFrom.toISOString(),
				dateTo: dateTo.toISOString(),
				first: 0,
				max: 100,
			});
		});

		it('ignores empty operation types array', async () => {
			mockAdminClient.realms.findAdminEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			await service.GetAdminEvents('test-realm', { operationTypes: [] });
			expect(mockAdminClient.realms.findAdminEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
			});
		});

		it('ignores empty resource types array', async () => {
			mockAdminClient.realms.findAdminEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			await service.GetAdminEvents('test-realm', { resourceTypes: [] });
			expect(mockAdminClient.realms.findAdminEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
			});
		});
	});

	describe('getAccessEvents', () => {
		it('throws KeycloakAdminScopeError when events:read scope is not granted', async () => {
			service = new EventService(mockAdminClient, noScopes);
			await expect(service.GetAccessEvents('test-realm')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.realms.findEvents).not.toHaveBeenCalled();
		});

		it('calls adminClient.realms.findEvents when events:read scope is granted', async () => {
			mockAdminClient.realms.findEvents.mockResolvedValue([
				{ id: 'event1', type: 'LOGIN' },
			]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			const result = await service.GetAccessEvents('test-realm');
			expect(result).toEqual([{ id: 'event1', type: 'LOGIN' }]);
			expect(mockAdminClient.realms.findEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
			});
		});

		it('returns empty array when no events found', async () => {
			mockAdminClient.realms.findEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			const result = await service.GetAccessEvents('test-realm');
			expect(result).toEqual([]);
		});

		it('builds query with event types', async () => {
			mockAdminClient.realms.findEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			await service.GetAccessEvents('test-realm', { type: ['LOGIN', 'LOGOUT'] });
			expect(mockAdminClient.realms.findEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
				type: ['LOGIN', 'LOGOUT'],
			});
		});

		it('builds query with client filter', async () => {
			mockAdminClient.realms.findEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			await service.GetAccessEvents('test-realm', { client: 'my-client' });
			expect(mockAdminClient.realms.findEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
				client: 'my-client',
			});
		});

		it('builds query with user filter', async () => {
			mockAdminClient.realms.findEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			await service.GetAccessEvents('test-realm', { user: 'user123' });
			expect(mockAdminClient.realms.findEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
				user: 'user123',
			});
		});

		it('builds query with dateFrom as ISO string', async () => {
			mockAdminClient.realms.findEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			const date = new Date('2024-01-01T00:00:00Z');
			await service.GetAccessEvents('test-realm', { dateFrom: date });
			expect(mockAdminClient.realms.findEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
				dateFrom: '2024-01-01T00:00:00.000Z',
			});
		});

		it('builds query with dateTo as ISO string', async () => {
			mockAdminClient.realms.findEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			const date = new Date('2024-12-31T23:59:59Z');
			await service.GetAccessEvents('test-realm', { dateTo: date });
			expect(mockAdminClient.realms.findEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
				dateTo: '2024-12-31T23:59:59.000Z',
			});
		});

		it('builds query with pagination parameters', async () => {
			mockAdminClient.realms.findEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			await service.GetAccessEvents('test-realm', { first: 10, max: 50 });
			expect(mockAdminClient.realms.findEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
				first: 10,
				max: 50,
			});
		});

		it('builds query with all parameters combined', async () => {
			mockAdminClient.realms.findEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			const dateFrom = new Date('2024-01-01T00:00:00Z');
			const dateTo = new Date('2024-12-31T23:59:59Z');
			await service.GetAccessEvents('test-realm', {
				type: ['LOGIN'],
				client: 'my-client',
				user: 'user123',
				dateFrom,
				dateTo,
				first: 0,
				max: 100,
			});
			expect(mockAdminClient.realms.findEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
				type: ['LOGIN'],
				client: 'my-client',
				user: 'user123',
				dateFrom: dateFrom.toISOString(),
				dateTo: dateTo.toISOString(),
				first: 0,
				max: 100,
			});
		});

		it('ignores empty type array', async () => {
			mockAdminClient.realms.findEvents.mockResolvedValue([]);
			service = new EventService(mockAdminClient, readOnlyScopes);
			await service.GetAccessEvents('test-realm', { type: [] });
			expect(mockAdminClient.realms.findEvents).toHaveBeenCalledWith({
				realm: 'test-realm',
			});
		});
	});
});
