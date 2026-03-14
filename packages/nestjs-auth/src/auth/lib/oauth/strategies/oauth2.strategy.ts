import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { ModuleRef } from '@nestjs/core';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AuthService } from '../../../auth/auth.service.js';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';

@Injectable()
export class OAuth2Strategy extends PassportStrategy(Strategy, 'oauth2') implements LazyModuleRefService {
	public get AuthService(): AuthService {
		return this.Module.get(AuthService);
	}

	constructor(public readonly Module: ModuleRef) {
		const callbackURL = process.env['OAUTH2_CALLBACK_URL'] ?? '';

		// Enforce HTTPS for callback URLs in production
		const isProduction = process.env['NODE_ENV'] === 'production';
		if (isProduction && callbackURL && !callbackURL.startsWith('https://')) {
			throw new Error('OAuth2 callback URL must use HTTPS in production');
		}

		super({
			authorizationURL: process.env['OAUTH2_AUTHORIZATION_URL'] ?? '',
			tokenURL: process.env['OAUTH2_TOKEN_URL'] ?? '',
			clientID: process.env['OAUTH2_CLIENT_ID'] ?? '',
			clientSecret: process.env['OAUTH2_CLIENT_SECRET'] ?? '',
			callbackURL,
			scope: ['openid', 'profile', 'email'],
		});
	}

	@ProfileMethod({ tags: { operation: 'oauthValidate', strategy: 'oauth2' } })
	public async validate(accessToken: string, refreshToken: string, profile: any): Promise<any> {
		const user = await this.AuthService.validateOAuthUser(profile, accessToken, refreshToken);
		return user;
	}
}
