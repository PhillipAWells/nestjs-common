import type {
	IUserRepresentation,
	IUserQuery,
	ICredentialRepresentation,
	IRoleRepresentation,
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
	public async list(realm: string, query?: IUserQuery): Promise<IUserRepresentation[]> {
		this.requireScope('users:read');
		try {
			return (await this.withRetry(() =>
				this.AdminClient.users.find({ ...query, realm }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a user by ID
	 */
	public async get(realm: string, userId: string): Promise<IUserRepresentation> {
		this.requireScope('users:read');
		try {
			return (await this.withRetry(() =>
				this.AdminClient.users.findOne({ realm, id: userId }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a new user
	 */
	public async create(realm: string, user: IUserRepresentation): Promise<{ id: string }> {
		this.requireScope('users:write');
		try {
			return await this.withRetry(() =>
				this.AdminClient.users.create({ ...user, realm }),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Update a user
	 */
	public async update(realm: string, userId: string, user: IUserRepresentation): Promise<void> {
		this.requireScope('users:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.users.update({ realm, id: userId }, user),
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
				this.AdminClient.users.del({ realm, id: userId }),
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
		credential: ICredentialRepresentation,
	): Promise<void> {
		this.requireScope('users:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.users.resetPassword({
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
		roles: IRoleRepresentation[],
	): Promise<void> {
		this.requireScope('users:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.users.addRealmRoleMappings({
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
	public async getRealmRoles(realm: string, userId: string): Promise<IRoleRepresentation[]> {
		this.requireScope('users:read');
		try {
			return (await this.withRetry(() =>
				this.AdminClient.users.listRealmRoleMappings({ realm, id: userId }),
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
		roles: IRoleRepresentation[],
	): Promise<void> {
		this.requireScope('users:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.users.delRealmRoleMappings({
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
		roles: IRoleRepresentation[],
	): Promise<void> {
		this.requireScope('users:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.users.addClientRoleMappings({
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
	): Promise<IRoleRepresentation[]> {
		this.requireScope('users:read');
		try {
			return (await this.withRetry(() =>
				this.AdminClient.users.listClientRoleMappings({
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
		roles: IRoleRepresentation[],
	): Promise<void> {
		this.requireScope('users:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.users.delClientRoleMappings({
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
	): Promise<IUserRepresentation | null> {
		this.requireScope('users:read');
		try {
			const results = (await this.withRetry(() =>
				this.AdminClient.users.find({
					idpAlias,
					idpUserId,
					exact: true,
				}),
			)) as IUserRepresentation[];

			return results[0] ?? null;
		} catch (error) {
			return this.handleError(error);
		}
	}
}
