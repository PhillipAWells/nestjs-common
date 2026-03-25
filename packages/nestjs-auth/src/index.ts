/** @packageDocumentation */

// ============================================================================
// Keycloak Module — Token Validation and JWT Authentication
// ============================================================================
export { KeycloakModule } from './keycloak/keycloak.module.js';
export { KeycloakTokenValidationService } from './keycloak/services/keycloak-token-validation.service.js';
export { JwksCacheService } from './keycloak/services/jwks-cache.service.js';
export type { TokenValidationResult } from './keycloak/services/keycloak-token-validation.service.js';
export type { KeycloakModuleOptions, KeycloakTokenClaims, KeycloakUser } from './keycloak/keycloak.types.js';
export type { KeycloakModuleAsyncOptions } from './keycloak/keycloak.interfaces.js';
export { KEYCLOAK_MODULE_OPTIONS } from './keycloak/keycloak.constants.js';

// ============================================================================
// Keycloak Admin Module — Admin REST API
// ============================================================================
export { KeycloakAdminModule } from './admin/keycloak-admin.module.js';
export { KeycloakAdminService } from './admin/services/keycloak-admin.service.js';
export { KeycloakHealthIndicator } from './admin/health/keycloak.health.js';
export type { KeycloakAdminConfig } from './admin/config/keycloak.config.js';
export type { KeycloakAdminModuleAsyncOptions } from './admin/keycloak-admin.interfaces.js';
export { KeycloakAdminDefaults, validateKeycloakAdminConfig } from './admin/config/keycloak.defaults.js';
export { KEYCLOAK_ADMIN_CONFIG_TOKEN } from './admin/keycloak.constants.js';

// Keycloak Admin Permission Scopes
export type { KeycloakAdminScope } from './admin/permissions/keycloak-admin.permissions.js';
export { KEYCLOAK_DEFAULT_SCOPES, KEYCLOAK_ALL_SCOPES, KeycloakAdminScopeError } from './admin/permissions/keycloak-admin.permissions.js';

// Keycloak Admin Client
export { KeycloakClient } from './admin/client/client.js';

// Keycloak Admin Services
export { BaseService } from './admin/client/services/base-service.js';
export { RealmService } from './admin/client/services/realm.service.js';
export { UserService } from './admin/client/services/user.service.js';
export { ClientService } from './admin/client/services/client.service.js';
export { RoleService } from './admin/client/services/role.service.js';
export { GroupService } from './admin/client/services/group.service.js';
export { IdentityProviderService } from './admin/client/services/identity-provider.service.js';
export { AuthenticationService } from './admin/client/services/authentication.service.js';
export { FederatedIdentityService } from './admin/client/services/federated-identity.service.js';
export type { FederatedIdentityLink } from './admin/client/services/federated-identity.service.js';
export { EventService } from './admin/client/services/event.service.js';

// Keycloak Admin Types
export type { KeycloakClientConfig } from './admin/client/types/config.types.js';
export type { AdminEventQuery, AccessEventQuery, KeycloakAdminEvent, KeycloakAccessEvent } from './admin/client/types/event.types.js';

// Keycloak Admin Errors
export {
	KeycloakClientError,
	AuthenticationError,
	AuthorizationError,
	NotFoundError,
	ValidationError,
	RateLimitError,
	TimeoutError,
	NetworkError,
	ConflictError,
} from './admin/client/errors/base-error.js';

// Keycloak Admin Utils
export { withRetry } from './admin/client/utils/retry.js';

// ============================================================================
// Guards — Authorization and JWT
// ============================================================================
export { JwtAuthGuard } from './guards/jwt-auth.guard.js';
export { RoleGuard } from './guards/role.guard.js';
export { PermissionGuard } from './guards/permission.guard.js';

// ============================================================================
// Decorators — Auth Context and Metadata
// ============================================================================
export {
	Auth,
	Public,
	Roles,
	Permissions,
	CurrentUser,
	AuthToken,
	IS_PUBLIC_KEY,
	ROLES_KEY,
	PERMISSIONS_KEY,
	detectContextType,
	extractRequestFromContext,
	extractUserFromContext,
	extractAuthTokenFromContext,
} from './decorators/auth-decorators.js';

export type { ContextOptions } from './decorators/auth-decorators.js';

export {
	GraphQLPublic,
	GraphQLAuth,
	GraphQLRoles,
	GraphQLCurrentUser,
	GraphQLAuthToken,
	GraphQLContextParam,
	GraphQLUser,
} from './decorators/graphql-auth-decorators.js';

export { ExtractRequestFromContext, ExtractUserFromContext, ExtractAuthTokenFromContext, DetectContextType } from './decorators/context-utils.js';
