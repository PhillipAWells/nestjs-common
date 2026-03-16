import type {
	AdminEventQuery,
	AccessEventQuery,
	KeycloakAdminEvent,
	KeycloakAccessEvent,
} from '../types/event.types.js';
import { BaseService } from './base-service.js';

/**
 * Event Service
 *
 * Wraps Keycloak's event query endpoints for polling admin and access events.
 * Intended for audit logging, monitoring, and event-driven integrations.
 *
 * Results are returned newest-first by default. Pagination is supported via `first` and `max` parameters.
 *
 * @example
 * ```typescript
 * // Audit user deletions
 * const events = await keycloakAdmin.events.getAdminEvents({
 *   operationTypes: ['DELETE'],
 *   resourceTypes: ['USER'],
 *   max: 100
 * });
 *
 * // Monitor failed logins
 * const accessEvents = await keycloakAdmin.events.getAccessEvents({
 *   type: ['LOGIN_ERROR'],
 *   max: 50
 * });
 * ```
 */
export class EventService extends BaseService {
	/**
	 * Get admin events for a realm
	 *
	 * Queries administrative events (user creation, role assignment, client updates, etc.).
	 * Results are newest-first. Use pagination via `first` and `max` to limit results.
	 *
	 * Note: Keycloak caps `max` at 100; larger values are silently truncated.
	 *
	 * @param query - Optional filters and pagination parameters
	 * @returns Array of admin events (may be empty if no matches)
	 *
	 * @example
	 * ```typescript
	 * const events = await this.events.getAdminEvents({
	 *   operationTypes: ['CREATE', 'UPDATE'],
	 *   resourceTypes: ['USER', 'CLIENT'],
	 *   dateFrom: new Date('2024-01-01'),
	 *   dateTo: new Date(),
	 *   max: 50
	 * });
	 * ```
	 */
	public async getAdminEvents(query?: AdminEventQuery): Promise<KeycloakAdminEvent[]> {
		this.requireScope('events:read');
		try {
			const params = this.buildAdminEventQuery(query);

			return (await this.withRetry(() =>
				this.adminClient.realms.findAdminEvents({ realm: this.adminClient.realmName, ...params }),
			)) as KeycloakAdminEvent[];
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Get access events for a realm
	 *
	 * Queries authentication and authorization events (logins, logouts, permission checks, etc.).
	 * Results are newest-first. Use pagination via `first` and `max` to limit results.
	 *
	 * Note: Keycloak caps `max` at 100; larger values are silently truncated.
	 *
	 * @param query - Optional filters and pagination parameters
	 * @returns Array of access events (may be empty if no matches)
	 *
	 * @example
	 * ```typescript
	 * const events = await this.events.getAccessEvents({
	 *   type: ['LOGIN', 'LOGIN_ERROR'],
	 *   client: 'my-client',
	 *   dateFrom: new Date('2024-01-01'),
	 *   max: 50
	 * });
	 * ```
	 */
	public async getAccessEvents(query?: AccessEventQuery): Promise<KeycloakAccessEvent[]> {
		this.requireScope('events:read');
		try {
			const params = this.buildAccessEventQuery(query);

			return (await this.withRetry(() =>
				this.adminClient.realms.findEvents({ realm: this.adminClient.realmName, ...params }),
			)) as KeycloakAccessEvent[];
		} catch (error) {
			return this.handleError(error);
		}
	}

	/**
	 * Build query parameters for admin events
	 */
	private buildAdminEventQuery(
		query?: AdminEventQuery,
	): Record<string, string | number | string[] | undefined> {
		const params: Record<string, string | number | string[] | undefined> = {};

		if (!query) {
			return params;
		}

		if (query.operationTypes && query.operationTypes.length > 0) {
			params.operationTypes = query.operationTypes;
		}

		if (query.resourceTypes && query.resourceTypes.length > 0) {
			params.resourceTypes = query.resourceTypes;
		}

		if (query.resourcePath) {
			params.resourcePath = query.resourcePath;
		}

		if (query.dateFrom) {
			params.dateFrom = query.dateFrom.toISOString();
		}

		if (query.dateTo) {
			params.dateTo = query.dateTo.toISOString();
		}

		if (query.first !== undefined) {
			params.first = query.first;
		}

		if (query.max !== undefined) {
			params.max = query.max;
		}

		return params;
	}

	/**
	 * Build query parameters for access events
	 */
	private buildAccessEventQuery(
		query?: AccessEventQuery,
	): Record<string, string | number | string[] | undefined> {
		const params: Record<string, string | number | string[] | undefined> = {};

		if (!query) {
			return params;
		}

		if (query.type && query.type.length > 0) {
			params.type = query.type;
		}

		if (query.client) {
			params.client = query.client;
		}

		if (query.user) {
			params.user = query.user;
		}

		if (query.dateFrom) {
			params.dateFrom = query.dateFrom.toISOString();
		}

		if (query.dateTo) {
			params.dateTo = query.dateTo.toISOString();
		}

		if (query.first !== undefined) {
			params.first = query.first;
		}

		if (query.max !== undefined) {
			params.max = query.max;
		}

		return params;
	}
}
