import { describe, it, expect, beforeEach, vi } from 'vitest';
import type KcAdminClient from '@keycloak/keycloak-admin-client';
import { AuthenticationService } from '../authentication.service.js';
import { KeycloakAdminScopeError } from '../../../permissions/keycloak-admin.permissions.js';
import type { KeycloakAdminScope } from '../../../permissions/keycloak-admin.permissions.js';

describe('AuthenticationService', () => {
	let service: AuthenticationService;
	let mockAdminClient: any;
	let allScopes: Set<KeycloakAdminScope>;
	let readOnlyScopes: Set<KeycloakAdminScope>;
	let noScopes: Set<KeycloakAdminScope>;

	beforeEach(() => {
		mockAdminClient = {
			authenticationManagement: {
				getFlows: vi.fn(),
				getFlow: vi.fn(),
				createFlow: vi.fn(),
				deleteFlow: vi.fn(),
				getExecutions: vi.fn(),
				addExecution: vi.fn(),
			},
		} as unknown as KcAdminClient;

		allScopes = new Set(['authentication:read', 'authentication:write'] as KeycloakAdminScope[]);
		readOnlyScopes = new Set(['authentication:read'] as KeycloakAdminScope[]);
		noScopes = new Set([] as KeycloakAdminScope[]);
	});

	describe('getFlows', () => {
		it('throws KeycloakAdminScopeError when authentication:read scope is not granted', async () => {
			service = new AuthenticationService(mockAdminClient, noScopes);
			await expect(service.getFlows('realm')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.authenticationManagement.getFlows).not.toHaveBeenCalled();
		});

		it('calls adminClient.authenticationManagement.getFlows when authentication:read scope is granted', async () => {
			mockAdminClient.authenticationManagement.getFlows.mockResolvedValue([
				{ id: 'flow1', alias: 'browser' },
			]);
			service = new AuthenticationService(mockAdminClient, readOnlyScopes);
			const result = await service.getFlows('realm');
			expect(result).toEqual([{ id: 'flow1', alias: 'browser' }]);
			expect(mockAdminClient.authenticationManagement.getFlows).toHaveBeenCalledWith({
				realm: 'realm',
			});
		});

		it('returns empty array when no flows found', async () => {
			mockAdminClient.authenticationManagement.getFlows.mockResolvedValue([]);
			service = new AuthenticationService(mockAdminClient, readOnlyScopes);
			const result = await service.getFlows('realm');
			expect(result).toEqual([]);
		});
	});

	describe('getFlow', () => {
		it('throws KeycloakAdminScopeError when authentication:read scope is not granted', async () => {
			service = new AuthenticationService(mockAdminClient, noScopes);
			await expect(service.getFlow('realm', 'flow-id')).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.authenticationManagement.getFlow).not.toHaveBeenCalled();
		});

		it('calls adminClient.authenticationManagement.getFlow when authentication:read scope is granted', async () => {
			mockAdminClient.authenticationManagement.getFlow.mockResolvedValue({
				id: 'flow-id',
				alias: 'browser',
			});
			service = new AuthenticationService(mockAdminClient, readOnlyScopes);
			const result = await service.getFlow('realm', 'flow-id');
			expect(result).toEqual({ id: 'flow-id', alias: 'browser' });
			expect(mockAdminClient.authenticationManagement.getFlow).toHaveBeenCalledWith({
				realm: 'realm',
				flowId: 'flow-id',
			});
		});
	});

	describe('createFlow', () => {
		it('throws KeycloakAdminScopeError when authentication:write scope is not granted', async () => {
			service = new AuthenticationService(mockAdminClient, readOnlyScopes);
			const flow = { alias: 'custom-flow' };
			await expect(service.createFlow('realm', flow)).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.authenticationManagement.createFlow).not.toHaveBeenCalled();
		});

		it('calls adminClient.authenticationManagement.createFlow when authentication:write scope is granted', async () => {
			mockAdminClient.authenticationManagement.createFlow.mockResolvedValue(undefined);
			service = new AuthenticationService(mockAdminClient, allScopes);
			const flow = { alias: 'custom-flow' };
			await service.createFlow('realm', flow);
			expect(mockAdminClient.authenticationManagement.createFlow).toHaveBeenCalledWith({
				realm: 'realm',
				alias: 'custom-flow',
			});
		});
	});

	describe('deleteFlow', () => {
		it('throws KeycloakAdminScopeError when authentication:write scope is not granted', async () => {
			service = new AuthenticationService(mockAdminClient, readOnlyScopes);
			await expect(service.deleteFlow('realm', 'flow-id')).rejects.toThrow(
				KeycloakAdminScopeError,
			);
			expect(mockAdminClient.authenticationManagement.deleteFlow).not.toHaveBeenCalled();
		});

		it('calls adminClient.authenticationManagement.deleteFlow when authentication:write scope is granted', async () => {
			mockAdminClient.authenticationManagement.deleteFlow.mockResolvedValue(undefined);
			service = new AuthenticationService(mockAdminClient, allScopes);
			await service.deleteFlow('realm', 'flow-id');
			expect(mockAdminClient.authenticationManagement.deleteFlow).toHaveBeenCalledWith({
				realm: 'realm',
				flowId: 'flow-id',
			});
		});
	});

	describe('getExecutions', () => {
		it('throws KeycloakAdminScopeError when authentication:read scope is not granted', async () => {
			service = new AuthenticationService(mockAdminClient, noScopes);
			await expect(service.getExecutions('realm', 'browser')).rejects.toThrow(
				KeycloakAdminScopeError,
			);
			expect(mockAdminClient.authenticationManagement.getExecutions).not.toHaveBeenCalled();
		});

		it('calls adminClient.authenticationManagement.getExecutions when authentication:read scope is granted', async () => {
			mockAdminClient.authenticationManagement.getExecutions.mockResolvedValue([
				{ id: 'exec1', providerId: 'auth-cookie' },
			]);
			service = new AuthenticationService(mockAdminClient, readOnlyScopes);
			const result = await service.getExecutions('realm', 'browser');
			expect(result).toEqual([{ id: 'exec1', providerId: 'auth-cookie' }]);
			expect(mockAdminClient.authenticationManagement.getExecutions).toHaveBeenCalledWith({
				realm: 'realm',
				flow: 'browser',
			});
		});

		it('returns empty array when no executions found', async () => {
			mockAdminClient.authenticationManagement.getExecutions.mockResolvedValue([]);
			service = new AuthenticationService(mockAdminClient, readOnlyScopes);
			const result = await service.getExecutions('realm', 'browser');
			expect(result).toEqual([]);
		});
	});

	describe('createExecution', () => {
		it('throws KeycloakAdminScopeError when authentication:write scope is not granted', async () => {
			service = new AuthenticationService(mockAdminClient, readOnlyScopes);
			const execution = { provider: 'auth-cookie' };
			await expect(
				service.createExecution('realm', 'browser', execution),
			).rejects.toThrow(KeycloakAdminScopeError);
			expect(mockAdminClient.authenticationManagement.addExecution).not.toHaveBeenCalled();
		});

		it('calls adminClient.authenticationManagement.addExecution when authentication:write scope is granted', async () => {
			mockAdminClient.authenticationManagement.addExecution.mockResolvedValue(undefined);
			service = new AuthenticationService(mockAdminClient, allScopes);
			const execution = { provider: 'auth-cookie' };
			await service.createExecution('realm', 'browser', execution);
			expect(mockAdminClient.authenticationManagement.addExecution).toHaveBeenCalledWith(
				{ realm: 'realm', flow: 'browser' },
				execution,
			);
		});
	});
});
