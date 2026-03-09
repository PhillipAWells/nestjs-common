import type {
	AuthenticationFlowRepresentation,
	AuthenticationExecutionInfoRepresentation,
} from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak authentication flows
 */
export class AuthenticationService extends BaseService {
	/**
	 * Get all authentication flows
	 */
	async getFlows(realm: string): Promise<AuthenticationFlowRepresentation[]> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.authenticationManagement.getFlows({ realm }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a specific authentication flow
	 */
	async getFlow(realm: string, flowId: string): Promise<AuthenticationFlowRepresentation> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.authenticationManagement.getFlow({ realm, flowId }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create an authentication flow
	 */
	async createFlow(
		realm: string,
		flow: AuthenticationFlowRepresentation,
	): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.authenticationManagement.createFlow({ ...flow, realm }),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete an authentication flow
	 */
	async deleteFlow(realm: string, flowId: string): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.authenticationManagement.deleteFlow({ realm, flowId }),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get executions for a flow
	 */
	async getExecutions(
		realm: string,
		flowAlias: string,
	): Promise<AuthenticationExecutionInfoRepresentation[]> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.authenticationManagement.getExecutions({ realm, flow: flowAlias }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Add an execution to a flow
	 */
	async createExecution(
		realm: string,
		flowAlias: string,
		execution: { provider: string },
	): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.authenticationManagement.addExecution(
					{ realm, flow: flowAlias },
					execution as any,
				),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}
}
