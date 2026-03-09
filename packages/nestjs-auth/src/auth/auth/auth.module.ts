import { Module, DynamicModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { JWTStrategy } from './jwt.strategy.js';
import { TokenBlacklistService } from './token-blacklist.service.js';
import { TokenValidationService } from './token-validation.service.js';

import { AuthController } from './auth.controller.js';
import { User } from './auth.types.js';
import { OAuthModule } from '../lib/oauth/oauth.module.js';
import { OAuthModuleOptions } from '../lib/oauth/types/oauth-config.types.js';
import { AppLogger, CommonModule } from '@pawells/nestjs-shared/common';
import { JWTAuthGuard } from './jwt-auth.guard.js';
import { MockUserRepository } from './repositories/mock-user.repository.js';
import { USER_REPOSITORY, USER_LOOKUP_FN } from './tokens.js';

/**
 * Configuration options for AuthModule
 */
export interface AuthModuleOptions {
	jwtSecret: string;
	jwtExpiresIn?: string;
	userLookupFn: (userId: string) => Promise<User | null>;
	oauth?: OAuthModuleOptions;
}

/**
 * Authentication module
 * Handles user authentication, JWT tokens, and authorization
 */
@Module({})
export class AuthModule {
	/**
    * Create dynamic module with configuration
    * @param options Module configuration options
    * @returns Dynamic module
    */
	public static forRoot(options: AuthModuleOptions): DynamicModule {
		const imports = [
			// Passport configuration
			PassportModule.register({ defaultStrategy: 'jwt' }),

			// JWT configuration
			JwtModule.register({
				secret: options.jwtSecret,
				signOptions: {
					expiresIn: options.jwtExpiresIn ?? '15m' as any,
					issuer: 'auth-service',
					audience: 'clients'
				}
			}),

			// Common module for shared utilities
			CommonModule

			// Note: CacheModule is injected by the application, not by this module
			// This prevents circular dependency with nestjs-graphql/cache
			// Applications should import { CacheModule } from '@pawells/nestjs-graphql/cache'
			// before importing AuthModule to enable token blacklisting
			// Note: PyroscopeModule is imported by TracingModule - do not duplicate here
		];

		// Add OAuth module if configured
		if (options.oauth) {
			imports.push(OAuthModule.forRoot(options.oauth));
		}

		return {
			module: AuthModule,
			imports,
			providers: [
				AuthService,
				TokenBlacklistService,
				TokenValidationService,

				JWTAuthGuard,
				{
					provide: USER_REPOSITORY,
					useClass: MockUserRepository
				},
				{
					provide: USER_LOOKUP_FN,
					useValue: options.userLookupFn
				},
				{
					provide: JWTStrategy,
					useFactory: (userLookupFn: (userId: string) => Promise<User | null>, appLogger: any, tokenValidationService: TokenValidationService) => {
						return new JWTStrategy(userLookupFn, appLogger, tokenValidationService);
					},
					inject: [USER_LOOKUP_FN, AppLogger, TokenValidationService]
				}
			],
			controllers: [AuthController],
			exports: [AuthService, TokenBlacklistService, JWTStrategy, PassportModule, JWTAuthGuard]
		};
	}
}
