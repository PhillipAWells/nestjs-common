import type {
	ClientRepresentation,
	RoleRepresentation,
	ProtocolMapperRepresentation
} from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak OAuth/OIDC clients
 */
export class ClientService extends BaseService {
	/**
	 * List all clients in a realm
	 */
	async list(realm: string): Promise<ClientRepresentation[]> {
		try {
			return (await this.withRetry(async () => this.adminClient.clients.find({ realm }))) as any;
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a client by ID (internal Keycloak ID, not clientId)
	 */
	async get(realm: string, id: string): Promise<ClientRepresentation> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.clients.findOne({ realm, id })
			)) as any;
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Find a client by clientId (the public client identifier)
	 */
	async findByClientId(realm: string, clientId: string): Promise<ClientRepresentation | undefined> {
		try {
			const clients = (await this.withRetry(async () =>
				this.adminClient.clients.find({ realm, clientId })
			)) as any;
			return clients[0];
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a new client
	 */
	async create(realm: string, client: ClientRepresentation): Promise<{ id: string }> {
		try {
			return await this.withRetry(async () =>
				this.adminClient.clients.create({ ...client, realm })
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Update a client
	 */
	async update(realm: string, id: string, client: ClientRepresentation): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.clients.update({ realm, id }, client)
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete a client
	 */
	async delete(realm: string, id: string): Promise<void> {
		try {
			await this.withRetry(async () => this.adminClient.clients.del({ realm, id }));
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get client secret
	 */
	async getSecret(realm: string, id: string): Promise<{ type?: string; value?: string }> {
		try {
			return await this.withRetry(async () =>
				this.adminClient.clients.getClientSecret({ realm, id })
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a protocol mapper for a client
	 */
	async createProtocolMapper(
		realm: string,
		id: string,
		mapper: ProtocolMapperRepresentation
	): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.clients.addProtocolMapper({ realm, id }, mapper)
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * List protocol mappers for a client
	 */
	async listProtocolMappers(
		realm: string,
		id: string
	): Promise<ProtocolMapperRepresentation[]> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.clients.listProtocolMappers({ realm, id })
			)) as any;
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete a protocol mapper
	 */
	async deleteProtocolMapper(
		realm: string,
		id: string,
		mapperId: string
	): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.clients.delProtocolMapper({ realm, id, mapperId })
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a client role
	 */
	async createRole(realm: string, id: string, role: RoleRepresentation): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.clients.createRole({ realm, id }, role as any)
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * List roles for a client
	 */
	async listRoles(realm: string, id: string): Promise<RoleRepresentation[]> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.clients.listRoles({ realm, id })
			)) as any;
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Find a client role by name
	 */
	async findRole(realm: string, id: string, roleName: string): Promise<RoleRepresentation> {
		try {
			return (await this.withRetry(async () =>
				this.adminClient.clients.findRole({ realm, id, roleName })
			)) as any;
		}
		catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete a client role
	 */
	async deleteRole(realm: string, id: string, roleName: string): Promise<void> {
		try {
			await this.withRetry(async () =>
				this.adminClient.clients.delRole({ realm, id, roleName })
			);
		}
		catch (error) {
			return this.handleError(error);
		}
	}
}
