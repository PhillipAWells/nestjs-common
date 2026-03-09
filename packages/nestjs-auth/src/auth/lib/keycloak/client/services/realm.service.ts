import type { RealmRepresentation } from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak realms
 */
export class RealmService extends BaseService {
	/**
	 * List all realms
	 */
	async list(): Promise<RealmRepresentation[]> {
		try {
			return (await this.withRetry(async () => this.adminClient.realms.find())) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a realm by name
	 */
	async get(realm: string): Promise<RealmRepresentation> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.realms.findOne({ realm }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a new realm
	 */
	async create(realm: RealmRepresentation): Promise<void> {
		try {
			await this.withRetry(async () => this.adminClient.realms.create(realm));
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Update a realm
	 */
	async update(realmName: string, realm: RealmRepresentation): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.realms.update({ realm: realmName }, realm),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete a realm
	 */
	async delete(realm: string): Promise<void> {
		try {
			await this.withRetry(async () => this.adminClient.realms.del({ realm }));
		} catch (error) {
			return this.handleError(error);
		}
	}
}
