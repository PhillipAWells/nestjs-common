import type { IGroupRepresentation } from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak groups.
 *
 * Provides methods for creating, listing, and managing user groups. Groups can be nested hierarchically,
 * have roles assigned to them, and be used to organize users. Requires `groups:read` and `groups:write`
 * scopes depending on the operation.
 *
 * Part of {@link KeycloakAdminService.groups | KeycloakAdminService#groups}.
 *
 * @example
 * ```typescript
 * const groups = await keycloak.groups.list('my-realm');
 * const group = await keycloak.groups.get('my-realm', 'group-id');
 * await keycloak.groups.create('my-realm', { name: 'developers', path: '/developers' });
 * await keycloak.groups.addMember('my-realm', 'group-id', 'user-id');
 * ```
 */
export class GroupService extends BaseService {
	/**
	 * List all groups in a realm
	 */
	public async List(realm: string): Promise<IGroupRepresentation[]> {
		this.RequireScope('groups:read');
		try {
			return (await this.WithRetry(() => this.AdminClient.groups.find({ realm }))) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Get a group by ID
	 */
	public async Get(realm: string, groupId: string): Promise<IGroupRepresentation> {
		this.RequireScope('groups:read');
		try {
			return (await this.WithRetry(() =>
				this.AdminClient.groups.findOne({ realm, id: groupId }),
			)) as any;
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Create a new group
	 */
	public async Create(realm: string, group: IGroupRepresentation): Promise<{ id: string }> {
		this.RequireScope('groups:write');
		try {
			return await this.WithRetry(() =>
				this.AdminClient.groups.create({ ...group, realm }),
			);
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Update a group
	 */
	public async Update(realm: string, groupId: string, group: IGroupRepresentation): Promise<void> {
		this.RequireScope('groups:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.groups.update({ realm, id: groupId }, group),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Delete a group
	 */
	public async Delete(realm: string, groupId: string): Promise<void> {
		this.RequireScope('groups:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.groups.del({ realm, id: groupId }),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Add a user to a group
	 */
	public async AddMember(realm: string, groupId: string, userId: string): Promise<void> {
		this.RequireScope('groups:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.users.addToGroup({ realm, id: userId, groupId }),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}

	/**
	 * Remove a user from a group
	 */
	public async RemoveMember(realm: string, groupId: string, userId: string): Promise<void> {
		this.RequireScope('groups:write');
		try {
			await this.WithRetry(() =>
				this.AdminClient.users.delFromGroup({ realm, id: userId, groupId }),
			);
		} catch (error) {
			this.HandleError(error);
		}
	}
}
