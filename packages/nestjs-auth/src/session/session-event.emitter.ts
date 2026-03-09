import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { ISessionEvent, SessionEventType } from './session.types.js';

@Injectable()
export class SessionEventEmitter implements OnModuleDestroy {
	private readonly CHANNEL_PREFIX = 'session:';

	constructor(
		@Inject('REDIS_CLIENT')
		private readonly redisClient: Redis,
		@Inject(AppLogger)
		private readonly logger: AppLogger,
	) {}

	public EmitSessionEvent(
		sessionId: string,
		eventType: SessionEventType,
		data: Record<string, any>,
	): void {
		const event: ISessionEvent = {
			eventType,
			sessionId,
			timestamp: new Date(),
			data,
		};

		const channel = `${this.CHANNEL_PREFIX}${sessionId}`;
		const message = JSON.stringify(event);

		// Fire and forget - don't block on this
		this.redisClient.publish(channel, message).catch((error) => {
			this.logger.error('Failed to emit session event', error, {
				channel,
				sessionId,
				eventType,
			});
		});
	}

	public onModuleDestroy(): void {
		// Cleanup if needed
	}
}
