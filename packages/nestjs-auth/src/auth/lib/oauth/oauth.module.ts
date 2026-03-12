import { Module, DynamicModule, Global } from '@nestjs/common';
import { OAuthService } from './oauth.service.js';
import { KeycloakStrategy } from './strategies/keycloak.strategy.js';
import { OIDCStrategy } from './strategies/oidc.strategy.js';
import { OAuthGuard } from './guards/oauth.guard.js';
import { OAuthModuleOptions } from './types/oauth-config.types.js';

import { CommonModule } from '@pawells/nestjs-shared/common';

@Global()
@Module({})
export class OAuthModule {
	/**
   * Create dynamic module with OAuth configuration
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
    * Create dynamic module with async OAuth configuration
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
