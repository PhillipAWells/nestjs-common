import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OpenIDConnectStrategy } from 'passport-openidconnect';
import type { ModuleRef } from '@nestjs/core';
import { AppLogger } from '@pawells/nestjs-shared/common';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';

@Injectable()
export class OIDCStrategy extends PassportStrategy(OpenIDConnectStrategy, 'oidc') implements LazyModuleRefService {
	private _contextualLogger: AppLogger | undefined;

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	private get logger(): AppLogger {
		this._contextualLogger ??= this.AppLogger.createContextualLogger(OIDCStrategy.name);
		return this._contextualLogger;
	}

	constructor(public readonly Module: ModuleRef) {
		const issuer = process.env['OIDC_ISSUER'];
		const authorizationURL = process.env['OIDC_AUTHORIZATION_URL'];
		const tokenURL = process.env['OIDC_TOKEN_URL'];
		const userInfoURL = process.env['OIDC_USERINFO_URL'];
		const clientID = process.env['OIDC_CLIENT_ID'];
		const clientSecret = process.env['OIDC_CLIENT_SECRET'];
		const callbackURL = process.env['OIDC_CALLBACK_URL'];

		if (!issuer) throw new Error('OIDC_ISSUER environment variable is required');
		if (!authorizationURL) throw new Error('OIDC_AUTHORIZATION_URL environment variable is required');
		if (!tokenURL) throw new Error('OIDC_TOKEN_URL environment variable is required');
		if (!userInfoURL) throw new Error('OIDC_USERINFO_URL environment variable is required');
		if (!clientID) throw new Error('OIDC_CLIENT_ID environment variable is required');
		if (!clientSecret) throw new Error('OIDC_CLIENT_SECRET environment variable is required');
		if (!callbackURL) throw new Error('OIDC_CALLBACK_URL environment variable is required');

		super({
			issuer,
			authorizationURL,
			tokenURL,
			userInfoURL,
			clientID,
			clientSecret,
			callbackURL,
			scope: ['openid', 'profile', 'email'],
		});
	}

	@ProfileMethod({ tags: { operation: 'oidcValidate', strategy: 'oidc' } })
	public validate(
		_issuer: string,
		profile: any,
		accessToken: string,
		refreshToken: string,
		idToken: string,
		_done: any,
	): any {
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
					idToken,
				},
			};

			return user;
		} catch (error) {
			this.logger.error(`OIDC validation failed: ${(error as Error).message}`);
			throw error instanceof UnauthorizedException ? error : new UnauthorizedException('OIDC authentication failed');
		}
	}
}
