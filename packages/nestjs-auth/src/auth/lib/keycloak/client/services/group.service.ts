import type { GroupRepresentation } from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak groups
 */
export class GroupService extends BaseService {
	/**
	 * List all groups in a realm
	 */
	async list(realm: string): Promise<GroupRepresentation[]> {
		try {
			return (await this.withRetry(async () => this.adminClient.groups.find({ realm }))) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a group by ID
	 */
	async get(realm: string, groupId: string): Promise<GroupRepresentation> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.groups.findOne({ realm, id: groupId }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a new group
	 */
	async create(realm: string, group: GroupRepresentation): Promise<{ id: string }> {
		try {
			return await this.withRetry(async () =>
				this.adminClient.groups.create({ ...group, realm }),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Update a group
	 */
	async update(realm: string, groupId: string, group: GroupRepresentation): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.groups.update({ realm, id: groupId }, group),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete a group
	 */
	async delete(realm: string, groupId: string): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.groups.del({ realm, id: groupId }),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Add a user to a group
	 */
	async addMember(realm: string, groupId: string, userId: string): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.users.addToGroup({ realm, id: userId, groupId }),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Remove a user from a group
	 */
	async removeMember(realm: string, groupId: string, userId: string): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.users.delFromGroup({ realm, id: userId, groupId }),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}
}
