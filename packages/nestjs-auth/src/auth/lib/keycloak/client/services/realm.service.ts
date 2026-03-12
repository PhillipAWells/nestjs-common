import type { RealmRepresentation } from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak realms
 */
export class RealmService extends BaseService {
	/**
	 * List all realms
	 */
	public async list(): Promise<RealmRepresentation[]> {
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
		try {
			await this.withRetry(() => this.adminClient.realms.del({ realm }));
		} catch (error) {
			this.handleError(error);
		}
	}
}
