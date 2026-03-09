import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { OAuth2Strategy } from './strategies/oauth2.strategy.js';
import { AuthService } from '../../auth/auth.service.js';

import { CommonModule } from '@pawells/nestjs-shared/common';

@Module({
	imports: [PassportModule, CommonModule],
	providers: [OAuth2Strategy, AuthService],
	exports: [OAuth2Strategy]
})
export class OAuth2Module {}
