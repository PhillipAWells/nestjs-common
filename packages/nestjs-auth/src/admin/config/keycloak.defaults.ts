import Joi from 'joi';
import type { IKeycloakAdminConfig } from './keycloak.config.js';
import { KEYCLOAK_ALL_SCOPES } from '../permissions/keycloak-admin.permissions.js';

// Keycloak timeout constants (in milliseconds)
const KEYCLOAK_TIMEOUT = 1000;
const KEYCLOAK_TIMEOUT_30_SECONDS_MULTIPLIER = 30;

/**
 * Default values for `IKeycloakAdminConfig`.
 *
 * Used as the base configuration merged with consumer-provided options in
 * `KeycloakAdminModule`. The module is disabled by default (`enabled: false`).
 *
 * SECURITY: Credential fields are intentionally left empty and MUST be provided via
 * environment variables. Do not commit credentials to source code.
 */
export const KeycloakAdminDefaults: IKeycloakAdminConfig = {
	enabled: false,
	baseUrl: 'http://localhost:8080',
	realmName: 'master',
	credentials: {
		type: 'password',
		username: '', // Must be set via environment variable
		password: '', // Must be set via environment variable
	},
	timeout: KEYCLOAK_TIMEOUT * KEYCLOAK_TIMEOUT_30_SECONDS_MULTIPLIER, // 30 seconds
	retry: {
		maxRetries: 3,
		initialDelay: KEYCLOAK_TIMEOUT,
	},
};

/**
 * Validate a `IKeycloakAdminConfig` object using Joi.
 *
 * Throws an `Error` with a descriptive message if validation fails.
 * Called automatically by `KeycloakAdminModule` during initialization.
 *
 * @param config - The configuration object to validate
 * @throws {Error} If any required field is missing or invalid
 */
export function ValidateKeycloakAdminConfig(config: IKeycloakAdminConfig): void {
	const Schema = Joi.object({
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
					password: Joi.string().required(),
				}),
				Joi.object({
					type: Joi.string().valid('clientCredentials').required(),
					clientId: Joi.string().required(),
					clientSecret: Joi.string().required(),
				}),
			)
			.required(),
		timeout: Joi.number().min(KEYCLOAK_TIMEOUT).optional(),
		retry: Joi.object({
			maxRetries: Joi.number().min(0).required(),
			initialDelay: Joi.number().min(0).required(),
		}).optional(),
		permissions: Joi.array()
			.items(Joi.string().valid(...KEYCLOAK_ALL_SCOPES))
			.optional(),
	});

	const { error } = Schema.validate(config);
	if (error) {
		throw new Error(`Keycloak configuration validation failed: ${error.details.map((d) => d.message).join(', ')}`);
	}
}
