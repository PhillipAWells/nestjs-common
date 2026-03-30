import type { IIdentityProviderRepresentation } from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak identity providers.
 *
 * Provides methods for configuring external identity providers (e.g., social login, SAML, OIDC).
 * Identity providers enable federated authentication — users can log in via external identity systems
 * that are then linked to Keycloak accounts. Requires `identity-providers:read` and
 * `identity-providers:write` scopes depending on the operation.
 *
 * Part of {@link KeycloakAdminService.identityProviders | KeycloakAdminService#identityProviders}.
 *
 * @example
 * ```typescript
 * const idps = await keycloak.identityProviders.list('my-realm');
 * const googleIdp = await keycloak.identityProviders.get('my-realm', 'google');
 * await keycloak.identityProviders.create('my-realm', {
 *   alias: 'github',
 *   providerId: 'github',
 *   enabled: true,
 *   config: { clientId: '...', clientSecret: '...' },
 * });
 * ```
 */
export class IdentityProviderService extends BaseService {
	/**
	 * List all identity providers in a realm
	 */
	public async list(realm: string): Promise<IIdentityProviderRepresentation[]> {
		this.requireScope('identity-providers:read');
		try {
			return (await this.withRetry(() =>
				this.AdminClient.identityProviders.find({ realm }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get an identity provider by alias
	 */
	public async get(realm: string, alias: string): Promise<IIdentityProviderRepresentation> {
		this.requireScope('identity-providers:read');
		try {
			return (await this.withRetry(() =>
				this.AdminClient.identityProviders.findOne({ realm, alias }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a new identity provider
	 */
	public async create(realm: string, idp: IIdentityProviderRepresentation): Promise<void> {
		this.requireScope('identity-providers:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.identityProviders.create({ ...idp, realm }),
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
		idp: IIdentityProviderRepresentation,
	): Promise<void> {
		this.requireScope('identity-providers:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.identityProviders.update({ realm, alias }, idp),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Delete an identity provider
	 */
	public async delete(realm: string, alias: string): Promise<void> {
		this.requireScope('identity-providers:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.identityProviders.del({ realm, alias }),
			);
		} catch (error) {
			this.handleError(error);
		}
	}
}
