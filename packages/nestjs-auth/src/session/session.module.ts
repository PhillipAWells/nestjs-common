import { Module, DynamicModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Session, SessionSchema } from './session.entity.js';
import { SessionRepository } from './session.repository.js';
import { SessionService } from './session.service.js';
import { SessionResolver } from './session.resolver.js';
import { SessionEventEmitter } from './session-event.emitter.js';
import { ISessionConfig } from './session.types.js';
import { Redis } from 'ioredis';

/**
 * Session module configuration options
 */
export interface SessionModuleOptions {
	/** Session configuration including TTL and concurrency limits */
	config: ISessionConfig;
	/** Redis client instance for session tracking and management */
	redisClient: Redis;
}

/**
 * Session management module for MongoDB-persisted user sessions.
 * Handles session creation, authentication, token refresh, and concurrency management.
 */
@Module({})
export class SessionModule {
	/**
	 * Create session module with configuration
	 * @param options Session module configuration
	 * @returns Dynamic module configuration
	 */
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
