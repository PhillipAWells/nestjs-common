export interface KeycloakAdminConfig {
	enabled: boolean;
	baseUrl: string;
	realmName: string;
	credentials:
		| {
			type: 'password';
			username: string;
			password: string;
		}
		| {
			type: 'clientCredentials';
			clientId: string;
			clientSecret: string;
		};
	timeout?: number;
	retry?: {
		maxRetries: number;
		retryDelay: number;
	};
}
