import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';

@Injectable()
export class KeycloakStrategy extends PassportStrategy(OAuth2Strategy, 'keycloak') {
	private _contextualLogger: AppLogger | undefined;

	constructor(private readonly appLogger: AppLogger) {
		const authorizationURL = process.env['KEYCLOAK_AUTH_URL'];
		const tokenURL = process.env['KEYCLOAK_TOKEN_URL'];
		const clientID = process.env['KEYCLOAK_CLIENT_ID'];
		const clientSecret = process.env['KEYCLOAK_CLIENT_SECRET'];
		const callbackURL = process.env['KEYCLOAK_CALLBACK_URL'];

		if (!authorizationURL) throw new Error('KEYCLOAK_AUTH_URL environment variable is required');
		if (!tokenURL) throw new Error('KEYCLOAK_TOKEN_URL environment variable is required');
		if (!clientID) throw new Error('KEYCLOAK_CLIENT_ID environment variable is required');
		if (!clientSecret) throw new Error('KEYCLOAK_CLIENT_SECRET environment variable is required');
		if (!callbackURL) throw new Error('KEYCLOAK_CALLBACK_URL environment variable is required');

		super({
			authorizationURL,
			tokenURL,
			clientID,
			clientSecret,
			callbackURL,
			scope: ['openid', 'profile', 'email'],
		});
	}

	private get logger(): AppLogger {
		this._contextualLogger ??= this.appLogger.createContextualLogger(KeycloakStrategy.name);
		return this._contextualLogger;
	}

	@ProfileMethod({ tags: { operation: 'keycloakValidate', strategy: 'keycloak' } })
	public validate(accessToken: string, refreshToken: string, profile: any, _done: any): any {
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
					refreshToken,
				},
			};

			return user;
		} catch (error) {
			this.logger.error(`Keycloak validation failed: ${(error as Error).message}`);
			throw error instanceof UnauthorizedException ? error : new UnauthorizedException('Keycloak authentication failed');
		}
	}
}
