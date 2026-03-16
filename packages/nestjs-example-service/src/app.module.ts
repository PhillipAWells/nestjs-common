/**
 * AppModule — canonical wiring example for all @pawells/nestjs-* packages.
 *
 * Import order matters:
 *  1. NestConfigModule  — must come before any nestjs-shared module so that
 *                         NestConfigService is available in the DI container.
 *  2. ConfigModule      — nestjs-shared wrapper; also bootstraps CommonModule.
 *  3. Observability     — OpenTelemetry and Prometheus register exporters with
 *                         InstrumentationRegistry (provided by CommonModule).
 *  4. Profiling         — PyroscopeModule; global by default.
 *  5. Persistence       — QdrantModule; global by default.
 *  6. Auth              — AuthModule depends on JwtModule + CommonModule.
 *                         Import after CacheModule (from nestjs-graphql) when
 *                         token blacklisting via Redis is required.
 *  7. GraphQL           — GraphQLModule registers Apollo + subscriptions.
 *                         Import BEFORE AuthModule if token blacklisting is
 *                         needed (provides CacheModule used by TokenBlacklistService).
 *  8. Feature modules   — Application-specific modules that consume the above.
 */

import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { CommonModule, ConfigModule } from '@pawells/nestjs-shared';
import { OpenTelemetryModule } from '@pawells/nestjs-open-telemetry';
import { PrometheusModule } from '@pawells/nestjs-prometheus';
import { PyroscopeModule } from '@pawells/nestjs-pyroscope';
import { QdrantModule } from '@pawells/nestjs-qdrant';
import { AuthModule, KeycloakAdminModule } from '@pawells/nestjs-auth';
import { ItemsModule } from './items/items.module.js';

@Module({
	imports: [
		// ── 1. NestJS config ───────────────────────────────────────────────────
		// isGlobal exposes NestConfigService everywhere so nestjs-shared's
		// ConfigModule can inject it without explicit re-imports.
		NestConfigModule.forRoot({ isGlobal: true }),

		// ── 2. nestjs-shared: Config + Common ─────────────────────────────────
		// ConfigModule must come before CommonModule — CommonModule depends on
		// ConfigService and verifies it is available during onModuleInit().
		ConfigModule,
		CommonModule,

		// ── 3. Observability ──────────────────────────────────────────────────
		// Both exporters call InstrumentationRegistry.registerExporter() in their
		// onModuleInit hook.  CommonModule (above) provides InstrumentationRegistry.
		OpenTelemetryModule.forRoot(),
		PrometheusModule.forRoot(),

		// ── 4. Profiling ──────────────────────────────────────────────────────
		PyroscopeModule.forRoot({
			config: {
				enabled: process.env['NODE_ENV'] === 'production',
				serverAddress: process.env['PYROSCOPE_SERVER_URL'] ?? 'http://localhost:4040',
				applicationName: 'nestjs-example-service',
				environment: process.env['NODE_ENV'] ?? 'development',
				tags: { service: 'nestjs-example-service' },
				basicAuthUser: process.env['PYROSCOPE_USER'],
				basicAuthPassword: process.env['PYROSCOPE_PASSWORD'],
			},
		}),

		// ── 5. Vector DB ──────────────────────────────────────────────────────
		// forRoot registers as global by default — QdrantService is available
		// in every module without explicit imports.
		QdrantModule.forRoot({
			url: process.env['QDRANT_URL'] ?? 'http://localhost:6333',
			apiKey: process.env['QDRANT_API_KEY'],
			checkCompatibility: false,
		}),

		// ── 6. Auth ───────────────────────────────────────────────────────────
		// Omitting oauth: {} here; add OAuthModuleOptions when Keycloak / OIDC
		// is available.  userLookupFn should resolve users from your own data
		// store in production.
		AuthModule.forRoot({
			jwtSecret: process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production',
			jwtExpiresIn: process.env['JWT_EXPIRES_IN'] ?? '15m',
			userLookupFn: (userId: string) => Promise.resolve({
				id: userId,
				email: `${userId}@example.com`,
				roles: [],
				permissions: [],
			}),
		}),

		// ── 6b. Keycloak Admin (optional) ─────────────────────────────────────
		// Provides KeycloakAdminService for user/role/group management via the
		// Keycloak Admin REST API.  Set KEYCLOAK_ENABLED=true and supply
		// credentials to activate.
		KeycloakAdminModule.forRoot({
			enabled: process.env['KEYCLOAK_ENABLED'] === 'true',
			baseUrl: process.env['KEYCLOAK_SERVER_URL'] ?? 'http://localhost:8080',
			realmName: process.env['KEYCLOAK_REALM'] ?? 'master',
			credentials: {
				type: 'password',
				username: process.env['KEYCLOAK_USERNAME'] ?? '',
				password: process.env['KEYCLOAK_PASSWORD'] ?? '',
			},
		}),

		// ── 7. GraphQL (optional) ─────────────────────────────────────────────
		// Uncomment to enable Apollo Server with auto-generated schema.
		// Import BEFORE AuthModule when token blacklisting via Redis is needed.
		//
		// GraphQLModule.forRoot({
		//   autoSchemaFile: './schema.gql',
		//   playground: process.env['NODE_ENV'] !== 'production',
		//   introspection: true,
		// }),

		// ── 8. Feature modules ────────────────────────────────────────────────
		ItemsModule,
	],
})
export class AppModule {}
