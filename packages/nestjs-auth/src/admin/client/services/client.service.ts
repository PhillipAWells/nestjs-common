import type {
	IClientRepresentation,
	IRoleRepresentation,
	IProtocolMapperRepresentation,
} from '../types/index.js';
import { BaseService } from './base-service.js';

/**
 * Service for managing Keycloak OAuth/OIDC clients.
 *
 * Provides methods for CRUD operations on OAuth/OIDC clients, including client creation,
 * configuration, secret rotation, client scope management, and protocol mapper setup.
 * Requires `clients:read` and `clients:write` scopes depending on the operation.
 *
 * Part of {@link KeycloakAdminService.clients | KeycloakAdminService#clients}.
 *
 * @example
 * ```typescript
 * const clients = await keycloak.clients.list('my-realm');
 * const client = await keycloak.clients.findByClientId('my-realm', 'my-app');
 * await keycloak.clients.create('my-realm', {
 *   clientId: 'my-app',
 *   enabled: true,
 *   redirectUris: ['http://localhost:3000/callback'],
 * });
 * ```
 */
export class ClientService extends BaseService {
	/**
	 * List all clients in a realm
	 */
	public async list(realm: string): Promise<IClientRepresentation[]> {
		this.requireScope('clients:read');
		try {
			return (await this.withRetry(() => this.AdminClient.clients.find({ realm }))) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get a client by ID (internal Keycloak ID, not clientId)
	 */
	public async get(realm: string, id: string): Promise<IClientRepresentation> {
		this.requireScope('clients:read');
		try {
			return (await this.withRetry(() =>
				this.AdminClient.clients.findOne({ realm, id }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Find a client by clientId (the public Client identifier)
	 */
	public async findByClientId(realm: string, clientId: string): Promise<IClientRepresentation | undefined> {
		this.requireScope('clients:read');
		try {
			const clients = (await this.withRetry(() =>
				this.AdminClient.clients.find({ realm, clientId }),
			)) as any;
			return clients[0];
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a new client
	 */
	public async create(realm: string, client: IClientRepresentation): Promise<{ id: string }> {
		this.requireScope('clients:write');
		try {
			return await this.withRetry(() =>
				this.AdminClient.clients.create({ ...client, realm }),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Update a client
	 */
	public async update(realm: string, id: string, client: IClientRepresentation): Promise<void> {
		this.requireScope('clients:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.clients.update({ realm, id }, client),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Delete a client
	 */
	public async delete(realm: string, id: string): Promise<void> {
		this.requireScope('clients:write');
		try {
			await this.withRetry(() => this.AdminClient.clients.del({ realm, id }));
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Get client secret
	 */
	public async getSecret(realm: string, id: string): Promise<{ type?: string; value?: string }> {
		this.requireScope('clients:read');
		try {
			return await this.withRetry(() =>
				this.AdminClient.clients.getClientSecret({ realm, id }),
			);
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Create a protocol mapper for a client
	 */
	public async createProtocolMapper(
		realm: string,
		id: string,
		mapper: IProtocolMapperRepresentation,
	): Promise<void> {
		this.requireScope('clients:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.clients.addProtocolMapper({ realm, id }, mapper),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * List protocol mappers for a client
	 */
	public async listProtocolMappers(
		realm: string,
		id: string,
	): Promise<IProtocolMapperRepresentation[]> {
		this.requireScope('clients:read');
		try {
			return (await this.withRetry(() =>
				this.AdminClient.clients.listProtocolMappers({ realm, id }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete a protocol mapper
	 */
	public async deleteProtocolMapper(
		realm: string,
		id: string,
		mapperId: string,
	): Promise<void> {
		this.requireScope('clients:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.clients.delProtocolMapper({ realm, id, mapperId }),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Create a client role
	 */
	public async createRole(realm: string, id: string, role: IRoleRepresentation): Promise<void> {
		this.requireScope('clients:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.clients.createRole({ realm, id }, role as any),
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * List roles for a client
	 */
	public async listRoles(realm: string, id: string): Promise<IRoleRepresentation[]> {
		this.requireScope('clients:read');
		try {
			return (await this.withRetry(() =>
				this.AdminClient.clients.listRoles({ realm, id }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Find a client role by name
	 */
	public async findRole(realm: string, id: string, roleName: string): Promise<IRoleRepresentation> {
		this.requireScope('clients:read');
		try {
			return (await this.withRetry(() =>
				this.AdminClient.clients.findRole({ realm, id, roleName }),
			)) as any;
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Delete a client role
	 */
	public async deleteRole(realm: string, id: string, roleName: string): Promise<void> {
		this.requireScope('clients:write');
		try {
			await this.withRetry(() =>
				this.AdminClient.clients.delRole({ realm, id, roleName }),
			);
		} catch (error) {
			this.handleError(error);
		}
	}
}
