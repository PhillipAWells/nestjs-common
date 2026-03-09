import type { RoleRepresentation } from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak roles
 */
export class RoleService extends BaseService {
	/**
	 * List all realm roles
	 */
	async listRealm(realm: string): Promise<RoleRepresentation[]> {
		try {
			return (await this.withRetry(async () => this.adminClient.roles.find({ realm }))) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * List client roles
	 */
	async listClient(realm: string, clientId: string): Promise<RoleRepresentation[]> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.clients.listRoles({ realm, id: clientId }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a realm role by name
	 */
	async getByName(realm: string, name: string): Promise<RoleRepresentation> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.roles.findOneByName({ realm, name }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a realm role
	 */
	async create(realm: string, role: RoleRepresentation): Promise<void> {
		try {
			await this.withRetry(async () => this.adminClient.roles.create({ ...role, realm }));
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Update a realm role
	 */
	async update(realm: string, name: string, role: RoleRepresentation): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.roles.updateByName({ realm, name }, role),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete a realm role
	 */
	async delete(realm: string, name: string): Promise<void> {
		try {
			await this.withRetry(async () => this.adminClient.roles.delByName({ realm, name }));
		} catch (error) {
			return this.handleError(error);
		}
	}
}
