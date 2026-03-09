import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';

@Injectable()
export class KeycloakStrategy extends PassportStrategy(OAuth2Strategy, 'keycloak') {
	private _contextualLogger: AppLogger | undefined;

	constructor(private readonly appLogger: AppLogger) {
		super({
			authorizationURL: process.env['KEYCLOAK_AUTH_URL'] ?? 'https://keycloak.example.com/auth/realms/master/protocol/openid-connect/auth',
			tokenURL: process.env['KEYCLOAK_TOKEN_URL'] ?? 'https://keycloak.example.com/auth/realms/master/protocol/openid-connect/token',
			clientID: process.env['KEYCLOAK_CLIENT_ID'] ?? 'client-id',
			clientSecret: process.env['KEYCLOAK_CLIENT_SECRET'] ?? 'client-secret',
			callbackURL: process.env['KEYCLOAK_CALLBACK_URL'] ?? 'http://localhost:3000/auth/keycloak/callback',
			scope: ['openid', 'profile', 'email']
		});
	}

	private get logger(): AppLogger {
		this._contextualLogger ??= this.appLogger.createContextualLogger(KeycloakStrategy.name);
		return this._contextualLogger;
	}

	@ProfileMethod({ tags: { operation: 'keycloakValidate', strategy: 'keycloak' } })
	public async validate(accessToken: string, refreshToken: string, profile: any, _done: any): Promise<any> {
		try {
			// Validate required profile fields
			if (!profile?.sub && !profile?.id) {
				throw new UnauthorizedException('OAuth profile missing user identifier (sub/id)');
			}

			if (!profile?.email) {
				throw new UnauthorizedException('OAuth profile missing email address');
			}

			this.logger.debug(`Keycloak validation for user: ${profile.sub ?? profile.id}`);

			const user = {
				id: profile.sub ?? profile.id,
				email: profile.email,
				firstName: profile.given_name,
				lastName: profile.family_name,
				displayName: profile.name,
				oauthProvider: 'keycloak',
				oauthProfile: profile,
				oauthTokens: {
					accessToken,
					refreshToken
				}
			};

			return user;
		}
		catch (error) {
			this.logger.error(`Keycloak validation failed: ${(error as Error).message}`, (error as Error).stack);
			throw error instanceof UnauthorizedException ? error : new UnauthorizedException('Keycloak authentication failed');
		}
	}
}
