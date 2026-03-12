import { Resolver, Query, Mutation, Subscription, Context, Args, ID } from '@nestjs/graphql';
import { BadRequestException, Inject } from '@nestjs/common';
import { SessionService } from './session.service.js';
import { AppLogger } from '@pawells/nestjs-shared/common';
import {
	SessionType,
	SessionAuthPayload,
	SessionEvent,
	SessionPreferencesInput,
} from './session.graphql.js';
import { Redis } from 'ioredis';

/**
 * GraphQL resolver for Session operations
 * Provides queries, mutations, and subscriptions for session management
 */
@Resolver(() => SessionType)
export class SessionResolver {
	constructor(
		private readonly sessionService: SessionService,
		@Inject('REDIS_CLIENT') private readonly redisClient: Redis,
		@Inject(AppLogger) private readonly logger: AppLogger,
	) {}

	/**
	 * Query to get the current session
	 * Returns null if no session ID is provided (user not authenticated)
	 */
	@Query(() => SessionType, { name: 'Session_Current', nullable: true })
	public async getCurrentSession(@Context() context: any): Promise<SessionType | null> {
		const sessionId = context?.sessionId;
		if (!sessionId) {
			return null; // Gracefully return null when not authenticated
		}
		const session = await this.sessionService.GetSession(sessionId);
		return session;
	}

	/**
	 * Query to get all sessions for a user
	 */
	@Query(() => [SessionType], { name: 'Session_UserSessions' })
	public async getUserSessions(
		@Context() _context: any,
		@Args('userId', { type: () => ID }) userId: string,
	): Promise<SessionType[]> {
		// Admin-only operation - verify in guard/decorator
		const sessions = await this.sessionService.GetUserSessions(userId);
		return sessions;
	}

	/**
	 * Mutation to login (placeholder - actual implementation integrates with Keycloak)
	 */
	@Mutation(() => SessionAuthPayload, { name: 'Session_Login' })
	public login(
		_context: any,
		@Args('email') _email: string,
		@Args('password') _password: string,
	): never {
		// This is a placeholder - actual implementation will integrate with Keycloak
		// For now, just return structure that tests expect
		throw new BadRequestException('Login not yet implemented - integrate with Keycloak');
	}

	/**
	 * Mutation to logout the current session
	 */
	@Mutation(() => Boolean, { name: 'Session_Logout' })
	public async logout(@Context() context: any): Promise<boolean> {
		const sessionId = context?.sessionId;
		if (!sessionId) {
			throw new BadRequestException('Session ID not provided');
		}
		await this.sessionService.LogoutSession(sessionId);
		return true;
	}

	/**
	 * Mutation to refresh the access token
	 */
	@Mutation(() => SessionType, { name: 'Session_RefreshToken' })
	public async refreshToken(@Context() context: any): Promise<SessionType> {
		const sessionId = context?.sessionId;
		if (!sessionId) {
			throw new BadRequestException('Session ID not provided');
		}

		const session = await this.sessionService.GetSession(sessionId);
		if (!session.refreshToken) {
			throw new BadRequestException('No refresh token available');
		}

		// Placeholder - actual implementation will validate and refresh via Keycloak
		throw new BadRequestException('Token refresh not yet implemented - integrate with Keycloak');
	}

	/**
	 * Mutation to update session preferences
	 */
	@Mutation(() => SessionType, { name: 'Session_UpdatePreferences' })
	public async updatePreferences(
		@Context() context: any,
		@Args('input') input: SessionPreferencesInput,
	): Promise<SessionType> {
		const sessionId = context?.sessionId;
		if (!sessionId) {
			throw new BadRequestException('Session ID not provided');
		}

		const updated = await this.sessionService.UpdateSessionPreferences(sessionId, input.preferences);
		return updated;
	}

