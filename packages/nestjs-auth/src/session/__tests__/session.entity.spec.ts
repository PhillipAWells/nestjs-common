import { SessionSchema } from '../session.entity.js';

describe('SessionSchema', () => {
	it('should have correct schema fields', () => {
		expect(SessionSchema).toBeDefined();
		const { obj } = SessionSchema;

		// Core fields
		expect(obj.sessionId).toBeDefined();
		expect(obj.userId).toBeDefined();
		expect(obj.isAuthenticated).toBeDefined();

		// Auth tokens
		expect(obj.accessToken).toBeDefined();
		expect(obj.refreshToken).toBeDefined();

		// Timestamps
		expect(obj.createdAt).toBeDefined();
		expect(obj.lastActivityAt).toBeDefined();
		expect(obj.expiresAt).toBeDefined();

		// Device info
		expect(obj.deviceInfo).toBeDefined();

		// User profile
		expect(obj.userProfile).toBeDefined();

		// Preferences and history
		expect(obj.preferences).toBeDefined();
		expect(obj.loginHistory).toBeDefined();
	});

	it('should have TTL index on expiresAt for auto-cleanup', () => {
		const indexes = SessionSchema.indexes();
		const ttlIndex = indexes.some((index: any) => {
			const indexObj = index[0];
			return indexObj.expiresAt && index[1]?.expireAfterSeconds === 0;
		});
		expect(ttlIndex).toBe(true);
	});

	it('should have unique index on sessionId', () => {
		const indexes = SessionSchema.indexes();
		const uniqueIndex = indexes.some((index: any) => {
			const indexObj = index[0];
			return indexObj.sessionId && index[1]?.unique === true;
		});
		expect(uniqueIndex).toBe(true);
	});
});
