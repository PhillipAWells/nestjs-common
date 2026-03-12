import type { IdentityProviderRepresentation } from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak identity providers
 */
export class IdentityProviderService extends BaseService {
	/**
	 * List all identity providers in a realm
	 */
	public async list(realm: string): Promise<IdentityProviderRepresentation[]> {
		try {
			return (await this.withRetry(() =>
				this.adminClient.identityProviders.find({ realm }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get an identity provider by alias
	 */
	public async get(realm: string, alias: string): Promise<IdentityProviderRepresentation> {
		try {
			return (await this.withRetry(() =>
				this.adminClient.identityProviders.findOne({ realm, alias }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a new identity provider
	 */
	public async create(realm: string, idp: IdentityProviderRepresentation): Promise<void> {
		try {
			await this.withRetry(() =>
				this.adminClient.identityProviders.create({ ...idp, realm }),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Update an identity provider
	 */
	public async update(
		realm: string,
		alias: string,
		idp: IdentityProviderRepresentation,
	): Promise<void> {
		try {
			await this.withRetry(() =>
				this.adminClient.identityProviders.update({ realm, alias }, idp),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Delete an identity provider
	 */
	public async delete(realm: string, alias: string): Promise<void> {
		try {
			await this.withRetry(() =>
				this.adminClient.identityProviders.del({ realm, alias }),
			);
		} catch (error) {
			this.handleError(error);
		}
	}
}
