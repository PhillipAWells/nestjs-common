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
	public async ListRealm(realm: string): Promise<IRoleRepresentation[]> {
		this.RequireScope('roles:read');
		try {
			return (await this.WithRetry(() => this.AdminClient.roles.find({ realm }))) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * List client roles
	 */
	public async ListClient(realm: string, clientId: string): Promise<IRoleRepresentation[]> {
		this.RequireScope('roles:read');
		try {
			return (await this.WithRetry(() =>
				this.AdminClient.clients.listRoles({ realm, id: clientId }),
			)) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Get a realm role by name
	 */
	public async GetByName(realm: string, name: string): Promise<IRoleRepresentation> {
		this.RequireScope('roles:read');
		try {
			return (await this.WithRetry(() =>
				this.AdminClient.roles.findOneByName({ realm, name }),
			)) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Create a realm role
	 */
	public async Create(realm: string, role: IRoleRepresentation): Promise<void> {
		this.RequireScope('roles:write');
		try {
			await this.WithRetry(() => this.AdminClient.roles.create({ ...role, realm }));
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Update a realm role
	 */
	public async Update(realm: string, name: string, role: IRoleRepresentation): Promise<void> {
		this.RequireScope('roles:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.roles.updateByName({ realm, name }, role),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Delete a realm role
	 */
	public async Delete(realm: string, name: string): Promise<void> {
		this.RequireScope('roles:write');
		try {
			await this.WithRetry(() => this.AdminClient.roles.delByName({ realm, name }));
		} catch (error) {
			this.HandleError(error);
		}
	}
}
