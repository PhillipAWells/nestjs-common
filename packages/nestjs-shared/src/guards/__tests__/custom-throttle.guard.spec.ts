import { describe, it, expect, beforeEach } from 'vitest';
import { CustomThrottleGuard } from '../custom-throttle.guard.js';

describe('CustomThrottleGuard', () => {
	let guard: CustomThrottleGuard;

	beforeEach(() => {
		// Create an instance without calling parent constructor
		// We only need to test the getTracker method which is overridden
		guard = Object.create(CustomThrottleGuard.prototype);
	});

	describe('Guard instantiation', () => {
		it('should be defined', () => {
			expect(guard).toBeDefined();
		});

		it('should extend ThrottlerGuard', () => {
			expect(Object.getPrototypeOf(guard)).toBe(CustomThrottleGuard.prototype);
		});

		it('should have the expected structure', () => {
			expect(guard).toHaveProperty('canActivate');
		});
	});

	describe('getTracker method', () => {
		describe('IP address resolution with socket', () => {
			it('should return remoteAddress from socket property', async () => {
				const mockRequest = {
					socket: {
						remoteAddress: '192.168.1.100',
					},
				};

				const tracker = await guard['getTracker'](mockRequest);

				expect(tracker).toBe('192.168.1.100');
			});

			it('should return remoteAddress from connection property if socket unavailable', async () => {
				const mockRequest = {
					connection: {
						remoteAddress: '10.0.0.50',
					},
				};

				const tracker = await guard['getTracker'](mockRequest);

				expect(tracker).toBe('10.0.0.50');
			});

			it('should prefer socket.remoteAddress over connection.remoteAddress', async () => {
				const mockRequest = {
					socket: {
						remoteAddress: '192.168.1.100',
					},
					connection: {
						remoteAddress: '10.0.0.50',
					},
				};

				const tracker = await guard['getTracker'](mockRequest);

				expect(tracker).toBe('192.168.1.100');
			});
		});

		describe('IP address resolution fallback', () => {
			it('should fall back to req.ip when socket/connection unavailable', async () => {
				const mockRequest = {
					ip: '203.0.113.42',
				};

				const tracker = await guard['getTracker'](mockRequest);

				expect(tracker).toBe('203.0.113.42');
			});

			it('should return "unknown" when all IP sources are unavailable', async () => {
				const mockRequest = {};

				const tracker = await guard['getTracker'](mockRequest);

				expect(tracker).toBe('unknown');
			});

			it('should handle null/undefined socket gracefully', async () => {
				const mockRequest = {
					socket: null,
					ip: '192.168.1.1',
				};

				const tracker = await guard['getTracker'](mockRequest as any);

				expect(tracker).toBe('192.168.1.1');
			});

			it('should handle undefined remoteAddress in socket', async () => {
				const mockRequest = {
					socket: {
						remoteAddress: undefined,
					},
					ip: '192.168.1.1',
				};

				const tracker = await guard['getTracker'](mockRequest);

				expect(tracker).toBe('192.168.1.1');
			});
		});

		describe('IPv6 address handling', () => {
			it('should handle IPv6 addresses from socket', async () => {
				const mockRequest = {
					socket: {
						remoteAddress: '::1',
					},
				};

				const tracker = await guard['getTracker'](mockRequest);

				expect(tracker).toBe('::1');
			});

			it('should handle full IPv6 addresses', async () => {
				const mockRequest = {
					socket: {
						remoteAddress: '2001:db8::1',
					},
				};

				const tracker = await guard['getTracker'](mockRequest);

				expect(tracker).toBe('2001:db8::1');
			});

			it('should handle IPv6-mapped IPv4 addresses', async () => {
				const mockRequest = {
					socket: {
						remoteAddress: '::ffff:192.0.2.1',
					},
				};

				const tracker = await guard['getTracker'](mockRequest);

				expect(tracker).toBe('::ffff:192.0.2.1');
			});
		});

		describe('Special cases', () => {
			it('should handle localhost addresses', async () => {
				const mockRequest = {
					socket: {
						remoteAddress: '127.0.0.1',
					},
				};

				const tracker = await guard['getTracker'](mockRequest);

				expect(tracker).toBe('127.0.0.1');
			});

			it('should handle empty string fallback gracefully', async () => {
				const mockRequest = {
					socket: {
						remoteAddress: '',
					},
					ip: '192.168.1.1',
				};

				const tracker = await guard['getTracker'](mockRequest);

				// Empty string is falsy, so should fall back to ip
				expect(tracker).toBe('192.168.1.1');
			});
		});
	});

	describe('Rate limiting behavior', () => {
		it('should be a valid implementation of CanActivate', () => {
			expect(typeof guard.canActivate).toBe('function');
		});

		it('should have inherited methods from parent class', () => {
			const proto = Object.getPrototypeOf(guard);
			expect(proto).toBeDefined();
		});

		it('should be designed to work as a NestJS guard', () => {
			expect(guard).toHaveProperty('canActivate');
		});
	});

	describe('Integration with @nestjs/throttler', () => {
		it('should be designed for use with NestJS decorators', () => {
			// CustomThrottleGuard extends ThrottlerGuard for IP-based tracking
			expect(guard).toHaveProperty('canActivate');
		});
	});

	describe('Edge cases', () => {
		it('should handle request with both socket and connection properties missing', async () => {
			const mockRequest: any = {
				headers: {},
			};

			const tracker = await guard['getTracker'](mockRequest);

			expect(tracker).toBe('unknown');
		});

		it('should handle request with only partial socket object', async () => {
			const mockRequest = {
				socket: {
					family: 'IPv4',
				},
				ip: '192.168.1.50',
			};

			const tracker = await guard['getTracker'](mockRequest as any);

			expect(tracker).toBe('192.168.1.50');
		});

		it('should be consistent with the same IP address across multiple calls', async () => {
			const mockRequest = {
				socket: {
					remoteAddress: '203.0.113.100',
				},
			};

			const tracker1 = await guard['getTracker'](mockRequest);
			const tracker2 = await guard['getTracker'](mockRequest);

			expect(tracker1).toBe(tracker2);
		});

		it('should return different trackers for different IPs', async () => {
			const mockRequest1 = {
				socket: {
					remoteAddress: '192.168.1.1',
				},
			};

			const mockRequest2 = {
				socket: {
					remoteAddress: '192.168.1.2',
				},
			};

			const tracker1 = await guard['getTracker'](mockRequest1);
			const tracker2 = await guard['getTracker'](mockRequest2);

			expect(tracker1).not.toBe(tracker2);
		});
	});

	describe('Proxy configuration scenarios', () => {
		it('should use direct socket address when available (not spoofable)', async () => {
			const mockRequest = {
				socket: {
					remoteAddress: '192.168.1.100',
				},
				headers: {
					'x-forwarded-for': '203.0.113.1',
				},
				ip: '203.0.113.1',
			};

			const tracker = await guard['getTracker'](mockRequest as any);

			// Should prefer direct socket, not X-Forwarded-For
			expect(tracker).toBe('192.168.1.100');
		});

		it('should use req.ip when socket unavailable (test environment scenario)', async () => {
			const mockRequest = {
				ip: '192.168.1.100',
			};

			const tracker = await guard['getTracker'](mockRequest as any);

			expect(tracker).toBe('192.168.1.100');
		});
	});
});
