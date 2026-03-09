
import { describe, it, expect } from 'vitest';
import type { IDeviceInfo, ISessionConfig, IUserProfile } from '../session.types.js';
import { SessionEventType } from '../session.types.js';

describe('Session Types & Data Structures', () => {
	describe('IDeviceInfo', () => {
		it('should create valid device info', () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
				ipAddress: '192.168.1.1',
			};

			expect(deviceInfo.userAgent).toBeDefined();
			expect(deviceInfo.ipAddress).toBe('192.168.1.1');
		});

		it('should handle minimal device info', () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0',
				ipAddress: '127.0.0.1',
			};

			expect(deviceInfo.userAgent).toBe('Mozilla/5.0');
		});

		it('should handle device info with special characters', () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
				ipAddress: '192.168.0.1',
			};

			expect(deviceInfo.userAgent).toContain('Mozilla');
		});

		it('should allow optional deviceId property', () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'test-agent',
				ipAddress: '127.0.0.1',
				deviceId: 'device-123',
			};

			expect(deviceInfo.deviceId).toBe('device-123');
		});
	});

	describe('IUserProfile', () => {
		it('should create valid user profile', () => {
			const profile: IUserProfile = {
				id: 'user-123',
				email: 'user@example.com',
				name: 'John Doe',
				roles: ['user'],
				permissions: ['read'],
			};

			expect(profile.id).toBe('user-123');
			expect(profile.email).toBe('user@example.com');
			expect(profile.roles).toContain('user');
		});

		it('should handle profile with minimal info', () => {
			const profile: IUserProfile = {
				id: 'user-id',
				email: 'test@example.com',
				name: 'Test User',
				roles: [],
				permissions: [],
			};

			expect(profile.id).toBeDefined();
			expect(profile.email).toBeDefined();
		});

		it('should handle profile with special characters', () => {
			const profile: IUserProfile = {
				id: 'user-id',
				email: 'josé+admin@example.com',
				name: 'O\'Connor, Mary',
				roles: ['admin'],
				permissions: [],
			};

			expect(profile.email).toContain('@');
			expect(profile.name).toContain('\'');
		});

		it('should allow various role values', () => {
			const roles = ['user', 'admin', 'moderator', 'guest'];

			roles.forEach(role => {
				const profile: IUserProfile = {
					id: 'user-id',
					email: 'user@example.com',
					name: 'Test',
					roles: [role],
					permissions: [],
				};
				expect(profile.roles).toContain(role);
			});
		});
	});

	describe('ISessionConfig', () => {
		it('should create valid session configuration', () => {
			const config: ISessionConfig = {
				sessionTtlMinutes: 1440,
				inactivityTimeoutMinutes: 30,
				enforceSessionLimit: true,
				defaultMaxConcurrentSessions: 5,
			};

			expect(config.sessionTtlMinutes).toBe(1440);
			expect(config.enforceSessionLimit).toBe(true);
			expect(config.defaultMaxConcurrentSessions).toBe(5);
		});

		it('should handle short session TTL', () => {
			const config: ISessionConfig = {
				sessionTtlMinutes: 15,
				inactivityTimeoutMinutes: 10,
				enforceSessionLimit: false,
				defaultMaxConcurrentSessions: 1,
			};

			expect(config.sessionTtlMinutes).toBe(15);
		});

		it('should handle long session TTL', () => {
			const config: ISessionConfig = {
				sessionTtlMinutes: 525600, // 1 year
				inactivityTimeoutMinutes: 60,
				enforceSessionLimit: false,
				defaultMaxConcurrentSessions: 10,
			};

			expect(config.sessionTtlMinutes).toBe(525600);
		});

		it('should allow zero concurrent sessions', () => {
			const config: ISessionConfig = {
				sessionTtlMinutes: 1440,
				inactivityTimeoutMinutes: 30,
				enforceSessionLimit: true,
				defaultMaxConcurrentSessions: 0,
			};

			expect(config.defaultMaxConcurrentSessions).toBe(0);
		});

		it('should allow unlimited concurrent sessions', () => {
			const config: ISessionConfig = {
				sessionTtlMinutes: 1440,
				inactivityTimeoutMinutes: 30,
				enforceSessionLimit: false,
				defaultMaxConcurrentSessions: 1000,
			};

			expect(config.enforceSessionLimit).toBe(false);
			expect(config.defaultMaxConcurrentSessions).toBe(1000);
		});
	});

	describe('Session Event Types', () => {
		it('should have AUTHENTICATED event type', () => {
			const eventType = SessionEventType.AUTHENTICATED;
			expect(eventType).toBeDefined();
		});

		it('should have LOGGED_OUT event type', () => {
			const eventType = SessionEventType.LOGGED_OUT;
			expect(eventType).toBeDefined();
		});

		it('should have TOKEN_REFRESHED event type', () => {
			const eventType = SessionEventType.TOKEN_REFRESHED;
			expect(eventType).toBeDefined();
		});

		it('should have SESSION_REVOKED event type', () => {
			const eventType = SessionEventType.SESSION_REVOKED;
			expect(eventType).toBeDefined();
		});

		it('should have PERMISSIONS_CHANGED event type', () => {
			const eventType = SessionEventType.PERMISSIONS_CHANGED;
			expect(eventType).toBeDefined();
		});
	});

	describe('Session Lifecycle Simulation', () => {
		it('should simulate session authentication event', () => {
			const event = {
				eventType: SessionEventType.AUTHENTICATED,
				sessionId: 'session-123',
				userId: 'user-456',
				timestamp: new Date(),
				data: {},
			};

			expect(event.userId).toBe('user-456');
		});

		it('should simulate session revocation with reason', () => {
			const event = {
				eventType: SessionEventType.SESSION_REVOKED,
				sessionId: 'session-123',
				timestamp: new Date(),
				data: { reason: 'Max concurrent sessions exceeded' },
			};

			expect(event.data.reason).toContain('exceeded');
		});

		it('should simulate session logout event', () => {
			const expiresAt = new Date(Date.now() + 86400000);
			const event = {
				eventType: SessionEventType.LOGGED_OUT,
				sessionId: 'session-123',
				timestamp: new Date(),
				data: { expiresAt: expiresAt.toISOString() },
			};

			expect(event.data.expiresAt).toBeDefined();
		});
	});

	describe('Session Configuration Scenarios', () => {
		it('should create strict security configuration', () => {
			const strictConfig: ISessionConfig = {
				sessionTtlMinutes: 15, // 15 minutes
				inactivityTimeoutMinutes: 10,
				enforceSessionLimit: true,
				defaultMaxConcurrentSessions: 1, // Max 1 session per user
			};

			expect(strictConfig.sessionTtlMinutes).toBeLessThan(30);
			expect(strictConfig.defaultMaxConcurrentSessions).toBe(1);
		});

		it('should create relaxed configuration', () => {
			const relaxedConfig: ISessionConfig = {
				sessionTtlMinutes: 10080, // 7 days
				inactivityTimeoutMinutes: 120,
				enforceSessionLimit: false,
				defaultMaxConcurrentSessions: 10,
			};

			expect(relaxedConfig.sessionTtlMinutes).toBeGreaterThan(1440);
			expect(relaxedConfig.enforceSessionLimit).toBe(false);
		});

		it('should create balanced configuration', () => {
			const balancedConfig: ISessionConfig = {
				sessionTtlMinutes: 1440, // 24 hours
				inactivityTimeoutMinutes: 30,
				enforceSessionLimit: true,
				defaultMaxConcurrentSessions: 3,
			};

			expect(balancedConfig.sessionTtlMinutes).toBe(1440);
			expect(balancedConfig.defaultMaxConcurrentSessions).toBe(3);
		});
	});

	describe('Device Info Variations', () => {
		it('should handle Chrome browser device info', () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0 Chrome/91.0',
				ipAddress: '192.168.1.100',
			};

			expect(deviceInfo.userAgent).toContain('Chrome');
		});

		it('should handle Firefox browser device info', () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0 Firefox/89.0',
				ipAddress: '192.168.1.101',
			};

			expect(deviceInfo.userAgent).toContain('Firefox');
		});

		it('should handle Safari browser device info', () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0 Safari/14.1',
				ipAddress: '192.168.1.102',
			};

			expect(deviceInfo.userAgent).toContain('Safari');
		});

		it('should handle mobile device info', () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'Mozilla/5.0 iPhone OS 14_6',
				ipAddress: '192.168.1.103',
			};

			expect(deviceInfo.userAgent).toContain('iPhone');
		});

		it('should handle IPv6 addresses', () => {
			const deviceInfo: IDeviceInfo = {
				userAgent: 'test-agent',
				ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
			};

			expect(deviceInfo.ipAddress).toContain(':');
		});
	});

	describe('User Profile Edge Cases', () => {
		it('should handle user profile with empty roles', () => {
			const profile: IUserProfile = {
				id: 'user-id',
				email: 'user@example.com',
				name: 'Test User',
				roles: [],
				permissions: [],
			};

			expect(profile.id).toBeDefined();
			expect(profile.roles).toEqual([]);
		});

		it('should handle user profile with avatar', () => {
			const profile: IUserProfile = {
				id: 'user-id',
				email: 'user@example.com',
				name: 'Test User',
				avatar: 'https://example.com/avatar.png',
				roles: ['user'],
				permissions: [],
			};

			expect(profile.avatar).toBeDefined();
		});

		it('should handle very long email addresses', () => {
			const longEmail = 'a'.repeat(60) + '@example.com';
			const profile: IUserProfile = {
				id: 'user-id',
				email: longEmail,
				name: 'Test',
				roles: [],
				permissions: [],
			};

			expect(profile.email.length).toBeGreaterThan(60);
		});

		it('should handle very long user names', () => {
			const longName = 'First ' + 'Middle '.repeat(10) + 'Last';
			const profile: IUserProfile = {
				id: 'user-id',
				email: 'user@example.com',
				name: longName,
				roles: ['user'],
				permissions: [],
			};

			expect(profile.name?.length).toBeGreaterThan(50);
		});
	});
});
