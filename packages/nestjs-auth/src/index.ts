// ============================================================================
// Auth Module Exports
// ============================================================================
export { AuthModule } from './auth/auth/auth.module.js';
export type { AuthModuleOptions } from './auth/auth/auth.module.js';
export { AuthService } from './auth/auth/auth.service.js';
export { JWTStrategy } from './auth/auth/jwt.strategy.js';
export { TokenBlacklistService } from './auth/auth/token-blacklist.service.js';
export { AuthController } from './auth/auth/auth.controller.js';
export { JWTAuthGuard } from './auth/auth/jwt-auth.guard.js';

// Guards
export { BaseAuthGuard } from './auth/guards/base-auth.guard.js';
export { RoleGuard } from './auth/guards/role.guard.js';
export { PermissionGuard } from './auth/guards/permission.guard.js';

// Auth Middleware
export * from './auth/middleware/auth-middleware.js';

// OAuth exports
export { OAuthModule } from './auth/lib/oauth/oauth.module.js';
export type { OAuthModuleOptions, OAuthProviderConfig, KeycloakConfig, OAuthUser, OAuthToken } from './auth/lib/oauth/types/oauth-config.types.js';
export { OAuthService } from './auth/lib/oauth/oauth.service.js';
export { KeycloakStrategy } from './auth/lib/oauth/strategies/keycloak.strategy.js';
export { OIDCStrategy } from './auth/lib/oauth/strategies/oidc.strategy.js';
export { OAuthGuard } from './auth/lib/oauth/guards/oauth.guard.js';
export { GetOAuthUser, OAuthRoles, OAuthProvider } from './auth/lib/oauth/decorators/oauth.decorators.js';

// Decorators
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
	GraphQLPublic,
	GraphQLAuth,
	GraphQLRoles,
	GraphQLCurrentUser,
	GraphQLAuthToken,
	GraphQLContextParam,
	GraphQLUser,
} from './auth/decorators/index.js';

export type { ContextOptions } from './auth/decorators/index.js';

// Keycloak Admin
export * from './auth/lib/keycloak/index.js';

// ============================================================================
// Session Module Exports
// ============================================================================
export { SessionModule } from './session/session.module.js';
export type { SessionModuleOptions } from './session/session.module.js';
export type { Session, SessionDocument, SessionSchema } from './session/session.entity.js';
export { SessionRepository } from './session/session.repository.js';
export { SessionEventEmitter } from './session/session-event.emitter.js';
export { SessionEventType } from './session/session.types.js';
export { SessionService } from './session/session.service.js';
export { SessionResolver } from './session/session.resolver.js';
export {
	SessionType,
	SessionAuthPayload,
	SessionEvent,
	SessionDeviceInfo,
	SessionUserProfile,
	SessionLoginRecord,
	SessionPreferencesInput,
} from './session/session.graphql.js';
export type { ISessionEvent, ISessionConfig, IDeviceInfo, IUserProfile } from './session/session.types.js';
