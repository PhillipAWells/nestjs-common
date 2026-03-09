import Joi from 'joi';
import type { KeycloakAdminConfig } from './keycloak.config.js';
import { KEYCLOAK_TIMEOUT, KEYCLOAK_TIMEOUT_30_SECONDS_MULTIPLIER } from '../../../constants/auth-timeouts.constants.js';

export const KeycloakAdminDefaults: KeycloakAdminConfig = {
	enabled: false,
	baseUrl: 'http://localhost:8080',
	realmName: 'master',
	credentials: {
		type: 'password',
		username: 'admin',
		password: 'admin'
	},
	timeout: KEYCLOAK_TIMEOUT * KEYCLOAK_TIMEOUT_30_SECONDS_MULTIPLIER, // 30 seconds
	retry: {
		maxRetries: 3,
		retryDelay: KEYCLOAK_TIMEOUT
	}
};

export function ValidateKeycloakAdminConfig(config: KeycloakAdminConfig): void {
	const schema = Joi.object({
		enabled: Joi.boolean().required(),
		baseUrl: Joi.string()
			.uri({ scheme: ['http', 'https'] })
			.required(),
		realmName: Joi.string().min(1).required(),
		credentials: Joi.alternatives()
			.try(
				Joi.object({
					type: Joi.string().valid('password').required(),
					username: Joi.string().required(),
					password: Joi.string().required()
				}),
				Joi.object({
					type: Joi.string().valid('clientCredentials').required(),
					clientId: Joi.string().required(),
					clientSecret: Joi.string().required()
				})
			)
			.required(),
		timeout: Joi.number().min(KEYCLOAK_TIMEOUT).optional(),
		retry: Joi.object({
			maxRetries: Joi.number().min(0).required(),
			retryDelay: Joi.number().min(0).required()
		}).optional()
	});

	const { error } = schema.validate(config);
	if (error) {
		throw new Error(`Keycloak configuration validation failed: ${error.details.map((d) => d.message).join(', ')}`);
	}
}

/**
 * Backwards compatibility alias - exported functions use PascalCase per project conventions
 */
export const validateKeycloakAdminConfig = ValidateKeycloakAdminConfig;