	/**
	 * Mutation to invalidate all sessions for the current user
	 */
	@Mutation(() => Boolean, { name: 'Session_InvalidateAllSessions' })
	public async invalidateAllSessions(@Context() context: any): Promise<boolean> {
		const sessionId = context?.sessionId;
		if (!sessionId) {
			throw new BadRequestException('Session ID not provided');
		}

		const session = await this.sessionService.GetSession(sessionId);
		if (!session.userId) {
			throw new BadRequestException('User not authenticated');
		}

		await this.sessionService.InvalidateAllUserSessions(session.userId);
		return true;
	}

	/**
	 * Mutation to revoke a specific session (admin-only)
	 */
	@Mutation(() => Boolean, { name: 'Session_RevokeSession' })
	public async revokeSession(
		@Context() _context: any,
		@Args('sessionId', { type: () => ID }) sessionId: string,
	): Promise<boolean> {
		// Admin-only - verify in guard/decorator
		await this.sessionService.RevokeSession(sessionId);
		return true;
	}

	/**
	 * Mutation to set maximum concurrent sessions for current user
	 */
	@Mutation(() => Boolean, { name: 'Session_SetMaxConcurrentSessions' })
	public async setMaxConcurrentSessions(
		@Context() context: any,
		@Args('max', { type: () => Number, nullable: true }) max: number | null,
	): Promise<boolean> {
		const sessionId = context?.sessionId;
		if (!sessionId) {
			throw new BadRequestException('Session ID not provided');
		}

		const session = await this.sessionService.GetSession(sessionId);
		if (!session.userId) {
			throw new BadRequestException('User not authenticated');
		}

		await this.sessionService.SetMaxConcurrentSessions(session.userId, max);
		return true;
	}

	/**
	 * Subscription to listen for session changes
	 * Yields events from Redis pub/sub channel
	 */
	@Subscription(() => SessionEvent, {
		name: 'Session_OnChange',
		resolve: (payload) => payload,
	})
	public async *onSessionChange(context: any): AsyncGenerator<SessionEvent> {
		const sessionId = context?.sessionId;
		if (!sessionId) {
			throw new BadRequestException('Session ID not provided');
		}

		const channel = `session:${sessionId}`;
		const subscriber = this.redisClient.duplicate();
		await subscriber.subscribe(channel);

		yield {
			eventType: 'SUBSCRIPTION_ACTIVE',
			sessionId,
			timestamp: new Date(),
			data: { subscribed: true },
		};

		try {
			// Create async generator that continuously yields messages from Redis subscriber
			yield* this.listenForMessages(subscriber, sessionId);
		} finally {
			await subscriber.unsubscribe();
			subscriber.disconnect();
		}
	}

	/**
	 * Helper to create async generator that yields messages from Redis subscriber
	 */
	private listenForMessages(subscriber: Redis, sessionId: string): AsyncGenerator<SessionEvent> {
		const { logger } = this;
		return (async function* (): AsyncGenerator<SessionEvent> {
			// Create a queue to buffer messages from the Redis event handler
			const messageQueue: string[] = [];
			let resolveWait: (() => void) | null = null;

			const messageHandler = (_ch: string, message: string): void => {
				messageQueue.push(message);
				if (resolveWait) {
					resolveWait();
					resolveWait = null;
				}
			};

			subscriber.on('message', messageHandler);

			try {
				// Continuously yield messages as they arrive
				while (true) {
					// Wait for a message if queue is empty
					while (messageQueue.length === 0) {
						await new Promise<void>((resolve) => {
							resolveWait = resolve;
						});
					}

					const message = messageQueue.shift();
					if (!message) {
						continue;
					}
					try {
						const eventData = JSON.parse(message);
						yield {
							...eventData,
							sessionId,
							timestamp: eventData.timestamp ? new Date(eventData.timestamp) : new Date(),
						} as SessionEvent;
					} catch (error) {
						// Log parsing error but continue listening
						logger.warn('Failed to parse session event message', {
							error: error instanceof Error ? error.message : String(error),
							sessionId,
						});
					}
				}
			} finally {
				subscriber.off('message', messageHandler);
			}
		})();
	}
}
