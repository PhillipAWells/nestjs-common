/**
 * Keycloak realm representation
 */
export interface IRealmRepresentation {
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
export interface IUserRepresentation {
	id?: string;
	username?: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	enabled?: boolean;
	emailVerified?: boolean;
	attributes?: Record<string, string[]>;
	requiredActions?: string[];
	credentials?: ICredentialRepresentation[];
	groups?: string[];
	[key: string]: unknown;
}

/**
 * Keycloak credential representation
 */
export interface ICredentialRepresentation {
	type?: string;
	value?: string;
	temporary?: boolean;
	[key: string]: unknown;
}

/**
 * Keycloak client representation
 */
export interface IClientRepresentation {
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
export interface IRoleRepresentation {
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
export interface IGroupRepresentation {
	id?: string;
	name?: string;
	path?: string;
	attributes?: Record<string, string[]>;
	realmRoles?: string[];
	clientRoles?: Record<string, string[]>;
	subGroups?: IGroupRepresentation[];
	[key: string]: unknown;
}

/**
 * Keycloak identity provider representation
 */
export interface IIdentityProviderRepresentation {
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
export interface IAuthenticationFlowRepresentation {
	id?: string;
	alias?: string;
	description?: string;
	providerId?: string;
	topLevel?: boolean;
	builtIn?: boolean;
	authenticationExecutions?: IAuthenticationExecutionInfoRepresentation[];
	[key: string]: unknown;
}

/**
 * Keycloak authentication execution representation
 */
export interface IAuthenticationExecutionInfoRepresentation {
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
export interface IProtocolMapperRepresentation {
	id?: string;
	name?: string;
	protocol?: string;
	protocolMapper?: string;
	consentRequired?: boolean;
	config?: Record<string, string>;
	[key: string]: unknown;
}

/**
 * IUser query parameters
 */
export interface IUserQuery {
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
