import { Module, DynamicModule, Global } from '@nestjs/common';
import { OAuthService } from './oauth.service.js';
import { KeycloakStrategy } from './strategies/keycloak.strategy.js';
import { OIDCStrategy } from './strategies/oidc.strategy.js';
import { OAuthGuard } from './guards/oauth.guard.js';
import { OAuthModuleOptions } from './types/oauth-config.types.js';

import { CommonModule } from '@pawells/nestjs-shared/common';

/**
 * OAuth/OIDC module for multi-provider authentication support.
 * Provides Keycloak and generic OIDC strategies with token verification.
 */
@Global()
@Module({})
export class OAuthModule {
	/**
	 * Create OAuth module with static configuration
	 * @param options OAuth provider configurations
	 * @returns Dynamic module configuration
	 */
	public static forRoot(options: OAuthModuleOptions): DynamicModule {
		return {
			module: OAuthModule,
			imports: [CommonModule],
			providers: [
				OAuthService,
				{
					provide: 'OAUTH_MODULE_OPTIONS',
					useValue: options,
				},
				KeycloakStrategy,
				OIDCStrategy,
				OAuthGuard,
			],
			exports: [OAuthService, KeycloakStrategy, OIDCStrategy, OAuthGuard],
		};
	}

	/**
	 * Create OAuth module with asynchronous configuration
	 * @param options Async factory configuration
	 * @returns Dynamic module configuration
	 */
	public static forRootAsync(options: {
		useFactory: (...args: any[]) => Promise<OAuthModuleOptions> | OAuthModuleOptions;
		inject?: any[];
		imports?: any[];
	}): DynamicModule {
		return {
			module: OAuthModule,
			imports: [CommonModule, ...(options.imports ?? [])],
			providers: [
				OAuthService,
				{
					provide: 'OAUTH_MODULE_OPTIONS',
					useFactory: options.useFactory,
					inject: options.inject ?? [],
				},
				KeycloakStrategy,
				OIDCStrategy,
				OAuthGuard,
			],
			exports: [OAuthService, KeycloakStrategy, OIDCStrategy, OAuthGuard],
		};
	}
}
