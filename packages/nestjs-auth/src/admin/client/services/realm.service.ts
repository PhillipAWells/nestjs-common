import type { RealmRepresentation } from '../types/index.js';
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
	public async list(): Promise<RealmRepresentation[]> {
		this.requireScope('realms:read');
		try {
			return (await this.withRetry(() => this.adminClient.realms.find())) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a realm by name
	 */
	public async get(realm: string): Promise<RealmRepresentation> {
		this.requireScope('realms:read');
		try {
			return (await this.withRetry(() =>
				this.adminClient.realms.findOne({ realm }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a new realm
	 */
	public async create(realm: RealmRepresentation): Promise<void> {
		this.requireScope('realms:write');
		try {
			await this.withRetry(() => this.adminClient.realms.create(realm));
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Update a realm
	 */
	public async update(realmName: string, realm: RealmRepresentation): Promise<void> {
		this.requireScope('realms:write');
		try {
			await this.withRetry(() =>
				this.adminClient.realms.update({ realm: realmName }, realm),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Delete a realm
	 */
	public async delete(realm: string): Promise<void> {
		this.requireScope('realms:write');
		try {
			await this.withRetry(() => this.adminClient.realms.del({ realm }));
		} catch (error) {
			this.handleError(error);
		}
	}
}
