export interface OAuthProviderConfig {
	provider: 'keycloak' | 'generic-oidc' | 'google' | 'github';
	clientId: string;
	clientSecret: string;
	discoveryUrl?: string; // For OIDC discovery
	authorizationUrl?: string;
	tokenUrl?: string;
	userInfoUrl?: string;
	jwksUrl?: string;
	redirectUri: string;
	scopes?: string[];
	issuer?: string;
	audience?: string;
}

export interface KeycloakConfig extends OAuthProviderConfig {
	provider: 'keycloak';
	authServerUrl: string;
	realm: string;
	sslRequired?: 'external' | 'all' | 'none';
	publicKey?: string;
}

export interface OAuthModuleOptions {
	providers: OAuthProviderConfig[];
	defaultProvider?: string;
	publicKeyCache?: {
		ttl: number; // seconds
		enabled: boolean;
	};
}

export interface OAuthUser {
	id: string;
	email?: string;
	name?: string;
	roles?: string[];
	sub?: string;
	preferred_username?: string;
	given_name?: string;
	family_name?: string;
	[key: string]: any;
}

export interface OAuthToken {
	accessToken: string;
	refreshToken?: string;
	expiresIn?: number;
	tokenType?: string;
	idToken?: string;
}
