// Main exports
export { AuthModule } from './auth/auth.module.js';
export type { AuthModuleOptions } from './auth/auth.module.js';
export { AuthService } from './auth/auth.service.js';
export { JWTStrategy } from './auth/jwt.strategy.js';
export { TokenBlacklistService } from './auth/token-blacklist.service.js';
export { AuthController } from './auth/auth.controller.js';
export { JWTAuthGuard } from './auth/jwt-auth.guard.js';

// Guards
export { BaseAuthGuard } from './guards/base-auth.guard.js';

// Auth Middleware
export * from './middleware/auth-middleware.js';

// OAuth exports
export { OAuthModule } from './lib/oauth/oauth.module.js';
export type { OAuthModuleOptions, OAuthProviderConfig, KeycloakConfig, OAuthUser, OAuthToken } from './lib/oauth/types/oauth-config.types.js';
export { OAuthService } from './lib/oauth/oauth.service.js';
export { KeycloakStrategy } from './lib/oauth/strategies/keycloak.strategy.js';
export { OIDCStrategy } from './lib/oauth/strategies/oidc.strategy.js';
export { OAuthGuard } from './lib/oauth/guards/oauth.guard.js';
export { GetOAuthUser, OAuthRoles, OAuthProvider } from './lib/oauth/decorators/oauth.decorators.js';

// Decorators
export {
	Auth,
	Public,
	Roles,
	CurrentUser,
	AuthToken,
	IS_PUBLIC_KEY,
	ROLES_KEY,
	detectContextType,
	extractRequestFromContext,
	extractUserFromContext,
	GraphQLPublic,
	GraphQLAuth,
	GraphQLRoles,
	GraphQLCurrentUser,
	GraphQLAuthToken,
	GraphQLContextParam,
	GraphQLUser
} from './decorators/index.js';

export type { ContextOptions } from './decorators/index.js';

// Keycloak Admin
export * from './lib/keycloak/index.js';
