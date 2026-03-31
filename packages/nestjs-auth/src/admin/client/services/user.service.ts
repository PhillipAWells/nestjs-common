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
	public async List(realm: string, query?: IUserQuery): Promise<IUserRepresentation[]> {
		this.RequireScope('users:read');
		try {
			return (await this.WithRetry(() =>
				this.AdminClient.users.find({ ...query, realm }),
			)) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Get a user by ID
	 */
	public async Get(realm: string, userId: string): Promise<IUserRepresentation> {
		this.RequireScope('users:read');
		try {
			return (await this.WithRetry(() =>
				this.AdminClient.users.findOne({ realm, id: userId }),
			)) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Create a new user
	 */
	public async Create(realm: string, user: IUserRepresentation): Promise<{ id: string }> {
		this.RequireScope('users:write');
		try {
			return await this.WithRetry(() =>
				this.AdminClient.users.create({ ...user, realm }),
			);
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Update a user
	 */
	public async Update(realm: string, userId: string, user: IUserRepresentation): Promise<void> {
		this.RequireScope('users:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.users.update({ realm, id: userId }, user),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Delete a user
	 */
	public async Delete(realm: string, userId: string): Promise<void> {
		this.RequireScope('users:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.users.del({ realm, id: userId }),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Reset a user's password
	 */
	public async ResetPassword(
		realm: string,
		userId: string,
		credential: ICredentialRepresentation,
	): Promise<void> {
		this.RequireScope('users:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.users.resetPassword({
					realm,
					id: userId,
					credential,
				}),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Add realm roles to a user
	 */
	public async AddRealmRoles(
		realm: string,
		userId: string,
		roles: IRoleRepresentation[],
	): Promise<void> {
		this.RequireScope('users:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.users.addRealmRoleMappings({
					realm,
					id: userId,
					roles: roles as any,
				}),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Get realm roles for a user
	 */
	public async GetRealmRoles(realm: string, userId: string): Promise<IRoleRepresentation[]> {
		this.RequireScope('users:read');
		try {
			return (await this.WithRetry(() =>
				this.AdminClient.users.listRealmRoleMappings({ realm, id: userId }),
			)) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Delete realm roles from a user
	 */
	public async DeleteRealmRoles(
		realm: string,
		userId: string,
		roles: IRoleRepresentation[],
	): Promise<void> {
		this.RequireScope('users:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.users.delRealmRoleMappings({
					realm,
					id: userId,
					roles: roles as any,
				}),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Add client roles to a user
	 */
	public async AddClientRoles(
		realm: string,
		userId: string,
		clientId: string,
		roles: IRoleRepresentation[],
	): Promise<void> {
		this.RequireScope('users:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.users.addClientRoleMappings({
					realm,
					id: userId,
					clientUniqueId: clientId,
					roles: roles as any,
				}),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Get client roles for a user
	 */
	public async GetClientRoles(
		realm: string,
		userId: string,
		clientId: string,
	): Promise<IRoleRepresentation[]> {
		this.RequireScope('users:read');
		try {
			return (await this.WithRetry(() =>
				this.AdminClient.users.listClientRoleMappings({
					realm,
					id: userId,
					clientUniqueId: clientId,
				}),
			)) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Delete client roles from a user
	 */
	public async DeleteClientRoles(
		realm: string,
		userId: string,
		clientId: string,
		roles: IRoleRepresentation[],
	): Promise<void> {
		this.RequireScope('users:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.users.delClientRoleMappings({
					realm,
					id: userId,
					clientUniqueId: clientId,
					roles: roles as any,
				}),
			);
		} catch (error) {
			this.HandleError(error);
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
	public async FindByFederatedIdentity(
		idpAlias: string,
		idpUserId: string,
	): Promise<IUserRepresentation | null> {
		this.RequireScope('users:read');
		try {
			const Results = (await this.WithRetry(() =>
				this.AdminClient.users.find({
					idpAlias,
					idpUserId,
					exact: true,
				}),
			)) as IUserRepresentation[];

			return Results[0] ?? null;
		} catch (error) {
			return this.HandleError(error);
		}
	}
}
