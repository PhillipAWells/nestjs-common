import type { GroupRepresentation } from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak groups
 */
export class GroupService extends BaseService {
	/**
	 * List all groups in a realm
	 */
	public async list(realm: string): Promise<GroupRepresentation[]> {
		try {
			return (await this.withRetry(() => this.adminClient.groups.find({ realm }))) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a group by ID
	 */
	public async get(realm: string, groupId: string): Promise<GroupRepresentation> {
		try {
			return (await this.withRetry(() =>
				this.adminClient.groups.findOne({ realm, id: groupId }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a new group
	 */
	public async create(realm: string, group: GroupRepresentation): Promise<{ id: string }> {
		try {
			return await this.withRetry(() =>
				this.adminClient.groups.create({ ...group, realm }),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Update a group
	 */
	public async update(realm: string, groupId: string, group: GroupRepresentation): Promise<void> {
		try {
			await this.withRetry(() =>
				this.adminClient.groups.update({ realm, id: groupId }, group),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Delete a group
	 */
	public async delete(realm: string, groupId: string): Promise<void> {
		try {
			await this.withRetry(() =>
				this.adminClient.groups.del({ realm, id: groupId }),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Add a user to a group
	 */
	public async addMember(realm: string, groupId: string, userId: string): Promise<void> {
		try {
			await this.withRetry(() =>
				this.adminClient.users.addToGroup({ realm, id: userId, groupId }),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Remove a user from a group
	 */
	public async removeMember(realm: string, groupId: string, userId: string): Promise<void> {
		try {
			await this.withRetry(() =>
				this.adminClient.users.delFromGroup({ realm, id: userId, groupId }),
			);
		} catch (error) {
			this.handleError(error);
		}
	}
}
