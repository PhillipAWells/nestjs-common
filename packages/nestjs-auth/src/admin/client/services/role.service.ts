import type { IRoleRepresentation } from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak roles.
 *
 * Provides methods for creating, listing, and deleting both realm-wide and client-specific roles.
 * Realm roles are shared across all clients in the realm, while client roles are scoped to a single client.
 * Requires `roles:read` and `roles:write` scopes depending on the operation.
 *
 * Part of {@link KeycloakAdminService.roles | KeycloakAdminService#roles}.
 *
 * @example
 * ```typescript
 * const roles = await keycloak.roles.listRealm('my-realm');
 * const adminRole = await keycloak.roles.getByName('my-realm', 'admin');
 * await keycloak.roles.create('my-realm', { name: 'editor', enabled: true });
 * ```
 */
export class RoleService extends BaseService {
	/**
	 * List all realm roles
	 */
	public async listRealm(realm: string): Promise<IRoleRepresentation[]> {
		this.requireScope('roles:read');
		try {
			return (await this.withRetry(() => this.AdminClient.roles.find({ realm }))) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * List client roles
	 */
	public async listClient(realm: string, clientId: string): Promise<IRoleRepresentation[]> {
		this.requireScope('roles:read');
		try {
			return (await this.withRetry(() =>
				this.AdminClient.clients.listRoles({ realm, id: clientId }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a realm role by name
	 */
	public async getByName(realm: string, name: string): Promise<IRoleRepresentation> {
		this.requireScope('roles:read');
		try {
			return (await this.withRetry(() =>
				this.AdminClient.roles.findOneByName({ realm, name }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a realm role
	 */
	public async create(realm: string, role: IRoleRepresentation): Promise<void> {
		this.requireScope('roles:write');
		try {
			await this.withRetry(() => this.AdminClient.roles.create({ ...role, realm }));
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Update a realm role
	 */
	public async update(realm: string, name: string, role: IRoleRepresentation): Promise<void> {
		this.requireScope('roles:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.roles.updateByName({ realm, name }, role),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Delete a realm role
	 */
	public async delete(realm: string, name: string): Promise<void> {
		this.requireScope('roles:write');
		try {
			await this.withRetry(() => this.AdminClient.roles.delByName({ realm, name }));
		} catch (error) {
			this.handleError(error);
		}
	}
}
