import type {
	AuthenticationFlowRepresentation,
	AuthenticationExecutionInfoRepresentation,
} from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak authentication flows.
 *
 * Provides methods for querying and managing authentication flow configurations. Authentication flows
 * define the steps users must complete to authenticate (e.g., username/password, MFA, social login).
 * Flows can be customized by adding, removing, or reordering authenticators.
 * Requires `authentication:read` and `authentication:write` scopes depending on the operation.
 *
 * Part of {@link KeycloakAdminService.authentication | KeycloakAdminService#authentication}.
 *
 * @example
 * ```typescript
 * const flows = await keycloak.authentication.getFlows('my-realm');
 * const flow = await keycloak.authentication.getFlow('my-realm', 'flow-id');
 * await keycloak.authentication.createFlow('my-realm', {
 *   alias: 'my-flow',
 *   description: 'Custom auth flow',
 *   builtIn: false,
 *   providerId: 'basic-flow',
 *   topLevel: true,
 * });
 * ```
 */
export class AuthenticationService extends BaseService {
	/**
	 * Get all authentication flows
	 */
	public async getFlows(realm: string): Promise<AuthenticationFlowRepresentation[]> {
		this.requireScope('authentication:read');
		try {
			return (await this.withRetry(() =>
				this.adminClient.authenticationManagement.getFlows({ realm }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a specific authentication flow
	 */
	public async getFlow(realm: string, flowId: string): Promise<AuthenticationFlowRepresentation> {
		this.requireScope('authentication:read');
		try {
			return (await this.withRetry(() =>
				this.adminClient.authenticationManagement.getFlow({ realm, flowId }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create an authentication flow
	 */
	public async createFlow(
		realm: string,
		flow: AuthenticationFlowRepresentation,
	): Promise<void> {
		this.requireScope('authentication:write');
		try {
			await this.withRetry(() =>
				this.adminClient.authenticationManagement.createFlow({ ...flow, realm }),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Delete an authentication flow
	 */
	public async deleteFlow(realm: string, flowId: string): Promise<void> {
		this.requireScope('authentication:write');
		try {
			await this.withRetry(() =>
				this.adminClient.authenticationManagement.deleteFlow({ realm, flowId }),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Get executions for a flow
	 */
	public async getExecutions(
		realm: string,
		flowAlias: string,
	): Promise<AuthenticationExecutionInfoRepresentation[]> {
		this.requireScope('authentication:read');
		try {
			return (await this.withRetry(() =>
				this.adminClient.authenticationManagement.getExecutions({ realm, flow: flowAlias }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Add an execution to a flow
	 */
	public async createExecution(
		realm: string,
		flowAlias: string,
		execution: { provider: string },
	): Promise<void> {
		this.requireScope('authentication:write');
		try {
			await this.withRetry(() =>
				this.adminClient.authenticationManagement.addExecution(
					{ realm, flow: flowAlias },
					execution as any,
				),
			);
		} catch (error) {
			this.handleError(error);
		}
	}
}
