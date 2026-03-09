import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OpenIDConnectStrategy } from 'passport-openidconnect';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';

@Injectable()
export class OIDCStrategy extends PassportStrategy(OpenIDConnectStrategy, 'oidc') {
	private _contextualLogger: AppLogger | undefined;

	constructor(private readonly appLogger: AppLogger) {
		super({
			issuer: process.env['OIDC_ISSUER'] ?? 'https://oidc.example.com',
			authorizationURL: process.env['OIDC_AUTHORIZATION_URL'] ?? `${process.env['OIDC_ISSUER'] ?? 'https://oidc.example.com'}/oauth/authorize`,
			tokenURL: process.env['OIDC_TOKEN_URL'] ?? `${process.env['OIDC_ISSUER'] ?? 'https://oidc.example.com'}/oauth/token`,
			userInfoURL: process.env['OIDC_USERINFO_URL'] ?? `${process.env['OIDC_ISSUER'] ?? 'https://oidc.example.com'}/oauth/userinfo`,
			clientID: process.env['OIDC_CLIENT_ID'] ?? 'client-id',
			clientSecret: process.env['OIDC_CLIENT_SECRET'] ?? 'client-secret',
			callbackURL: process.env['OIDC_CALLBACK_URL'] ?? 'http://localhost:3000/auth/oidc/callback',
			scope: ['openid', 'profile', 'email']
		});
	}

	private get logger(): AppLogger {
		this._contextualLogger ??= this.appLogger.createContextualLogger(OIDCStrategy.name);
		return this._contextualLogger;
	}

	@ProfileMethod({ tags: { operation: 'oidcValidate', strategy: 'oidc' } })
	public async validate(
		_issuer: string,
		profile: any,
		accessToken: string,
		refreshToken: string,
		idToken: string,
		_done: any
	): Promise<any> {
		try {
			// Validate required profile fields
			if (!profile?.sub && !profile?.id) {
				throw new UnauthorizedException('OAuth profile missing user identifier (sub/id)');
			}

			if (!profile?.email) {
				throw new UnauthorizedException('OAuth profile missing email address');
			}

			this.logger.debug(`OIDC validation for user: ${profile.sub ?? profile.id}`);

			const user = {
				id: profile.sub ?? profile.id,
				email: profile.email,
				firstName: profile.given_name,
				lastName: profile.family_name,
				displayName: profile.name,
				oauthProvider: 'oidc',
				oauthProfile: profile,
				oauthTokens: {
					accessToken,
					refreshToken,
					idToken
				}
			};

			return user;
		}
		catch (error) {
			this.logger.error(`OIDC validation failed: ${(error as Error).message}`, (error as Error).stack);
			throw error instanceof UnauthorizedException ? error : new UnauthorizedException('OIDC authentication failed');
		}
	}
}
