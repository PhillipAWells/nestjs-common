import { ConflictError } from '../errors/index.js';
import { BaseService } from './base-service.js';

/**
 * Federated identity link representation
 */
export interface IFederatedIdentityLink {
	identityProvider: string;
	userId: string;
	userName: string;
}

/**
 * Federated Identity Service
 *
 * Wraps the Keycloak Admin API for managing federated identity links.
 * Federated identities allow users to link external identity providers (e.g., GitHub, Google, OIDC)
 * to their Keycloak account.
 *
 * Uses internal deduplication to prevent duplicate links (see workaround for Keycloak issue #34608).
 *
 * @example
 * ```typescript
 * const links = await keycloakAdmin.federatedIdentity.list(userId);
 * await keycloakAdmin.federatedIdentity.link(userId, 'github', {
 *   userId: 'github-user-123',
 *   userName: 'john_doe'
 * });
 * ```
 */
export class FederatedIdentityService extends BaseService {
	/**
	 * List all federated identity links for a user
	 *
	 * Retrieves all external identity provider links associated with a Keycloak user.
	 * Uses the Keycloak Admin API endpoint: `GET /admin/realms/{realm}/users/{id}/federated-identity`
	 *
	 * @param userId - The Keycloak user ID
	 * @returns Array of federated identity links (may be empty)
	 *
	 * @example
	 * ```typescript
	 * const links = await this.federatedIdentity.list('user-123');
	 * // [
	 * //   { identityProvider: 'github', userId: 'octocat', userName: 'octocat' },
	 * //   { identityProvider: 'google', userId: 'google-id', userName: 'john@example.com' }
	 * // ]
	 * ```
	 */
	public async List(userId: string): Promise<IFederatedIdentityLink[]> {
		this.RequireScope('federated-identity:read');
		try {
			return (await this.WithRetry(() =>
				this.AdminClient.users.listFederatedIdentities({ id: userId }),
			)) as IFederatedIdentityLink[];
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Link a federated identity to a user
	 *
	 * Associates an external identity provider account with a Keycloak user.
	 * Includes internal deduplication check to prevent duplicate links (workaround for Keycloak issue #34608).
	 *
	 * Throws `ConflictError` if a link with the same provider and user ID already exists.
	 *
	 * Note: This method requires both `federated-identity:write` and `federated-identity:read` scopes.
	 * The read scope is needed for the internal check performed by {@link List}.
	 *
	 * @param userId - The Keycloak user ID to link to
	 * @param provider - The identity provider name (e.g., 'github', 'google', 'keycloak-oidc')
	 * @param link - The external identity details (userId and userName from the external provider)
	 * @throws {ConflictError} If a link with this provider and userId already exists
	 *
	 * @example
	 * ```typescript
	 * await this.federatedIdentity.link('user-123', 'github', {
	 *   userId: 'octocat',
	 *   userName: 'octocat'
	 * });
	 * ```
	 */
	public async Link(
		userId: string,
		provider: string,
		link: Omit<IFederatedIdentityLink, 'identityProvider'>,
	): Promise<void> {
		this.RequireScope('federated-identity:write');
		try {
			// Check for existing link with same provider and userId to prevent Keycloak #34608
			const ExistingLinks = await this.List(userId);
			const ConflictingLink = ExistingLinks.find(
				(l) => l.identityProvider === provider && l.userId === link.userId,
			);

			if (ConflictingLink) {
				throw new ConflictError(
					`Federated identity link already exists: provider=${provider}, userId=${link.userId}`,
				);
			}

			await this.WithRetry(() =>
				this.AdminClient.users.addToFederatedIdentity({
					id: userId,
					federatedIdentityId: provider,
					federatedIdentity: {
						identityProvider: provider,
						userId: link.userId,
						userName: link.userName,
					},
				}),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Unlink a federated identity from a user
	 *
	 * Removes an external identity provider link from a Keycloak user.
	 * After unlinking, the user can no longer authenticate via that provider.
	 *
	 * @param userId - The Keycloak user ID
	 * @param provider - The identity provider name to remove
	 *
	 * @example
	 * ```typescript
	 * await this.federatedIdentity.unlink('user-123', 'github');
	 * ```
	 */
	public async Unlink(userId: string, provider: string): Promise<void> {
		this.RequireScope('federated-identity:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.users.delFromFederatedIdentity({ id: userId, federatedIdentityId: provider }),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}
}
