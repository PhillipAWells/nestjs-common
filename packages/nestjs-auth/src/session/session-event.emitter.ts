import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Redis } from 'ioredis';
import { AppLogger } from '@pawells/nestjs-shared/common';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { ISessionEvent, SessionEventType } from './session.types.js';

@Injectable()
export class SessionEventEmitter implements OnModuleDestroy, LazyModuleRefService {
	private readonly CHANNEL_PREFIX = 'session:';

	public get RedisClient(): Redis {
		return this.Module.get('REDIS_CLIENT', { strict: false });
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	constructor(public readonly Module: ModuleRef) {}

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
		this.RedisClient.publish(channel, message).catch((error) => {
			this.AppLogger.error('Failed to emit session event', error, {
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
