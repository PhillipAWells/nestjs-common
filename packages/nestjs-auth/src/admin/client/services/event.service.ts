import type {
	IAdminEventQuery,
	IAccessEventQuery,
	IKeycloakAdminEvent,
	IKeycloakAccessEvent,
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
 * const events = await keycloakAdmin.events.getAdminEvents('master', {
 *   operationTypes: ['DELETE'],
 *   resourceTypes: ['USER'],
 *   max: 100
 * });
 *
 * // Monitor failed logins
 * const accessEvents = await keycloakAdmin.events.getAccessEvents('master', {
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
	 * @param realm - The realm name to query events for
	 * @param query - Optional filters and pagination parameters
	 * @returns Array of admin events (may be empty if no matches)
	 *
	 * @example
	 * ```typescript
	 * const events = await this.events.getAdminEvents('master', {
	 *   operationTypes: ['CREATE', 'UPDATE'],
	 *   resourceTypes: ['USER', 'CLIENT'],
	 *   dateFrom: new Date('2024-01-01'),
	 *   dateTo: new Date(),
	 *   max: 50
	 * });
	 * ```
	 */
	public async GetAdminEvents(realm: string, query?: IAdminEventQuery): Promise<IKeycloakAdminEvent[]> {
		this.RequireScope('events:read');
		try {
			const Params = this.BuildAdminEventQuery(query);

			return (await this.WithRetry(() =>
				this.AdminClient.realms.findAdminEvents({ realm, ...Params }),
			)) as IKeycloakAdminEvent[];
		} catch (error) {
			return this.HandleError(error);
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
	 * @param realm - The realm name to query events for
	 * @param query - Optional filters and pagination parameters
	 * @returns Array of access events (may be empty if no matches)
	 *
	 * @example
	 * ```typescript
	 * const events = await this.events.getAccessEvents('master', {
	 *   type: ['LOGIN', 'LOGIN_ERROR'],
	 *   client: 'my-client',
	 *   dateFrom: new Date('2024-01-01'),
	 *   max: 50
	 * });
	 * ```
	 */
	public async GetAccessEvents(realm: string, query?: IAccessEventQuery): Promise<IKeycloakAccessEvent[]> {
		this.RequireScope('events:read');
		try {
			const Params = this.BuildAccessEventQuery(query);

			return (await this.WithRetry(() =>
				this.AdminClient.realms.findEvents({ realm, ...Params }),
			)) as IKeycloakAccessEvent[];
		} catch (error) {
			return this.HandleError(error);
		}
	}

	/**
	 * Build query parameters for admin events
	 */
	private BuildAdminEventQuery(
		query?: IAdminEventQuery,
	): Record<string, string | number | string[] | undefined> {
		const Params: Record<string, string | number | string[] | undefined> = {};

		if (!query) {
			return Params;
		}

		if (query.operationTypes && query.operationTypes.length > 0) {
			Params.operationTypes = query.operationTypes;
		}

		if (query.resourceTypes && query.resourceTypes.length > 0) {
			Params.resourceTypes = query.resourceTypes;
		}

		if (query.resourcePath) {
			Params.resourcePath = query.resourcePath;
		}

		if (query.dateFrom) {
			Params.dateFrom = query.dateFrom.toISOString();
		}

		if (query.dateTo) {
			Params.dateTo = query.dateTo.toISOString();
		}

		if (query.first !== undefined) {
			Params.first = query.first;
		}

		if (query.max !== undefined) {
			Params.max = query.max;
		}

		return Params;
	}

	/**
	 * Build query parameters for access events
	 */
	private BuildAccessEventQuery(
		query?: IAccessEventQuery,
	): Record<string, string | number | string[] | undefined> {
		const Params: Record<string, string | number | string[] | undefined> = {};

		if (!query) {
			return Params;
		}

		if (query.type && query.type.length > 0) {
			Params.type = query.type;
		}

		if (query.client) {
			Params.client = query.client;
		}

		if (query.user) {
			Params.user = query.user;
		}

		if (query.dateFrom) {
			Params.dateFrom = query.dateFrom.toISOString();
		}

		if (query.dateTo) {
			Params.dateTo = query.dateTo.toISOString();
		}

		if (query.first !== undefined) {
			Params.first = query.first;
		}

		if (query.max !== undefined) {
			Params.max = query.max;
		}

		return Params;
	}
}
