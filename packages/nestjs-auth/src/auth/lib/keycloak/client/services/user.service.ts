import type {
	UserRepresentation,
	UserQuery,
	CredentialRepresentation,
	RoleRepresentation
} from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak users
 */
export class UserService extends BaseService {
	/**
	 * List users in a realm
	 */
	async list(realm: string, query?: UserQuery): Promise<UserRepresentation[]> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.users.find({ ...query, realm })
			)) as any;
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a user by ID
	 */
	async get(realm: string, userId: string): Promise<UserRepresentation> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.users.findOne({ realm, id: userId })
			)) as any;
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a new user
	 */
	async create(realm: string, user: UserRepresentation): Promise<{ id: string }> {
		try {
			return await this.withRetry(async () =>
				this.adminClient.users.create({ ...user, realm })
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Update a user
	 */
	async update(realm: string, userId: string, user: UserRepresentation): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.users.update({ realm, id: userId }, user)
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete a user
	 */
	async delete(realm: string, userId: string): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.users.del({ realm, id: userId })
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Reset a user's password
	 */
	async resetPassword(
		realm: string,
		userId: string,
		credential: CredentialRepresentation
	): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.users.resetPassword({
					realm,
					id: userId,
					credential
				})
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Add realm roles to a user
	 */
	async addRealmRoles(
		realm: string,
		userId: string,
		roles: RoleRepresentation[]
	): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.users.addRealmRoleMappings({
					realm,
					id: userId,
					roles: roles as any
				})
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get realm roles for a user
	 */
	async getRealmRoles(realm: string, userId: string): Promise<RoleRepresentation[]> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.users.listRealmRoleMappings({ realm, id: userId })
			)) as any;
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete realm roles from a user
	 */
	async deleteRealmRoles(
		realm: string,
		userId: string,
		roles: RoleRepresentation[]
	): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.users.delRealmRoleMappings({
					realm,
					id: userId,
					roles: roles as any
				})
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Add client roles to a user
	 */
	async addClientRoles(
		realm: string,
		userId: string,
		clientId: string,
		roles: RoleRepresentation[]
	): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.users.addClientRoleMappings({
					realm,
					id: userId,
					clientUniqueId: clientId,
					roles: roles as any
				})
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get client roles for a user
	 */
	async getClientRoles(
		realm: string,
		userId: string,
		clientId: string
	): Promise<RoleRepresentation[]> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.users.listClientRoleMappings({
					realm,
					id: userId,
					clientUniqueId: clientId
				})
			)) as any;
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete client roles from a user
	 */
	async deleteClientRoles(
		realm: string,
		userId: string,
		clientId: string,
		roles: RoleRepresentation[]
	): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.users.delClientRoleMappings({
					realm,
					id: userId,
					clientUniqueId: clientId,
					roles: roles as any
				})
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}
}
