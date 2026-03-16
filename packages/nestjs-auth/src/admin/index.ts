export { KeycloakAdminModule } from './keycloak-admin.module.js';
export { KeycloakAdminService } from './services/keycloak-admin.service.js';
export { KeycloakHealthIndicator } from './health/keycloak.health.js';
export type { KeycloakAdminConfig } from './config/keycloak.config.js';
export { KeycloakAdminDefaults, validateKeycloakAdminConfig } from './config/keycloak.defaults.js';
export { KEYCLOAK_ADMIN_CONFIG_TOKEN } from './keycloak.constants.js';

// Keycloak Admin Permission Scopes
export type { KeycloakAdminScope } from './permissions/index.js';
export { KEYCLOAK_DEFAULT_SCOPES, KEYCLOAK_ALL_SCOPES, KeycloakAdminScopeError } from './permissions/index.js';

// Keycloak Client exports
export * from './client/index.js';

// Explicitly export new services and types
export { FederatedIdentityService, type FederatedIdentityLink } from './client/services/federated-identity.service.js';
export { EventService } from './client/services/event.service.js';
export type { AdminEventQuery, AccessEventQuery, KeycloakAdminEvent, KeycloakAccessEvent } from './client/types/event.types.js';
