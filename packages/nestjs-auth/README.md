# @pawells/nestjs-auth

[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-auth.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Comprehensive NestJS authentication module with JWT, sessions, OAuth/OIDC, and Keycloak integration. Provides role-based access control (RBAC), permission-based access control (PBAC), token blacklisting with Redis, concurrent session management, and multi-provider OAuth/OIDC support.

## Table of Contents

- [Installation](#installation)
- [Requirements](#requirements)
- [Core Features](#core-features)
- [Quick Start](#quick-start)
- [JWT Authentication](#jwt-authentication)
- [Authorization Decorators](#authorization-decorators)
- [Guards](#guards)
- [Token Blacklist](#token-blacklist)
- [Session Management](#session-management)
- [OAuth/OIDC Integration](#oauthoidc-integration)
- [Keycloak Integration](#keycloak-integration)
- [GraphQL Support](#graphql-support)
- [Configuration Reference](#configuration-reference)
- [API Reference](#api-reference)

## Installation

```bash
yarn add @pawells/nestjs-auth
```

## Requirements

- **Node.js**: >= 24.0.0
- **NestJS**: >= 10.0.0
- **@pawells/nestjs-shared**: same version as @pawells/nestjs-auth
- **Redis** (optional): Required for token blacklisting and session tracking. Applications must import `CacheModule` from `@pawells/nestjs-graphql` before importing `AuthModule`.

## Peer Dependencies

```json
{
  "@nestjs/common": ">=10.0.0",
  "@nestjs/core": ">=10.0.0",
  "@nestjs/graphql": ">=12.0.0",
  "@nestjs/jwt": ">=10.0.0",
  "@nestjs/mongoose": ">=10.0.0",
  "@nestjs/passport": ">=10.0.0",
  "@nestjs/terminus": ">=10.0.0",
  "axios": ">=1.0.0",
  "bcryptjs": ">=2.0.0",
  "ioredis": ">=5.0.0",
  "joi": ">=17.0.0",
  "jwk-to-pem": ">=2.0.0",
  "mongoose": ">=8.0.0",
  "passport-jwt": ">=4.0.0",
  "passport-oauth2": ">=1.0.0",
  "passport-openidconnect": ">=0.1.0",
  "uuid": ">=9.0.0"
}
```

## Core Features

### Authentication
- **JWT Strategy**: Passport JWT integration with configurable expiration and signing algorithms
- **Token Blacklist**: Redis-backed token revocation with fail-closed behavior
- **Concurrent Session Management**: Atomic Lua-based session tracking with per-user limits
- **JWTAuthGuard**: Standalone guard protecting HTTP routes with JWT validation
- **BaseAuthGuard**: Abstract guard supporting JWT, Keycloak, and OAuth strategies

### Authorization
- **Role-Based Access Control (RBAC)**: `@Roles` decorator with flexible role matching
- **Permission-Based Access Control (PBAC)**: `@Permissions` decorator enforcing all required permissions
- **RoleGuard**: Validates user roles against route requirements
- **PermissionGuard**: Validates user permissions against route requirements

### Sessions
- **SessionModule**: MongoDB-backed session persistence with TTL management
- **Session Events**: Track login, logout, token refresh, and session revocation
- **Concurrent Session Limits**: Enforce maximum concurrent sessions per user with optional admin overrides
- **Session Repository**: Direct MongoDB access with query builders
- **GraphQL Resolver**: Query and mutate sessions via GraphQL

### OAuth / OIDC
- **Multi-Provider Support**: Google, GitHub, Keycloak, and any OIDC provider
- **OAuthModule**: Dynamic configuration for OAuth2/OIDC flows
- **OAuthService**: Token verification, refresh, and user info retrieval
- **Keycloak Strategy**: Native Keycloak support with client credentials and password flows
- **OIDC Strategy**: Generic OpenID Connect with standard claims
- **Token Caching**: JWK caching with single-flight pattern for efficiency
- **Decorators**: Extract provider, user, and roles from OAuth context

### Keycloak Admin
- **Keycloak Admin API Client**: User, role, and group management
- **Credentials Support**: Password and client credentials authentication
- **Health Checks**: Built-in health indicator for Keycloak server availability
- **Retry Logic**: Exponential backoff for transient failures

## Quick Start

### Basic JWT Setup

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '@pawells/nestjs-auth';

@Module({
  imports: [
    AuthModule.forRoot({
      jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
      jwtExpiresIn: '15m',
      userLookupFn: async (userId: string) => {
        // Implement your user lookup logic
        return userService.findById(userId);
      },
    }),
  ],
})
export class AppModule {}
```

### Protecting Routes

```typescript
import {
  Auth,
  Public,
  Roles,
  CurrentUser,
  AuthToken,
  JWTAuthGuard,
} from '@pawells/nestjs-auth';
import { Controller, Get, Post, UseGuards } from '@nestjs/common';

@Controller('users')
@UseGuards(JWTAuthGuard)
export class UsersController {
  @Public()
  @Get('public')
  getPublicData() {
    return { data: 'public' };
  }

  @Auth()
  @Get('profile')
  getProfile(@CurrentUser() user: any) {
    return { user };
  }

  @Roles('admin', 'moderator')
  @Get('admin')
  getAdminData() {
    return { data: 'admin only' };
  }

  @Post('logout')
  logout(@AuthToken() token: string) {
    // Token will be blacklisted automatically
    return { message: 'logged out' };
  }
}
```

## JWT Authentication

### AuthModule Configuration

```typescript
import { AuthModule, AuthModuleOptions } from '@pawells/nestjs-auth';

const authOptions: AuthModuleOptions = {
  // JWT signing secret (required)
  jwtSecret: process.env.JWT_SECRET || 'development-secret',

  // JWT expiration time (default: '15m')
  jwtExpiresIn: '15m',

  // Function to look up users by ID (required)
  userLookupFn: async (userId: string) => {
    return userRepository.findById(userId);
  },

  // OAuth configuration (optional)
  oauth: {
    providers: {
      keycloak: {
        // provider config
      },
    },
  },
};

@Module({
  imports: [AuthModule.forRoot(authOptions)],
})
export class AppModule {}
```

### AuthService

The `AuthService` handles user authentication and token management:

```typescript
import { AuthService, User, AuthResponse } from '@pawells/nestjs-auth';
import { Injectable } from '@nestjs/common';

@Injectable()
export class LoginService {
  constructor(private authService: AuthService) {}

  async loginUser(email: string, password: string): Promise<AuthResponse> {
    // Validate user credentials
    const user = await userRepository.findByEmail(email);
    const validUser = await this.authService.validateUser(user, password);

    if (!validUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT tokens
    const authResponse = this.authService.login(validUser);
    return authResponse;
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number; tokenType: string }> {
    return this.authService.refreshToken(refreshToken, userRepository.findById);
  }
}
```

### JWT Claims Structure

```typescript
interface JWTPayload {
  sub: string;           // User ID (subject)
  email: string;         // User email
  role: string;          // User role
  type?: 'access' | 'refresh'; // Token type
  iss?: string;          // Issuer
  aud?: string;          // Audience
  exp?: number;          // Expiration timestamp
  iat?: number;          // Issued at timestamp
}
```

## Authorization Decorators

### @Auth and @Public

Mark routes as requiring or explicitly allowing public access:

```typescript
@Controller('posts')
@UseGuards(JWTAuthGuard)
export class PostsController {
  @Public()
  @Get()
  listPublicPosts() {
    return [];
  }

  @Auth() // Explicitly require auth (redundant with guard, but semantic)
  @Post()
  createPost(@Body() dto: CreatePostDto, @CurrentUser() user: any) {
    return { created: true };
  }
}
```

### @Roles - Role-Based Access Control

Restrict access by user roles. User must have at least one of the specified roles:

```typescript
import { UseGuards } from '@nestjs/common';
import { Roles, RoleGuard } from '@pawells/nestjs-auth';

@Controller('admin')
@UseGuards(JWTAuthGuard, RoleGuard)
export class AdminController {
  @Roles('admin')
  @Delete('users/:id')
  deleteUser(@Param('id') userId: string) {
    return { deleted: true };
  }

  @Roles('admin', 'moderator')
  @Post('ban-user')
  banUser(@Param('id') userId: string) {
    return { banned: true };
  }
}
```

### @Permissions - Permission-Based Access Control

Restrict access by granular permissions. User must have ALL specified permissions:

```typescript
import { Permissions, PermissionGuard } from '@pawells/nestjs-auth';

@Controller('resources')
@UseGuards(JWTAuthGuard, PermissionGuard)
export class ResourceController {
  @Permissions('resource.create', 'resource.read')
  @Post()
  createResource(@Body() dto: CreateResourceDto) {
    return { created: true };
  }

  @Permissions('resource.delete', 'audit.write')
  @Delete(':id')
  deleteResource(@Param('id') id: string) {
    return { deleted: true };
  }
}
```

### @CurrentUser - Extract Authenticated User

Inject the authenticated user into your controller methods:

```typescript
@Get('profile')
getProfile(@CurrentUser() user: User) {
  return user; // { id, email, role, firstName, lastName }
}

// Extract a specific property
@Get('profile/id')
getUserId(@CurrentUser('id') userId: string) {
  return { userId };
}

// Nested property extraction
@Get('profile/email')
getUserEmail(@CurrentUser('profile.email') email: string) {
  return { email };
}
```

### @AuthToken - Extract Authorization Token

Access the raw JWT token from the request:

```typescript
@Get('token-info')
getTokenInfo(@AuthToken() token: string) {
  const payload = this.authService.decodeToken(token);
  return { expiresAt: new Date(payload.exp * 1000) };
}
```

## Guards

### JWTAuthGuard

HTTP guard using JWT Passport strategy. Validates token signature and expiration:

```typescript
import { UseGuards } from '@nestjs/common';
import { JWTAuthGuard } from '@pawells/nestjs-auth';

@Controller('protected')
@UseGuards(JWTAuthGuard)
export class ProtectedController {
  @Get()
  getData() {
    return { data: 'protected' };
  }
}
```

### BaseAuthGuard

Abstract base guard supporting JWT, Keycloak, and OAuth strategies. Extend this for custom context handling:

```typescript
import { BaseAuthGuard } from '@pawells/nestjs-auth';
import { ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class CustomAuthGuard extends BaseAuthGuard {
  protected getContext(context: ExecutionContext): any {
    return context.switchToHttp().getRequest();
  }
}
```

### RoleGuard

Validates user roles against `@Roles` decorator metadata:

```typescript
import { UseGuards } from '@nestjs/common';
import { Roles, JWTAuthGuard, RoleGuard } from '@pawells/nestjs-auth';

@Controller('admin')
@UseGuards(JWTAuthGuard, RoleGuard)
export class AdminController {
  @Roles('admin')
  @Get()
  getAdminPanel() {
    return { admin: true };
  }
}
```

Supports flexible role formats in the user object:
- `role?: string` - Single role
- `roles?: string[]` - Array of roles
- `roles?: string` - Comma-separated roles

### PermissionGuard

Validates user permissions against `@Permissions` decorator metadata:

```typescript
import { UseGuards } from '@nestjs/common';
import { Permissions, JWTAuthGuard, PermissionGuard } from '@pawells/nestjs-auth';

@Controller('resources')
@UseGuards(JWTAuthGuard, PermissionGuard)
export class ResourceController {
  @Permissions('resource.read', 'audit.read')
  @Get()
  listResources() {
    return [];
  }
}
```

User must have `permissions` array or comma-separated string on the user object.

## Token Blacklist

### Overview

Token blacklist provides fail-closed revocation using Redis. When the cache is unavailable, tokens are treated as blacklisted for security.

### TokenBlacklistService

```typescript
import { TokenBlacklistService } from '@pawells/nestjs-auth';

@Injectable()
export class LogoutService {
  constructor(private tokenBlacklist: TokenBlacklistService) {}

  async revokeToken(token: string): Promise<void> {
    const expiresInSeconds = 900; // Token expires in 15 minutes
    await this.tokenBlacklist.blacklistToken(token, expiresInSeconds);
  }

  async checkTokenStatus(token: string): Promise<boolean> {
    const isBlacklisted = await this.tokenBlacklist.isTokenBlacklisted(token);
    return isBlacklisted;
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.tokenBlacklist.revokeUserTokens(userId);
  }
}
```

### Automatic Logout

The `/auth/logout` endpoint automatically blacklists the access token:

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Implementation Details

- **Fail-Closed Behavior**: When Redis is unavailable, `isTokenBlacklisted()` returns `true`, rejecting all tokens
- **TTL-Based Cleanup**: Redis handles automatic expiration; no manual cleanup required
- **Rate Limiting**: Logout and refresh endpoints use throttling to prevent abuse
- **Audit Logging**: All token operations are logged for security audit trails

## Session Management

### SessionModule Configuration

```typescript
import { SessionModule, SessionModuleOptions } from '@pawells/nestjs-auth';
import Redis from 'ioredis';

const sessionOptions: SessionModuleOptions = {
  config: {
    sessionTtlMinutes: 1440, // 24 hours
    enforceSessionLimit: true,
    defaultMaxConcurrentSessions: 5,
  },
  redisClient: new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  }),
};

@Module({
  imports: [SessionModule.forRoot(sessionOptions)],
})
export class AppModule {}
```

### SessionService

```typescript
import { SessionService, Session } from '@pawells/nestjs-auth';

@Injectable()
export class AuthFlowService {
  constructor(private sessionService: SessionService) {}

  async createSession(deviceInfo: IDeviceInfo): Promise<Session> {
    return this.sessionService.CreateOrGetSession(deviceInfo);
  }

  async authenticateSession(
    sessionId: string,
    userProfile: IUserProfile,
    accessToken: string,
    refreshToken: string,
  ): Promise<Session> {
    const now = new Date();
    const accessTokenExpiry = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes
    const refreshTokenExpiry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days

    return this.sessionService.AuthenticateSession(
      sessionId,
      userProfile,
      accessToken,
      refreshToken,
      accessTokenExpiry,
      refreshTokenExpiry,
      deviceInfo,
      'keycloak',
    );
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionService.LogoutSession(sessionId);
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return this.sessionService.GetUserSessions(userId);
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionService.RevokeSession(sessionId);
  }
}
```

### Concurrent Session Management

Sessions are atomically tracked using Lua scripts (Redis) or fallback non-atomic tracking:

```typescript
const result = await this.authService.trackUserSession(
  userId,
  sessionId,
  maxConcurrentSessions,
);

if (result.allowed) {
  // Session allowed
} else {
  // Max sessions reached, oldest session was evicted
}
```

## OAuth/OIDC Integration

### OAuthModule Configuration

```typescript
import { OAuthModule, OAuthModuleOptions } from '@pawells/nestjs-auth';

const oauthOptions: OAuthModuleOptions = {
  providers: {
    keycloak: {
      clientID: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      authorizationURL: 'https://keycloak.example.com/auth/realms/my-realm/protocol/openid-connect/auth',
      tokenURL: 'https://keycloak.example.com/auth/realms/my-realm/protocol/openid-connect/token',
      userInfoURL: 'https://keycloak.example.com/auth/realms/my-realm/protocol/openid-connect/userinfo',
    },
    google: {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenURL: 'https://oauth2.googleapis.com/token',
      userInfoURL: 'https://www.googleapis.com/oauth2/v2/userinfo',
    },
  },
};

@Module({
  imports: [
    AuthModule.forRoot({
      jwtSecret: process.env.JWT_SECRET,
      userLookupFn: userService.findById.bind(userService),
      oauth: oauthOptions,
    }),
  ],
})
export class AppModule {}
```

### OAuthService

Token verification, refresh, and user info retrieval:

```typescript
import { OAuthService } from '@pawells/nestjs-auth';

@Injectable()
export class ExternalAuthService {
  constructor(private oauthService: OAuthService) {}

  async verifyToken(token: string, provider: string): Promise<OAuthUser> {
    return this.oauthService.verifyToken(token, provider);
  }

  async refreshToken(
    refreshToken: string,
    provider: string,
  ): Promise<OAuthToken> {
    return this.oauthService.refreshToken(refreshToken, provider);
  }

  async getUserInfo(accessToken: string, provider: string): Promise<OAuthUser> {
    return this.oauthService.getUserInfo(accessToken, provider);
  }

  extractRolesFromToken(decoded: any): string[] {
    return this.oauthService.extractRolesFromToken(decoded);
  }
}
```

### OAuth Strategies

#### KeycloakStrategy

Native Keycloak OAuth2 strategy:

```typescript
import { KeycloakStrategy } from '@pawells/nestjs-auth';

@UseGuards(OAuthGuard)
@Controller('auth/keycloak')
export class KeycloakAuthController {
  @Post('callback')
  keycloakCallback(@GetOAuthUser() user: OAuthUser) {
    return { user };
  }
}
```

#### OIDCStrategy

Generic OpenID Connect strategy supporting any OIDC provider:

```typescript
import { OIDCStrategy, OAuthGuard } from '@pawells/nestjs-auth';

@UseGuards(OAuthGuard)
@Controller('auth/oidc')
export class OIDCAuthController {
  @Post('callback')
  oidcCallback(@GetOAuthUser() user: OAuthUser) {
    return { user };
  }
}
```

### OAuth Decorators

```typescript
import {
  GetOAuthUser,
  OAuthProvider,
  OAuthRoles,
  OAuthGuard,
} from '@pawells/nestjs-auth';

@UseGuards(OAuthGuard)
@Controller('oauth')
export class OAuthController {
  @Get('profile')
  getProfile(
    @GetOAuthUser() user: OAuthUser,
    @OAuthProvider() provider: string,
    @OAuthRoles() roles: string[],
  ) {
    return { user, provider, roles };
  }
}
```

## Keycloak Integration

### KeycloakAdminModule

Keycloak Admin API client for server-side user/role management:

```typescript
import { KeycloakAdminModule } from '@pawells/nestjs-auth';

@Module({
  imports: [
    KeycloakAdminModule.forRoot({
      enabled: process.env.KEYCLOAK_ENABLED === 'true',
      serverUrl: process.env.KEYCLOAK_SERVER_URL,
      realm: process.env.KEYCLOAK_REALM,
      credentials: {
        type: 'clientCredentials',
        clientId: process.env.KEYCLOAK_CLIENT_ID,
        clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      },
    }),
  ],
})
export class AppModule {}
```

### KeycloakAdminService

User, role, and group management:

```typescript
import { KeycloakAdminService } from '@pawells/nestjs-auth';

@Injectable()
export class UserManagementService {
  constructor(private keycloak: KeycloakAdminService) {}

  async createUser(email: string, firstName: string): Promise<any> {
    return this.keycloak.users.create({
      email,
      firstName,
      enabled: true,
    });
  }

  async assignRole(userId: string, roleName: string): Promise<void> {
    await this.keycloak.users.assignRole(userId, roleName);
  }

  async getRoles(): Promise<any[]> {
    return this.keycloak.roles.list();
  }

  async createGroup(name: string): Promise<any> {
    return this.keycloak.groups.create({ name });
  }
}
```

### Keycloak Configuration Options

```typescript
interface KeycloakAdminConfig {
  enabled: boolean;
  serverUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  username?: string; // For password credentials
  password?: string; // For password credentials
  retryAttempts?: number; // Default: 3
  retryDelay?: number; // Default: 1000ms
}
```

## GraphQL Support

### GraphQL Auth Decorators

GraphQL-specific versions of auth decorators with automatic context handling:

```typescript
import {
  GraphQLAuth,
  GraphQLPublic,
  GraphQLRoles,
  GraphQLCurrentUser,
  GraphQLAuthToken,
  GraphQLContextParam,
  GraphQLUser,
} from '@pawells/nestjs-auth';
import { Resolver, Query, Mutation } from '@nestjs/graphql';

@Resolver(() => User)
export class UserResolver {
  @Query(() => User)
  @GraphQLPublic()
  async publicUser(): Promise<User> {
    return { id: '1', email: 'public@example.com' };
  }

  @Query(() => User)
  @GraphQLAuth()
  async currentUser(@GraphQLCurrentUser() user: User): Promise<User> {
    return user;
  }

  @Query(() => [User])
  @GraphQLRoles('admin')
  async allUsers(@GraphQLContextParam() context: any): Promise<User[]> {
    return [];
  }

  @Mutation(() => Boolean)
  async validateToken(@GraphQLAuthToken() token: string): Promise<boolean> {
    return !!token;
  }

  @Query(() => String)
  async getUserId(@GraphQLCurrentUser('id') userId: string): Promise<string> {
    return userId;
  }

  // Alias: @GraphQLUser === @GraphQLCurrentUser
  @Query(() => User)
  async me(@GraphQLUser() user: User): Promise<User> {
    return user;
  }
}
```

### GraphQL Context Integration

The context utilities automatically detect GraphQL vs HTTP context:

```typescript
// In GraphQL resolver
@Query(() => User)
async me(@CurrentUser() user: User): Promise<User> {
  // Works automatically in GraphQL context
  return user;
}

// Explicit context type
@Query(() => User)
async getUserExplicit(
  @CurrentUser(undefined, { contextType: 'graphql' }) user: User,
): Promise<User> {
  return user;
}
```

## Configuration Reference

### AuthModuleOptions

```typescript
interface AuthModuleOptions {
  // JWT secret for signing tokens (required)
  jwtSecret: string;

  // JWT expiration time (default: '15m')
  jwtExpiresIn?: string;

  // Function to lookup user by ID (required)
  userLookupFn: (userId: string) => Promise<User | null>;

  // OAuth configuration (optional)
  oauth?: OAuthModuleOptions;
}
```

### SessionModuleOptions

```typescript
interface SessionModuleOptions {
  // Session configuration
  config: ISessionConfig;

  // Redis client instance for session tracking
  redisClient: Redis;
}

interface ISessionConfig {
  // Session TTL in minutes (default: 1440 = 24 hours)
  sessionTtlMinutes: number;

  // Enforce maximum concurrent sessions per user
  enforceSessionLimit: boolean;

  // Maximum concurrent sessions per user
  defaultMaxConcurrentSessions?: number;
}
```

### OAuthModuleOptions

```typescript
interface OAuthModuleOptions {
  // OAuth provider configurations
  providers: {
    [name: string]: OAuthProviderConfig;
  };
}

interface OAuthProviderConfig {
  clientID: string;
  clientSecret: string;
  authorizationURL: string;
  tokenURL: string;
  userInfoURL: string;
}
```

## API Reference

### Classes & Services

- **AuthService**: Core authentication service with user validation, JWT generation, and token management
- **TokenBlacklistService**: Redis-backed token revocation with fail-closed behavior
- **SessionService**: Session lifecycle management with MongoDB persistence
- **SessionRepository**: MongoDB session data access layer
- **SessionEventEmitter**: Event publication for session state changes
- **OAuthService**: OAuth token verification, refresh, and user info retrieval
- **KeycloakAdminService**: Keycloak Admin API client for user/role/group management

### Guards

- **JWTAuthGuard**: HTTP guard for JWT validation
- **BaseAuthGuard**: Abstract base for custom auth guards
- **RoleGuard**: Role-based authorization guard
- **PermissionGuard**: Permission-based authorization guard
- **OAuthGuard**: OAuth strategy guard

### Decorators (HTTP/GraphQL)

- **@Auth()**: Require authentication
- **@Public()**: Allow public access
- **@Roles(...roles)**: Require one of specified roles
- **@Permissions(...permissions)**: Require all specified permissions
- **@CurrentUser(property?)**: Inject current user (or property)
- **@AuthToken()**: Inject authorization token
- **@ContextOptions**: Specify context detection options

### GraphQL Decorators

- **@GraphQLAuth()**: GraphQL require authentication
- **@GraphQLPublic()**: GraphQL allow public access
- **@GraphQLRoles(...roles)**: GraphQL role-based authorization
- **@GraphQLCurrentUser(property?)**: Inject user in GraphQL context
- **@GraphQLAuthToken()**: Inject token in GraphQL context
- **@GraphQLContextParam()**: Inject GraphQL context
- **@GraphQLUser(property?)**: Alias for @GraphQLCurrentUser

### OAuth Decorators

- **@GetOAuthUser()**: Extract OAuth user from context
- **@OAuthProvider()**: Extract OAuth provider name
- **@OAuthRoles()**: Extract roles from OAuth token

### Types & Interfaces

- **User**: User object with email, role, firstName, lastName, isActive
- **AuthResponse**: Login response with accessToken, refreshToken, expiresIn
- **JWTPayload**: JWT claims structure
- **OAuthUser**: OAuth provider user information
- **OAuthToken**: OAuth access/refresh token pair
- **Session**: Session document with user, device, and token info
- **SessionEventType**: Session lifecycle event enum

## Security Considerations

### Token Blacklist

- **Fail-Closed**: When Redis is unavailable, all tokens are treated as blacklisted
- **TTL-Based**: Blacklist entries automatically expire using Redis TTL
- **Rate-Limited**: Logout endpoint has throttling to prevent abuse

### Session Management

- **Atomic Tracking**: Uses Lua scripts to atomically update session lists under high concurrency
- **TOCTOU Protection**: Single-flight requests prevent race conditions
- **Max Session Limits**: Enforces per-user session limits with automatic oldest-session eviction

### Password Security

- **Bcrypt**: Passwords are hashed with bcryptjs before storage
- **Comparison**: Password validation uses bcrypt.compare() for timing-attack resistance
- **Never Logged**: Password hashes are never logged or exposed in responses

### Keycloak

- **Credential Types**: Supports both password and client credentials authentication
- **Token Validation**: JWK-based signature verification with caching
- **Retry Logic**: Exponential backoff for transient failures

## Related Packages

- **[@pawells/nestjs-shared](https://www.npmjs.com/package/@pawells/nestjs-shared)** - Foundation library with filters, guards, interceptors, logging, CSRF, error handling
- **[@pawells/nestjs-graphql](https://www.npmjs.com/package/@pawells/nestjs-graphql)** - GraphQL module with Redis cache, DataLoaders, subscriptions
- **[@pawells/nestjs-open-telemetry](https://www.npmjs.com/package/@pawells/nestjs-open-telemetry)** - OpenTelemetry tracing and metrics integration

## License

MIT
