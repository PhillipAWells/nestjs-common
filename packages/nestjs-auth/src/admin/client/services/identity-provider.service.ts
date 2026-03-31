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
	public async List(realm: string): Promise<IIdentityProviderRepresentation[]> {
		this.RequireScope('identity-providers:read');
		try {
			return (await this.WithRetry(() =>
				this.AdminClient.identityProviders.find({ realm }),
			)) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Get an identity provider by alias
	 */
	public async Get(realm: string, alias: string): Promise<IIdentityProviderRepresentation> {
		this.RequireScope('identity-providers:read');
		try {
			return (await this.WithRetry(() =>
				this.AdminClient.identityProviders.findOne({ realm, alias }),
			)) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Create a new identity provider
	 */
	public async Create(realm: string, idp: IIdentityProviderRepresentation): Promise<void> {
		this.RequireScope('identity-providers:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.identityProviders.create({ ...idp, realm }),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Update an identity provider
	 */
	public async Update(
		realm: string,
		alias: string,
		idp: IIdentityProviderRepresentation,
	): Promise<void> {
		this.RequireScope('identity-providers:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.identityProviders.update({ realm, alias }, idp),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Delete an identity provider
	 */
	public async Delete(realm: string, alias: string): Promise<void> {
		this.RequireScope('identity-providers:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.identityProviders.del({ realm, alias }),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}
}
