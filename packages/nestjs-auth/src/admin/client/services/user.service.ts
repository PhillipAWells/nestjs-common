import type {
	UserRepresentation,
	UserQuery,
	CredentialRepresentation,
	RoleRepresentation,
} from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak users.
 *
 * Provides methods for CRUD operations on Keycloak users, including user creation,
 * role assignment, group membership, and credential management. Requires `users:read`
 * and `users:write` scopes depending on the operation.
 *
 * Part of {@link KeycloakAdminService.users | KeycloakAdminService#users}.
 *
 * @example
 * ```typescript
 * const users = await keycloak.users.list('my-realm');
 * await keycloak.users.create('my-realm', {
 *   email: 'user@example.com',
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   enabled: true,
 * });
 * ```
 */
export class UserService extends BaseService {
	/**
	 * List users in a realm
	 */
	public async list(realm: string, query?: UserQuery): Promise<UserRepresentation[]> {
		this.requireScope('users:read');
		try {
			return (await this.withRetry(() =>
				this.adminClient.users.find({ ...query, realm }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a user by ID
	 */
	public async get(realm: string, userId: string): Promise<UserRepresentation> {
		this.requireScope('users:read');
		try {
			return (await this.withRetry(() =>
				this.adminClient.users.findOne({ realm, id: userId }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a new user
	 */
	public async create(realm: string, user: UserRepresentation): Promise<{ id: string }> {
		this.requireScope('users:write');
		try {
			return await this.withRetry(() =>
				this.adminClient.users.create({ ...user, realm }),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Update a user
	 */
	public async update(realm: string, userId: string, user: UserRepresentation): Promise<void> {
		this.requireScope('users:write');
		try {
			await this.withRetry(() =>
				this.adminClient.users.update({ realm, id: userId }, user),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Delete a user
	 */
	public async delete(realm: string, userId: string): Promise<void> {
		this.requireScope('users:write');
		try {
			await this.withRetry(() =>
				this.adminClient.users.del({ realm, id: userId }),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Reset a user's password
	 */
	public async resetPassword(
		realm: string,
		userId: string,
		credential: CredentialRepresentation,
	): Promise<void> {
		this.requireScope('users:write');
		try {
			await this.withRetry(() =>
				this.adminClient.users.resetPassword({
					realm,
					id: userId,
					credential,
				}),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Add realm roles to a user
	 */
	public async addRealmRoles(
		realm: string,
		userId: string,
		roles: RoleRepresentation[],
	): Promise<void> {
		this.requireScope('users:write');
		try {
			await this.withRetry(() =>
				this.adminClient.users.addRealmRoleMappings({
					realm,
					id: userId,
					roles: roles as any,
				}),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Get realm roles for a user
	 */
	public async getRealmRoles(realm: string, userId: string): Promise<RoleRepresentation[]> {
		this.requireScope('users:read');
		try {
			return (await this.withRetry(() =>
				this.adminClient.users.listRealmRoleMappings({ realm, id: userId }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete realm roles from a user
	 */
	public async deleteRealmRoles(
		realm: string,
		userId: string,
		roles: RoleRepresentation[],
	): Promise<void> {
		this.requireScope('users:write');
		try {
			await this.withRetry(() =>
				this.adminClient.users.delRealmRoleMappings({
					realm,
					id: userId,
					roles: roles as any,
				}),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Add client roles to a user
	 */
	public async addClientRoles(
		realm: string,
		userId: string,
		clientId: string,
		roles: RoleRepresentation[],
	): Promise<void> {
		this.requireScope('users:write');
		try {
			await this.withRetry(() =>
				this.adminClient.users.addClientRoleMappings({
					realm,
					id: userId,
					clientUniqueId: clientId,
					roles: roles as any,
				}),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Get client roles for a user
	 */
	public async getClientRoles(
		realm: string,
		userId: string,
		clientId: string,
	): Promise<RoleRepresentation[]> {
		this.requireScope('users:read');
		try {
			return (await this.withRetry(() =>
				this.adminClient.users.listClientRoleMappings({
					realm,
					id: userId,
					clientUniqueId: clientId,
				}),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete client roles from a user
	 */
	public async deleteClientRoles(
		realm: string,
		userId: string,
		clientId: string,
		roles: RoleRepresentation[],
	): Promise<void> {
		this.requireScope('users:write');
		try {
			await this.withRetry(() =>
				this.adminClient.users.delClientRoleMappings({
					realm,
					id: userId,
					clientUniqueId: clientId,
					roles: roles as any,
				}),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Find a user by their federated identity (external provider ID).
	 * Useful for adapter microservices looking up users by Steam ID, Nintendo ID, etc.
	 * Returns null if no user is found.
	 *
	 * @param idpAlias - The identity provider alias configured in Keycloak (e.g. 'steam')
	 * @param idpUserId - The user's ID at the external provider
	 */
	public async findByFederatedIdentity(
		idpAlias: string,
		idpUserId: string,
	): Promise<UserRepresentation | null> {
		this.requireScope('users:read');
		try {
			const results = (await this.withRetry(() =>
				this.adminClient.users.find({
					idpAlias,
					idpUserId,
					exact: true,
				}),
			)) as UserRepresentation[];

			return results[0] ?? null;
		} catch (error) {
			return this.handleError(error);
		}
	}
}
