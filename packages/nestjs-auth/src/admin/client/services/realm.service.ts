import type { IRealmRepresentation } from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak realms.
 *
 * Provides methods for querying and updating realm-level configuration, including realm properties,
 * security policy, login settings, and event configuration. Requires `realms:read` and `realms:write`
 * scopes depending on the operation.
 *
 * Part of {@link KeycloakAdminService.realms | KeycloakAdminService#realms}.
 *
 * @example
 * ```typescript
 * const realm = await keycloak.realms.get('my-realm');
 * const realms = await keycloak.realms.list();
 * await keycloak.realms.update('my-realm', { accessTokenLifespan: 3600 });
 * ```
 */
export class RealmService extends BaseService {
	/**
	 * List all realms
	 */
	public async List(): Promise<IRealmRepresentation[]> {
		this.RequireScope('realms:read');
		try {
			return (await this.WithRetry(() => this.AdminClient.realms.find())) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Get a realm by name
	 */
	public async Get(realm: string): Promise<IRealmRepresentation> {
		this.RequireScope('realms:read');
		try {
			return (await this.WithRetry(() =>
				this.AdminClient.realms.findOne({ realm }),
			)) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Create a new realm
	 */
	public async Create(realm: IRealmRepresentation): Promise<void> {
		this.RequireScope('realms:write');
		try {
			await this.WithRetry(() => this.AdminClient.realms.create(realm));
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Update a realm
	 */
	public async Update(realmName: string, realm: IRealmRepresentation): Promise<void> {
		this.RequireScope('realms:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.realms.update({ realm: realmName }, realm),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Delete a realm
	 */
	public async Delete(realm: string): Promise<void> {
		this.RequireScope('realms:write');
		try {
			await this.WithRetry(() => this.AdminClient.realms.del({ realm }));
		} catch (error) {
			this.HandleError(error);
		}
	}
}
