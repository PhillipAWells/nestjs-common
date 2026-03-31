import type {
	IAuthenticationFlowRepresentation,
	IAuthenticationExecutionInfoRepresentation,
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
	public async GetFlows(realm: string): Promise<IAuthenticationFlowRepresentation[]> {
		this.RequireScope('authentication:read');
		try {
			return (await this.WithRetry(() =>
				this.AdminClient.authenticationManagement.getFlows({ realm }),
			)) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Get a specific authentication flow
	 */
	public async GetFlow(realm: string, flowId: string): Promise<IAuthenticationFlowRepresentation> {
		this.RequireScope('authentication:read');
		try {
			return (await this.WithRetry(() =>
				this.AdminClient.authenticationManagement.getFlow({ realm, flowId }),
			)) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Create an authentication flow
	 */
	public async CreateFlow(
		realm: string,
		flow: IAuthenticationFlowRepresentation,
	): Promise<void> {
		this.RequireScope('authentication:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.authenticationManagement.createFlow({ ...flow, realm }),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Delete an authentication flow
	 */
	public async DeleteFlow(realm: string, flowId: string): Promise<void> {
		this.RequireScope('authentication:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.authenticationManagement.deleteFlow({ realm, flowId }),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Get executions for a flow
	 */
	public async GetExecutions(
		realm: string,
		flowAlias: string,
	): Promise<IAuthenticationExecutionInfoRepresentation[]> {
		this.RequireScope('authentication:read');
		try {
			return (await this.WithRetry(() =>
				this.AdminClient.authenticationManagement.getExecutions({ realm, flow: flowAlias }),
			)) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Add an execution to a flow
	 */
	public async CreateExecution(
		realm: string,
		flowAlias: string,
		execution: { provider: string },
	): Promise<void> {
		this.RequireScope('authentication:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.authenticationManagement.addExecution(
					{ realm, flow: flowAlias },
					execution as any,
				),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}
}
