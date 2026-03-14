# @pawells/nestjs-auth

[![npm version](https://img.shields.io/npm/v/@pawells/nestjs-auth.svg?style=flat)](https://www.npmjs.com/package/@pawells/nestjs-auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Comprehensive NestJS authentication module with JWT, sessions, OAuth/OIDC, and Keycloak integration.

## Installation

```bash
yarn add @pawells/nestjs-auth
```

## Requirements

- **Node.js**: >= 24.0.0
- **NestJS**: >= 10.0.0
- **@pawells/nestjs-shared**: same version

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

## Quick Start

### JWT Authentication

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '@pawells/nestjs-auth';

@Module({
  imports: [
    AuthModule.forRoot({
      jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: '1h',
      },
    }),
  ],
})
export class AppModule {}
```

### Using Auth Decorators

```typescript
import {
  Auth,
  Public,
  Roles,
  CurrentUser,
  AuthToken,
} from '@pawells/nestjs-auth';

@Controller('users')
export class UsersController {
  @Public() // No auth required
  @Get('/public')
  getPublicData() {
    return { data: 'public' };
  }

  @Auth() // Auth required
  @Get('/profile')
  getProfile(@CurrentUser() user: any) {
    return { user };
  }

  @Roles('admin') // Specific roles required
  @Get('/admin')
  getAdminData() {
    return { data: 'admin only' };
  }

  @Permissions('write:users') // Specific permissions required
  @Post('/create')
  createUser(@Body() dto: CreateUserDto) {
    return { created: true };
  }

  @Get('/token')
  getToken(@AuthToken() token: string) {
    return { token };
  }
}
```

### GraphQL Decorators

```typescript
import {
  GraphQLAuth,
  GraphQLPublic,
  GraphQLRoles,
  GraphQLCurrentUser,
  GraphQLContextParam,
} from '@pawells/nestjs-auth';

@Resolver(() => User)
export class UserResolver {
  @Query(() => User)
  @GraphQLPublic()
  publicUser() {
    return { id: '1', name: 'Public' };
  }

  @Query(() => User)
  @GraphQLAuth()
  myProfile(@GraphQLCurrentUser() user: any) {
    return user;
  }

  @Query(() => [User])
  @GraphQLRoles('admin')
  allUsers(@GraphQLContextParam() context: any) {
    return [];
  }
}
```

## Key Features

### Authentication
- **JWT Strategy**: Passport JWT integration
- **Token Blacklist**: Fail-closed token revocation with Redis
- **JWTAuthGuard**: Protect routes with JWT validation

### Authorization
- **Role-Based Access Control (RBAC)**: `@Roles` decorator
- **Permission-Based Access Control (PBAC)**: `@Permissions` decorator
- **RoleGuard**: RBAC enforcement
- **PermissionGuard**: PBAC enforcement

### Sessions
- **SessionModule**: Session management with MongoDB
- **SessionService**: Create, update, and manage user sessions
- **SessionRepository**: Direct database access
- **Session Events**: Track login, logout, and device changes
- **GraphQL Resolver**: Query sessions via GraphQL

### OAuth / OIDC
- **OAuthModule**: Multi-provider OAuth integration
- **Keycloak Strategy**: Native Keycloak support
- **OIDC Strategy**: Generic OpenID Connect
- **OAuthGuard**: OAuth flow protection
- **OAuthService**: User and token management
- **@OAuthProvider**: Extract OAuth provider
- **@GetOAuthUser**: Get OAuth user info
- **@OAuthRoles**: OAuth-provided roles

### Keycloak
- **Keycloak Admin API**: User and role management
- **Token Validation**: JWK-based signature verification
- **Realm Configuration**: Dynamic realm and client settings

## Configuration

### AuthModule.forRoot()

```typescript
interface AuthModuleOptions {
  jwt: {
    secret: string;
    expiresIn: string | number;
  };
  redis?: {
    host: string;
    port: number;
  };
  keycloak?: {
    serverUrl: string;
    realm: string;
    clientId: string;
    clientSecret: string;
  };
}
```

### SessionModule.forRoot()

```typescript
interface SessionModuleOptions {
  mongoUri: string;
  ttl?: number; // Session TTL in seconds
  secretOrPublicKey?: string;
}
```

### OAuthModule.forRoot()

```typescript
interface OAuthModuleOptions {
  providers: {
    [name: string]: OAuthProviderConfig;
  };
  callbackUrl: string;
}
```

## Related Packages

- **[@pawells/nestjs-shared](https://www.npmjs.com/package/@pawells/nestjs-shared)** - Foundation library
- **[@pawells/nestjs-graphql](https://www.npmjs.com/package/@pawells/nestjs-graphql)** - GraphQL integration
- **[@pawells/nestjs-open-telemetry](https://www.npmjs.com/package/@pawells/nestjs-open-telemetry)** - Tracing integration

## License

MIT
