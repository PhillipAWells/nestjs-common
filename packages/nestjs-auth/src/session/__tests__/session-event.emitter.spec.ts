import { vi, describe, it, beforeEach, expect } from 'vitest';
import { SessionEventEmitter } from '../session-event.emitter.js';
import { SessionEventType } from '../session.types.js';
import type { Redis } from 'ioredis';
import { AppLogger } from '@pawells/nestjs-shared/common';

describe('SessionEventEmitter', () => {
	let emitter: SessionEventEmitter;
	let mockRedis: any;
	let mockLogger: any;

	beforeEach(() => {
		mockRedis = {
			publish: vi.fn<(channel: string, message: string) => Promise<number>>().mockResolvedValue(1),
		} as unknown as Redis;

		mockLogger = {
			error: vi.fn(),
		};

		const mockModuleRef = {
			get: (token: any, _opts?: any) => {
				if (token === 'REDIS_CLIENT') return mockRedis;
				if (token === AppLogger) return mockLogger;
				return null;
			},
		};

		emitter = new SessionEventEmitter(mockModuleRef as any);
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
