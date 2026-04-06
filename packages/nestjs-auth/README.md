# NestJS Authentication Module

[![GitHub Release](https://img.shields.io/github/v/release/PhillipAWells/nestjs-common)](https://github.com/PhillipAWells/nestjs-common/releases)
[![CI](https://github.com/PhillipAWells/nestjs-common/actions/workflows/ci.yml/badge.svg)](https://github.com/PhillipAWells/nestjs-common/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-auth.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-auth)
[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/PhillipAWells?style=social)](https://github.com/sponsors/PhillipAWells)

Keycloak integration library for NestJS resource servers. Validates Keycloak-issued access tokens (online introspection by default; offline JWKS opt-in), enforces role and permission guards on HTTP and GraphQL routes, and provides a typed Admin REST API client for user management, federated identity, and event polling.

This package does **not** issue tokens, manage passwords, or run login flows — those are Keycloak's responsibility.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [KeycloakModule](#keycloakmodule)
- [Token Validation Modes](#token-validation-modes)
- [Guards](#guards)
- [Decorators](#decorators)
- [KeycloakAdminModule](#keycloakadminmodule)
- [Federated Identity](#federated-identity)
- [Event Polling](#event-polling)
- [Keycloak Client Configuration](#keycloak-client-configuration)
- [Security Notes](#security-notes)

## Installation

```bash
yarn add @pawells/nestjs-auth
```

### Peer Dependencies

| Package | Version | Required |
|---|---|---|
| `@nestjs/common` | `>=10.0.0` | Yes |
| `@nestjs/core` | `>=10.0.0` | Yes |
| `@nestjs/jwt` | `>=10.0.0` | Yes |
| `@nestjs/terminus` | `>=10.0.0` | Yes |
| `joi` | `>=17.0.0` | Yes |
| `@nestjs/graphql` | `>=12.0.0` | Yes — required to use GraphQL decorators |
| `jwks-rsa` | `>=3.0.0` | No — required only for offline (JWKS) validation mode |

## Quick Start

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  KeycloakModule,
  KeycloakAdminModule,
  JwtAuthGuard,
} from '@pawells/nestjs-auth';

@Module({
  imports: [
    KeycloakModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        authServerUrl: config.get('KEYCLOAK_AUTH_SERVER_URL'),
        realm: config.get('KEYCLOAK_REALM'),
        clientId: config.get('KEYCLOAK_CLIENT_ID'),
        clientSecret: config.get('KEYCLOAK_CLIENT_SECRET'),
      }),
    }),
    KeycloakAdminModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        enabled: config.get('KEYCLOAK_ADMIN_ENABLED') === 'true',
        baseUrl: config.get('KEYCLOAK_BASE_URL'),
        realmName: config.get('KEYCLOAK_REALM'),
        credentials: {
          type: 'clientCredentials',
          clientId: config.get('KEYCLOAK_ADMIN_CLIENT_ID'),
          clientSecret: config.get('KEYCLOAK_ADMIN_CLIENT_SECRET'),
        },
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
```

## KeycloakModule

`KeycloakModule` configures token validation for the service. It provides `KeycloakTokenValidationService` to all modules via its exports.

### Options

| Field | Type | Default | Description |
|---|---|---|---|
| `authServerUrl` | `string` | — | Keycloak realm base URL, e.g. `https://auth.example.com/realms/myrealm` |
| `realm` | `string` | — | Keycloak realm name |
| `clientId` | `string` | — | This service's Keycloak client ID — used for audience validation and client role extraction |
| `validationMode` | `'online' \| 'offline'` | `'online'` | Token validation strategy — see [Token Validation Modes](#token-validation-modes) |
| `clientSecret` | `string` | — | Client secret for the introspection endpoint. Required when `validationMode` is `'online'` (the default) |
| `jwksCacheTtlMs` | `number` | `300000` | JWKS public key cache TTL in milliseconds. Used in offline mode only |
| `issuer` | `string` | `authServerUrl` | Expected `iss` claim value. Must match exactly. Defaults to `authServerUrl` |

### forRoot

```typescript
KeycloakModule.forRoot({
  authServerUrl: 'https://auth.example.com/realms/myrealm',
  realm: 'myrealm',
  clientId: 'my-service',
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
});
```

### forRootAsync

```typescript
KeycloakModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    authServerUrl: config.get('KEYCLOAK_AUTH_SERVER_URL'),
    realm: config.get('KEYCLOAK_REALM'),
    clientId: config.get('KEYCLOAK_CLIENT_ID'),
    clientSecret: config.get('KEYCLOAK_CLIENT_SECRET'),
  }),
});
```

## Token Validation Modes

### Online (default)

Validates each token by calling Keycloak's introspection endpoint (`/protocol/openid-connect/token/introspect`). The introspection response is authoritative: it detects revoked tokens and expired sessions immediately.

- Requires `clientSecret`
- Adds a network round-trip per request
- **Recommended for most deployments**

### Offline (opt-in)

Validates the JWT signature locally using Keycloak's JWKS endpoint. Public keys are fetched once and cached.

- Does not detect revocation — a revoked token remains valid until its `exp` claim passes
- No network hop after the initial key fetch
- Validates `exp`, `iss`, and `aud` claims locally
- Requires the `jwks-rsa` peer dependency
- Set `validationMode: 'offline'` to enable

```typescript
KeycloakModule.forRoot({
  authServerUrl: 'https://auth.example.com/realms/myrealm',
  realm: 'myrealm',
  clientId: 'my-service',
  validationMode: 'offline',
  jwksCacheTtlMs: 600000, // 10 minutes
});
```

Use offline mode only when request throughput makes per-request introspection impractical and token lifetimes are short enough to bound the revocation window.

## Guards

### JwtAuthGuard

Validates the Keycloak access token on every incoming request. Extracts the `Bearer` token from the `Authorization` header, calls `KeycloakTokenValidationService.validateToken`, and attaches the resolved `KeycloakUser` to `request.user`.

Routes decorated with `@Public()` bypass the guard entirely.

**Register globally (recommended):**

```typescript
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@pawells/nestjs-auth';

// In your AppModule providers array:
{
  provide: APP_GUARD,
  useClass: JwtAuthGuard,
}
```

**Per-route:**

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@pawells/nestjs-auth';

@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {}
```

### RoleGuard

Checks whether the authenticated user holds at least one of the roles listed in `@Roles()`. Roles are matched against the union of `realm_access.roles` and `resource_access[clientId].roles` from the token.

```typescript
import { UseGuards } from '@nestjs/common';
import { RoleGuard, Roles } from '@pawells/nestjs-auth';

@UseGuards(RoleGuard)
@Controller('admin')
export class AdminController {
  @Roles('admin', 'moderator')
  @Get('users')
  listUsers() {
    return [];
  }
}
```

### PermissionGuard

Checks whether the authenticated user holds at least one of the values listed in `@Permissions()`, resolved against the same role arrays as `RoleGuard`.

```typescript
import { UseGuards } from '@nestjs/common';
import { PermissionGuard, Permissions } from '@pawells/nestjs-auth';

@UseGuards(PermissionGuard)
@Controller('documents')
export class DocumentsController {
  @Permissions('document.write')
  @Post()
  createDocument(@Body() dto: CreateDocumentDto) {
    return {};
  }
}
```

## Decorators

### HTTP Decorators

| Decorator | Type | Description |
|---|---|---|
| `@Auth()` | Method | Marks the route as requiring authentication (sets `isPublic: false`) |
| `@Public()` | Method | Marks the route as public — `JwtAuthGuard` skips validation |
| `@Roles(...roles)` | Method | Specifies role requirements for `RoleGuard` |
| `@Permissions(...permissions)` | Method | Specifies permission requirements for `PermissionGuard` |
| `@CurrentUser(property?)` | Parameter | Injects the `KeycloakUser` from `request.user`, or a specific property if `property` is given |
| `@AuthToken()` | Parameter | Injects the raw Bearer token string from the `Authorization` header |

```typescript
import { Controller, Get } from '@nestjs/common';
import { Auth, Public, Roles, CurrentUser, AuthToken } from '@pawells/nestjs-auth';
import type { KeycloakUser } from '@pawells/nestjs-auth';

@Controller('me')
export class ProfileController {
  @Public()
  @Get('ping')
  ping() {
    return 'pong';
  }

  @Auth()
  @Get()
  getProfile(@CurrentUser() user: KeycloakUser) {
    return user;
  }

  @Roles('admin')
  @Get('token')
  getToken(@AuthToken() token: string) {
    return { token };
  }

  @Get('id')
  getId(@CurrentUser('id') userId: string) {
    return { userId };
  }
}
```

### GraphQL Decorators

The GraphQL variants are aliases of the HTTP decorators, pre-configured for the GraphQL execution context.

| Decorator | Equivalent to | Notes |
|---|---|---|
| `@GraphQLAuth()` | `@Auth()` | Marks GraphQL resolver as requiring authentication |
| `@GraphQLPublic()` | `@Public()` | Marks GraphQL resolver as public |
| `@GraphQLRoles(...roles)` | `@Roles(...roles)` | Specifies role requirements |
| `@GraphQLCurrentUser(property?)` | `@CurrentUser(property?, { contextType: 'graphql' })` | Injects user from GraphQL context |
| `@GraphQLUser(property?)` | `@GraphQLCurrentUser(property?)` | Alias |
| `@GraphQLAuthToken()` | `@AuthToken({ contextType: 'graphql' })` | Injects Bearer token from GraphQL context |
| `@GraphQLContextParam()` | — | Injects the full GraphQL context object |

```typescript
import { Resolver, Query, Mutation } from '@nestjs/graphql';
import {
  GraphQLAuth,
  GraphQLPublic,
  GraphQLRoles,
  GraphQLCurrentUser,
  GraphQLAuthToken,
} from '@pawells/nestjs-auth';
import type { KeycloakUser } from '@pawells/nestjs-auth';

@Resolver()
export class UserResolver {
  @GraphQLPublic()
  @Query(() => String, { name: 'Health' })
  async health(): Promise<string> {
    return 'ok';
  }

  @GraphQLAuth()
  @Query(() => String, { name: 'Me' })
  async me(@GraphQLCurrentUser() user: KeycloakUser): Promise<string> {
    return user.id;
  }

  @GraphQLRoles('admin')
  @Query(() => [String], { name: 'ListUsers' })
  async listUsers(): Promise<string[]> {
    return [];
  }

  @Mutation(() => Boolean, { name: 'ValidateToken' })
  async validateToken(@GraphQLAuthToken() token: string): Promise<boolean> {
    return !!token;
  }
}
```

## KeycloakAdminModule

`KeycloakAdminModule` provides a typed client for the Keycloak Admin REST API. It is registered as a global module — import it once in `AppModule` and inject `KeycloakAdminService` anywhere.

### Options (KeycloakAdminConfig)

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `false` | When `false` the client is not initialized — useful for disabling in test environments |
| `baseUrl` | `string` | `'http://localhost:8080'` | Keycloak server base URL (not realm-specific) |
| `realmName` | `string` | `'master'` | Target realm for all Admin API calls |
| `credentials.type` | `'password' \| 'clientCredentials'` | `'password'` | Authentication method |
| `credentials.username` | `string` | — | Admin username (password auth only) |
| `credentials.password` | `string` | — | Admin password (password auth only) |
| `credentials.clientId` | `string` | — | Service account client ID (clientCredentials auth only) |
| `credentials.clientSecret` | `string` | — | Service account client secret (clientCredentials auth only) |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `retry.maxRetries` | `number` | `3` | Maximum retry attempts on transient failures |
| `retry.retryDelay` | `number` | `1000` | Delay between retries in milliseconds |

### forRoot

```typescript
KeycloakAdminModule.forRoot({
  enabled: process.env.KEYCLOAK_ADMIN_ENABLED === 'true',
  baseUrl: 'https://auth.example.com',
  realmName: 'myrealm',
  credentials: {
    type: 'clientCredentials',
    clientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID,
    clientSecret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET,
  },
});
```

### forRootAsync

```typescript
KeycloakAdminModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    enabled: config.get('KEYCLOAK_ADMIN_ENABLED') === 'true',
    baseUrl: config.get('KEYCLOAK_BASE_URL'),
    realmName: config.get('KEYCLOAK_REALM'),
    credentials: {
      type: 'clientCredentials',
      clientId: config.get('KEYCLOAK_ADMIN_CLIENT_ID'),
      clientSecret: config.get('KEYCLOAK_ADMIN_CLIENT_SECRET'),
    },
  }),
});
```

### KeycloakAdminService

Inject `KeycloakAdminService` and access the sub-services via its properties.

| Property | Service | Responsibility |
|---|---|---|
| `.users` | `UserService` | Create, read, update, delete users; assign roles and groups |
| `.roles` | `RoleService` | Manage realm and client roles |
| `.realms` | `RealmService` | Realm-level configuration and queries |
| `.clients` | `ClientService` | Manage clients and client scopes |
| `.groups` | `GroupService` | Create and manage groups; add/remove members |
| `.identityProviders` | `IdentityProviderService` | Manage identity provider configurations |
| `.authentication` | `AuthenticationService` | Manage authentication flows |
| `.federatedIdentity` | `FederatedIdentityService` | Link and unlink external provider identities — see [Federated Identity](#federated-identity) |
| `.events` | `EventService` | Query admin and access events — see [Event Polling](#event-polling) |

```typescript
import { Injectable } from '@nestjs/common';
import { KeycloakAdminService } from '@pawells/nestjs-auth';

@Injectable()
export class UserManagementService {
  constructor(private readonly keycloak: KeycloakAdminService) {}

  async createUser(email: string, firstName: string): Promise<void> {
    await this.keycloak.users.create({
      email,
      firstName,
      enabled: true,
    });
  }

  async assignRole(userId: string, roleName: string): Promise<void> {
    await this.keycloak.users.assignRole(userId, roleName);
  }
}
```

Call `keycloakAdminService.isEnabled()` before calling sub-services if the module may be disabled in the current environment.

## Federated Identity

`KeycloakAdminService.federatedIdentity` manages links between Keycloak user accounts and external identity providers.

| Method | Signature | Description |
|---|---|---|
| `list` | `(userId: string) => Promise<FederatedIdentityLink[]>` | Returns all provider links for a user |
| `link` | `(userId: string, provider: string, link: { userId: string; userName: string }) => Promise<void>` | Links an external provider identity to a Keycloak user |
| `unlink` | `(userId: string, provider: string) => Promise<void>` | Removes a provider link from a Keycloak user |

`link` performs a pre-flight `list` check and throws `ConflictError` if a link for the same provider and external user ID already exists. This is a workaround for [Keycloak issue #34608](https://github.com/keycloak/keycloak/issues/34608), which can create duplicate federated identity records.

```typescript
import { Injectable } from '@nestjs/common';
import { KeycloakAdminService, ConflictError } from '@pawells/nestjs-auth';

@Injectable()
export class IdentityLinkingService {
  constructor(private readonly keycloak: KeycloakAdminService) {}

  async linkGoogleAccount(
    keycloakUserId: string,
    googleUserId: string,
    googleEmail: string,
  ): Promise<void> {
    try {
      await this.keycloak.federatedIdentity.link(keycloakUserId, 'google', {
        userId: googleUserId,
        userName: googleEmail,
      });
    } catch (error) {
      if (error instanceof ConflictError) {
        // Already linked — treat as a no-op or surface to the caller
        return;
      }
      throw error;
    }
  }

  async listLinks(keycloakUserId: string) {
    return this.keycloak.federatedIdentity.list(keycloakUserId);
  }
}
```

## Event Polling

`KeycloakAdminService.events` queries Keycloak's event log for both admin (resource mutation) and access (login, logout, token) events.

### Methods

| Method | Signature | Description |
|---|---|---|
| `getAdminEvents` | `(query?: AdminEventQuery) => Promise<KeycloakAdminEvent[]>` | Returns admin events matching the query |
| `getAccessEvents` | `(query?: AccessEventQuery) => Promise<KeycloakAccessEvent[]>` | Returns access events matching the query |

### AdminEventQuery Fields

| Field | Type | Description |
|---|---|---|
| `operationTypes` | `('CREATE' \| 'UPDATE' \| 'DELETE' \| 'ACTION')[]` | Filter by operation type |
| `resourceTypes` | `string[]` | Filter by resource type (e.g. `['USER']`) |
| `resourcePath` | `string` | Filter by resource path prefix |
| `dateFrom` | `Date` | Earliest event timestamp (inclusive) |
| `dateTo` | `Date` | Latest event timestamp (inclusive) |
| `first` | `number` | Pagination offset |
| `max` | `number` | Maximum results to return |

`AccessEventQuery` supports the same date and pagination fields plus `type` (string array), `client`, and `user`.

### KeycloakAdminEvent Fields

| Field | Type | Notes |
|---|---|---|
| `time` | `number` | Unix timestamp in milliseconds |
| `realmId` | `string` | Realm identifier |
| `operationType` | `'CREATE' \| 'UPDATE' \| 'DELETE' \| 'ACTION'` | Type of operation |
| `resourceType` | `string` | Resource category, e.g. `USER`, `GROUP` |
| `resourcePath` | `string` | Path to the affected resource |
| `representation` | `string \| undefined` | JSON-encoded resource snapshot. Present on CREATE and UPDATE only. Must be parsed with `JSON.parse()` before use |
| `authDetails` | `object \| undefined` | Actor details: `realmId`, `clientId`, `userId`, `ipAddress` |

### Checkpoint Cursor Pattern

Keycloak does not provide a persistent event cursor. To avoid re-processing events or missing events between polls, track the `time` of the most recently processed event and pass it as `dateFrom` on subsequent polls. Use a page size (`max`) that fits within your Keycloak event retention window — events older than the retention period are purged and will be lost if polling falls behind.

```typescript
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { KeycloakAdminService } from '@pawells/nestjs-auth';

@Injectable()
export class EventSyncService {
  private lastProcessedTime: Date = new Date(Date.now() - 60_000);

  constructor(private readonly keycloak: KeycloakAdminService) {}

  @Cron('*/30 * * * * *') // every 30 seconds
  async pollAdminEvents(): Promise<void> {
    const events = await this.keycloak.events.getAdminEvents({
      dateFrom: this.lastProcessedTime,
      operationTypes: ['CREATE', 'UPDATE', 'DELETE'],
      resourceTypes: ['USER'],
      max: 100,
    });

    for (const event of events) {
      await this.processEvent(event);
      const eventTime = new Date(event.time);
      if (eventTime > this.lastProcessedTime) {
        this.lastProcessedTime = eventTime;
      }
    }
  }

  private async processEvent(event: any): Promise<void> {
    // Handle the event
  }
}
```

## Keycloak Client Configuration

Three Keycloak clients are typically required when using this package.

### React SPA (public client)

- **Client type**: Public
- **Authentication flow**: Standard flow enabled
- **PKCE**: Required — set Code Challenge Method to `S256`
- **Valid redirect URIs**: Your frontend origin(s)

### NestJS resource server (confidential client)

This is the client whose `clientId` and `clientSecret` you provide to `KeycloakModule`. It is not used to authenticate users — it authenticates the service itself for introspection calls.

- **Client type**: Confidential
- **Service accounts**: Not required
- **Client authentication**: Enabled
- Introspection requires a client secret — keep `validationMode: 'online'` unless you have a specific reason to use offline mode

If you are using offline (JWKS) validation exclusively, a confidential client is not required for token validation. The JWKS endpoint is public.

### Admin API caller (confidential service account)

This is the client whose credentials you provide to `KeycloakAdminModule`.

- **Client type**: Confidential
- **Service accounts**: Enabled
- **Required service account roles** (assigned in the `realm-management` client):
  - `manage-users` — create, update, delete users and assign roles
  - `manage-identity-providers` — link and unlink federated identities
  - `view-events` — read admin and access events

## Security Notes

**Online introspection is the recommended validation mode.** It is authoritative: a revoked Keycloak session is rejected immediately, regardless of token expiry.

**Offline JWKS validation does not detect revocation.** A token that has been revoked in Keycloak (e.g. by logging out or disabling the user) continues to pass offline validation until its `exp` claim expires. Only use offline mode when throughput requirements make per-request introspection impractical, and mitigate the revocation window by setting short token lifetimes in Keycloak (5 minutes or less).

**Federated identity deduplication (Keycloak #34608).** Keycloak's Admin API can create duplicate federated identity records if `addToFederatedIdentity` is called concurrently for the same user and provider. The `FederatedIdentityService.link` method guards against this with a pre-flight check, but the check is not atomic. Under high concurrency, implement external coordination (e.g. a distributed lock) if duplicate links are not tolerable.

**Event polling and retention windows.** Keycloak purges events based on a configurable retention period. If your poll interval exceeds the retention window — or if polling stops and then resumes — events will be permanently lost. Poll at a frequency significantly shorter than the retention window, and align the retention window with your operational requirements in the Keycloak realm settings (`Admin Console > Realm Settings > Events`).

## Related Packages

- **[@pawells/nestjs-shared](https://www.npmjs.com/package/@pawells/nestjs-shared)** — Foundation: filters, guards, interceptors, logging, CSRF, error handling
- **[@pawells/nestjs-open-telemetry](https://www.npmjs.com/package/@pawells/nestjs-open-telemetry)** — OpenTelemetry tracing and metrics integration

## License

MIT
