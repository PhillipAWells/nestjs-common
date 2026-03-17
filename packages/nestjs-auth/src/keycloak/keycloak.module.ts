import { Module, DynamicModule, ModuleMetadata } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { InjectionToken, OptionalFactoryDependency } from '@nestjs/common';
import { KEYCLOAK_MODULE_OPTIONS } from './keycloak.constants.js';
import type { KeycloakModuleOptions } from './keycloak.types.js';
import { JwksCacheService } from './services/jwks-cache.service.js';
import { KeycloakTokenValidationService } from './services/keycloak-token-validation.service.js';

export interface KeycloakModuleAsyncOptions {
	imports?: ModuleMetadata['imports'];
	useFactory: (...args: unknown[]) => Promise<KeycloakModuleOptions> | KeycloakModuleOptions;
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
}

/**
 * Keycloak Token Validation Module
 *
 * Provides Keycloak token validation for NestJS resource servers. Supports two validation modes:
 * - **Online mode (default)**: Uses Keycloak's token introspection endpoint for real-time token validation
 * - **Offline mode (opt-in)**: Validates JWTs using cached JWKS (JSON Web Key Set) for stateless validation
 *
 * Export the `JwtAuthGuard` and decorate controllers/routes with `@UseGuards(JwtAuthGuard)` to enable
 * token validation. The guard respects `@Public()` to bypass authentication on specific endpoints.
 *
 * @example
 * ```typescript
 * // Online mode (default)
 * KeycloakModule.forRoot({
 *   authServerUrl: 'https://keycloak.example.com',
 *   clientId: 'my-client',
 *   clientSecret: 'secret',
 *   validationMode: 'online'
 * })
 *
 * // Offline mode (JWKS-based)
 * KeycloakModule.forRoot({
 *   authServerUrl: 'https://keycloak.example.com',
 *   clientId: 'my-client',
 *   validationMode: 'offline'
 * })
 * ```
 */
@Module({})
export class KeycloakModule {
	/**
	 * Register Keycloak module with static configuration
	 *
	 * @param options - Configuration options for the Keycloak module
	 * @returns Dynamic module configuration with KeycloakTokenValidationService and JwksCacheService
	 */
	public static forRoot(options: KeycloakModuleOptions): DynamicModule {
		const isOffline = options.validationMode === 'offline';
		const providers = [
			{
				provide: KEYCLOAK_MODULE_OPTIONS,
				useValue: options,
			},
			KeycloakTokenValidationService,
			...(isOffline ? [JwksCacheService] : []),
		];

		return {
			module: KeycloakModule,
			imports: [JwtModule.register({})],
			providers,
			exports: [
				KeycloakTokenValidationService,
				...(isOffline ? [JwksCacheService] : []),
				KEYCLOAK_MODULE_OPTIONS,
			],
		};
	}

	/**
	 * Register Keycloak module with asynchronous configuration
	 *
	 * Defers module configuration until runtime using a factory function.
	 * Useful for reading configuration from environment variables or other async sources.
	 *
	 * @param options - Async factory configuration
	 * @param options.useFactory - Function that returns KeycloakModuleOptions or a promise that resolves to it
	 * @param options.inject - Optional array of providers to inject into the factory function
	 * @param options.imports - Optional array of modules to import for dependency injection
	 * @returns Dynamic module configuration with KeycloakTokenValidationService and JwksCacheService.
	 *   Note: JwksCacheService is always provided in async mode (validationMode is not known at
	 *   module definition time). In online mode, it initializes but skips the JWKS fetch.
	 */
	public static forRootAsync(options: KeycloakModuleAsyncOptions): DynamicModule {
		return {
			module: KeycloakModule,
			imports: [JwtModule.register({}), ...(options.imports ?? [])],
			providers: [
				{
					provide: KEYCLOAK_MODULE_OPTIONS,
					useFactory: options.useFactory,
					inject: options.inject ?? [],
				},
				JwksCacheService,
				KeycloakTokenValidationService,
			],
			exports: [KeycloakTokenValidationService, JwksCacheService, KEYCLOAK_MODULE_OPTIONS],
		};
	}
}
