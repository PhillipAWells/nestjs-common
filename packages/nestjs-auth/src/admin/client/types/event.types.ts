/**
 * Query Parameters for Admin Events
 *
 * Filters and pagination options for querying administrative events.
 */
export interface AdminEventQuery {
	/**
	 * Filter by operation types to include
	 */
	operationTypes?: ('CREATE' | 'UPDATE' | 'DELETE' | 'ACTION')[];

	/**
	 * Filter by resource types affected
	 */
	resourceTypes?: string[];

	/**
	 * Filter by resource path (e.g., 'users/123', 'clients/abc')
	 */
	resourcePath?: string;

	/**
	 * Start of date range (inclusive)
	 */
	dateFrom?: Date;

	/**
	 * End of date range (inclusive)
	 */
	dateTo?: Date;

	/**
	 * Offset for pagination (start index)
	 */
	first?: number;

	/**
	 * Maximum number of results to return.
	 * Keycloak caps this at 100; larger values are silently truncated.
	 */
	max?: number;
}

/**
 * Query Parameters for Access Events
 *
 * Filters and pagination options for querying authentication and authorization events.
 */
export interface AccessEventQuery {
	/**
	 * Filter by event types to include (e.g., ['LOGIN', 'LOGOUT', 'LOGIN_ERROR'])
	 */
	type?: string[];

	/**
	 * Filter by client ID making the request
	 */
	client?: string;

	/**
	 * Filter by user ID involved in the event
	 */
	user?: string;

	/**
	 * Start of date range (inclusive)
	 */
	dateFrom?: Date;

	/**
	 * End of date range (inclusive)
	 */
	dateTo?: Date;

	/**
	 * Offset for pagination (start index)
	 */
	first?: number;

	/**
	 * Maximum number of results to return.
	 * Keycloak caps this at 100; larger values are silently truncated.
	 */
	max?: number;
}

/**
 * Keycloak Admin Event Representation
 *
 * Represents a single administrative event (user creation, role assignment, client updates, etc.)
 * in a Keycloak realm.
 */
export interface KeycloakAdminEvent {
	/**
	 * Event timestamp (milliseconds since epoch)
	 */
	time: number;

	/**
	 * ID of the realm where the event occurred
	 */
	realmId: string;

	/**
	 * Type of operation: CREATE, UPDATE, DELETE, or ACTION
	 */
	operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'ACTION';

	/**
	 * Type of resource affected (e.g., USER, CLIENT, ROLE, GROUP, etc.)
	 */
	resourceType: string;

	/**
	 * Path to the resource (e.g., 'users/user-id' or 'clients/client-id')
	 */
	resourcePath: string;

	/**
	 * Double-encoded JSON string containing the full representation of the created or updated resource.
	 * Present only on CREATE and UPDATE operations.
	 *
	 * **Important**: Must be decoded twice:
	 * ```typescript
	 * const decoded = JSON.parse(JSON.parse(event.representation));
	 * ```
	 */
	representation?: string;

	/**
	 * Authentication details of who performed the operation
	 */
	authDetails?: {
		/**
		 * Realm where the admin authenticated
		 */
		realmId: string;

		/**
		 * Client ID of the admin application
		 */
		clientId: string;

		/**
		 * User ID of the admin who performed the operation
		 */
		userId: string;

		/**
		 * IP address from which the operation was performed
		 */
		ipAddress: string;
	};
}

/**
 * Keycloak Access Event Representation
 *
 * Represents a single authentication or authorization event (login, logout, permission check, etc.)
 * in a Keycloak realm.
 */
export interface KeycloakAccessEvent {
	/**
	 * Event timestamp (milliseconds since epoch)
	 */
	time: number;

	/**
	 * ID of the realm where the event occurred
	 */
	realmId: string;

	/**
	 * Type of event (e.g., LOGIN, LOGOUT, LOGIN_ERROR, CODE_TO_TOKEN, etc.)
	 */
	type: string;

	/**
	 * Keycloak session ID, if available
	 */
	sessionId?: string;

	/**
	 * Keycloak user ID, if the event is tied to a user
	 */
	userId?: string;

	/**
	 * IP address from which the request originated
	 */
	ipAddress?: string;

	/**
	 * Client ID making the request
	 */
	clientId?: string;

	/**
	 * Additional event-specific details (keys and values depend on event type)
	 */
	details?: Record<string, string>;

	/**
	 * Error message, present only if the event represents a failure (e.g., LOGIN_ERROR)
	 */
	error?: string;
}
