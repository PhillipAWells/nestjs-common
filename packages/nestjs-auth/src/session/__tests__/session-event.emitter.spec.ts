import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SessionEventEmitter } from '../session-event.emitter.js';
import { SessionEventType } from '../session.types.js';
import type { Redis } from 'ioredis';
import { AppLogger } from '@pawells/nestjs-shared/common';

describe('SessionEventEmitter', () => {
	let emitter: SessionEventEmitter;
	let mockRedis: jest.Mocked<Redis>;
	let mockLogger: jest.Mocked<AppLogger>;

	beforeEach(async () => {
		mockRedis = {
			publish: jest.fn<(channel: string, message: string) => Promise<number>>().mockResolvedValue(1)
		} as any;

		mockLogger = {
			error: jest.fn()
		} as any;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SessionEventEmitter,
				{ provide: 'REDIS_CLIENT', useValue: mockRedis },
				{ provide: AppLogger, useValue: mockLogger }
			]
		}).compile();

		emitter = module.get<SessionEventEmitter>(SessionEventEmitter);
	});

	describe('EmitSessionEvent', () => {
		it('should publish event to Redis', async () => {
			const sessionId = 'session-123';
			const eventType = SessionEventType.AUTHENTICATED;
			const data = { userId: 'user-123' };

			emitter.EmitSessionEvent(sessionId, eventType, data);

			// Allow async processing
			await new Promise(resolve => setTimeout(resolve, 10));

			expect(mockRedis.publish).toHaveBeenCalled();
		});

		it('should use correct channel pattern', async () => {
			const sessionId = 'session-123';
			emitter.EmitSessionEvent(sessionId, SessionEventType.LOGGED_OUT, {});

			await new Promise(resolve => setTimeout(resolve, 10));

			const callArgs = mockRedis.publish.mock.calls[0];
			expect(callArgs?.[0]).toContain('session:');
		});

		it('should include event metadata', async () => {
			const sessionId = 'session-123';
			emitter.EmitSessionEvent(sessionId, SessionEventType.TOKEN_REFRESHED, { userId: 'user-456' });

			await new Promise(resolve => setTimeout(resolve, 10));

			const publishedCall = mockRedis.publish.mock.calls[0];
			if (publishedCall) {
				const publishedMessage = publishedCall[1];
				const parsedEvent = JSON.parse(publishedMessage as string);

				expect(parsedEvent.eventType).toBe(SessionEventType.TOKEN_REFRESHED);
				expect(parsedEvent.sessionId).toBe(sessionId);
				expect(parsedEvent.timestamp).toBeDefined();
				expect(parsedEvent.data.userId).toBe('user-456');
			}
		});
	});
});
