import type { IdentityProviderRepresentation } from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak identity providers
 */
export class IdentityProviderService extends BaseService {
	/**
	 * List all identity providers in a realm
	 */
	async list(realm: string): Promise<IdentityProviderRepresentation[]> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.identityProviders.find({ realm })
			)) as any;
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get an identity provider by alias
	 */
	async get(realm: string, alias: string): Promise<IdentityProviderRepresentation> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.identityProviders.findOne({ realm, alias })
			)) as any;
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a new identity provider
	 */
	async create(realm: string, idp: IdentityProviderRepresentation): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.identityProviders.create({ ...idp, realm })
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Update an identity provider
	 */
	async update(
		realm: string,
		alias: string,
		idp: IdentityProviderRepresentation
	): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.identityProviders.update({ realm, alias }, idp)
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete an identity provider
	 */
	async delete(realm: string, alias: string): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.identityProviders.del({ realm, alias })
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}
}
