/**
 * Keycloak realm representation
 */
export interface RealmRepresentation {
	id?: string;
	realm?: string;
	displayName?: string;
	enabled?: boolean;
	sslRequired?: string;
	registrationAllowed?: boolean;
	loginWithEmailAllowed?: boolean;
	duplicateEmailsAllowed?: boolean;
	resetPasswordAllowed?: boolean;
	editUsernameAllowed?: boolean;
	bruteForceProtected?: boolean;
	[key: string]: unknown;
}

/**
 * Keycloak user representation
 */
export interface UserRepresentation {
	id?: string;
	username?: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	enabled?: boolean;
	emailVerified?: boolean;
	attributes?: Record<string, string[]>;
	requiredActions?: string[];
	credentials?: CredentialRepresentation[];
	groups?: string[];
	[key: string]: unknown;
}

/**
 * Keycloak credential representation
 */
export interface CredentialRepresentation {
	type?: string;
	value?: string;
	temporary?: boolean;
	[key: string]: unknown;
}

/**
 * Keycloak client representation
 */
export interface ClientRepresentation {
	id?: string;
	clientId?: string;
	name?: string;
	description?: string;
	enabled?: boolean;
	clientAuthenticatorType?: string;
	secret?: string;
	publicClient?: boolean;
	protocol?: string;
	redirectUris?: string[];
	webOrigins?: string[];
	directAccessGrantsEnabled?: boolean;
	serviceAccountsEnabled?: boolean;
	standardFlowEnabled?: boolean;
	implicitFlowEnabled?: boolean;
	bearerOnly?: boolean;
	consentRequired?: boolean;
	attributes?: Record<string, string>;
	[key: string]: unknown;
}

/**
 * Keycloak role representation
 */
export interface RoleRepresentation {
	id?: string;
	name?: string;
	description?: string;
	composite?: boolean;
	clientRole?: boolean;
	containerId?: string;
	attributes?: Record<string, string[]>;
	[key: string]: unknown;
}

/**
 * Keycloak group representation
 */
export interface GroupRepresentation {
	id?: string;
	name?: string;
	path?: string;
	attributes?: Record<string, string[]>;
	realmRoles?: string[];
	clientRoles?: Record<string, string[]>;
	subGroups?: GroupRepresentation[];
	[key: string]: unknown;
}

/**
 * Keycloak identity provider representation
 */
export interface IdentityProviderRepresentation {
	alias?: string;
	displayName?: string;
	providerId?: string;
	enabled?: boolean;
	trustEmail?: boolean;
	storeToken?: boolean;
	addReadTokenRoleOnCreate?: boolean;
	authenticateByDefault?: boolean;
	linkOnly?: boolean;
	firstBrokerLoginFlowAlias?: string;
	config?: Record<string, string>;
	[key: string]: unknown;
}

/**
 * Keycloak authentication flow representation
 */
export interface AuthenticationFlowRepresentation {
	id?: string;
	alias?: string;
	description?: string;
	providerId?: string;
	topLevel?: boolean;
	builtIn?: boolean;
	authenticationExecutions?: AuthenticationExecutionInfoRepresentation[];
	[key: string]: unknown;
}

/**
 * Keycloak authentication execution representation
 */
export interface AuthenticationExecutionInfoRepresentation {
	id?: string;
	requirement?: string;
	displayName?: string;
	alias?: string;
	description?: string;
	requirementChoices?: string[];
	configurable?: boolean;
	providerId?: string;
	level?: number;
	index?: number;
	[key: string]: unknown;
}

/**
 * Keycloak protocol mapper representation
 */
export interface ProtocolMapperRepresentation {
	id?: string;
	name?: string;
	protocol?: string;
	protocolMapper?: string;
	consentRequired?: boolean;
	config?: Record<string, string>;
	[key: string]: unknown;
}

/**
 * User query parameters
 */
export interface UserQuery {
	briefRepresentation?: boolean;
	email?: string;
	emailVerified?: boolean;
	enabled?: boolean;
	exact?: boolean;
	first?: number;
	firstName?: string;
	lastName?: string;
	max?: number;
	search?: string;
	username?: string;
	[key: string]: unknown;
}
