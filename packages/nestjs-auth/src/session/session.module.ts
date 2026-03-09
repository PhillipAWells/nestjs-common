import { Module, DynamicModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Session, SessionSchema } from './session.entity.js';
import { SessionRepository } from './session.repository.js';
import { SessionService } from './session.service.js';
import { SessionResolver } from './session.resolver.js';
import { SessionEventEmitter } from './session-event.emitter.js';
import { ISessionConfig } from './session.types.js';
import { Redis } from 'ioredis';

export interface SessionModuleOptions {
	config: ISessionConfig;
	redisClient: Redis;
}

@Module({})
export class SessionModule {
	public static forRoot(options: SessionModuleOptions): DynamicModule {
		return {
			module: SessionModule,
			global: true,
			imports: [
				MongooseModule.forFeature([
					{
						name: Session.name,
						schema: SessionSchema,
					},
				]),
			],
			providers: [
				{
					provide: 'SESSION_CONFIG',
					useValue: options.config,
				},
				{
					provide: 'REDIS_CLIENT',
					useValue: options.redisClient,
				},
				SessionRepository,
				SessionEventEmitter,
				SessionService,
				SessionResolver,
			],
			exports: [SessionService, SessionRepository, SessionEventEmitter],
		};
	}
}
