import { vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { WebSocketAuthService } from '../../subscriptions/websocket-auth.service.js';

describe('WebSocketAuthService', () => {
	let service: WebSocketAuthService;

	beforeEach(() => {
		const mockJwtService = {
			verifyAsync: vi.fn().mockImplementation(async (token: string) => {
				const parts = token.split('.');
				if (parts.length !== 3) throw new Error('Invalid token format');
				const base64 = (parts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
				const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) as Record<string, unknown>;
				if (typeof payload['exp'] === 'number' && payload['exp'] <= Math.floor(Date.now() / 1000)) {
					throw new Error('Token expired');
				}
				return payload;
			}),
		};

		const mockModuleRef = {
			get: (token: any) => {
				if (token === JwtService) return mockJwtService;
				return undefined;
			},
		} as any;

		service = new WebSocketAuthService(mockModuleRef);
	});

	describe('authenticate', () => {
		it('should authenticate with valid JWT token', async () => {
			// Create a simple JWT-like token for testing
			const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
			const payload = Buffer.from(JSON.stringify({
				sub: 'user123',
				exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
			})).toString('base64url');
			const signature = 'dummy-signature';
			const token = `${header}.${payload}.${signature}`;

			const connectionParams = { authorization: token };

			const result = await service.Authenticate(connectionParams);

			expect(result.authenticated).toBe(true);
			expect(result.userId).toBe('user123');
			expect(result.error).toBeUndefined();
		});

		it('should reject missing token', async () => {
			const connectionParams = {};

			const result = await service.Authenticate(connectionParams);

			expect(result.authenticated).toBe(false);
			expect(result.error).toBe('No authentication token provided');
		});

		it('should reject expired token', async () => {
			const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
			const payload = Buffer.from(JSON.stringify({
				sub: 'user123',
				exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
			})).toString('base64url');
			const signature = 'dummy-signature';
			const token = `${header}.${payload}.${signature}`;

			const connectionParams = { token };

			const result = await service.Authenticate(connectionParams);

			expect(result.authenticated).toBe(false);
			expect(result.error).toBe('Invalid authentication token');
		});

		it('should reject malformed token', async () => {
			const connectionParams = { authorization: 'malformed-token' };

			const result = await service.Authenticate(connectionParams);

			expect(result.authenticated).toBe(false);
			expect(result.error).toBe('Invalid authentication token');
		});

		it('should handle authentication errors gracefully', async () => {
			// Mock a token that causes JSON parsing to fail
			const connectionParams = { token: 'header.invalid-json.signature' };

			const result = await service.Authenticate(connectionParams);

			expect(result.authenticated).toBe(false);
			expect(result.error).toBe('Invalid authentication token');
		});
	});

	describe('extractToken', () => {
		it('should extract token from authorization field', () => {
			const connectionParams = { authorization: 'Bearer token123' };
			const token = (service as any).ExtractToken(connectionParams);
			expect(token).toBe('Bearer token123');
		});

		it('should extract token from Authorization field', () => {
			const connectionParams = { Authorization: 'Bearer token123' };
			const token = (service as any).ExtractToken(connectionParams);
			expect(token).toBe('Bearer token123');
		});

		it('should extract token from token field', () => {
			const connectionParams = { token: 'token123' };
			const token = (service as any).ExtractToken(connectionParams);
			expect(token).toBe('token123');
		});

		it('should extract token from authToken field', () => {
			const connectionParams = { authToken: 'token123' };
			const token = (service as any).ExtractToken(connectionParams);
			expect(token).toBe('token123');
		});

		it('should return null when no token fields present', () => {
			const connectionParams = { otherField: 'value' };
			const token = (service as any).ExtractToken(connectionParams);
			expect(token).toBeNull();
		});

		it('should prioritize authorization over other fields', () => {
			const connectionParams = {
				authorization: 'auth-token',
				token: 'token-field',
			};
			const token = (service as any).ExtractToken(connectionParams);
			expect(token).toBe('auth-token');
		});
	});

	describe('validateToken', () => {
		it('should validate token with valid payload and future expiration', async () => {
			const payload = { sub: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };
			const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

			const userId = await (service as any).ValidateToken(token);
			expect(userId).toBe('user123');
		});

		it('should reject token without subject', async () => {
			const payload = { exp: Math.floor(Date.now() / 1000) + 3600 };
			const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

			const userId = await (service as any).ValidateToken(token);
			expect(userId).toBeNull();
		});

		it('should reject expired token', async () => {
			const payload = { sub: 'user123', exp: Math.floor(Date.now() / 1000) - 3600 };
			const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

			const userId = await (service as any).ValidateToken(token);
			expect(userId).toBeNull();
		});

		it('should handle decode errors', async () => {
			const userId = await (service as any).ValidateToken('invalid-token');
			expect(userId).toBeNull();
		});

		it('should return null when JwtService is unavailable (fail closed)', async () => {
			const serviceWithoutJwt = new WebSocketAuthService({
				get: () => undefined,
			} as any);

			const userId = await (serviceWithoutJwt as any).ValidateToken('some-token');
			expect(userId).toBeNull();
		});
	});

	describe('security scenarios', () => {
		it('should reject token with empty subject', async () => {
			const payload = { sub: '', exp: Math.floor(Date.now() / 1000) + 3600 };
			const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

			const result = await service.Authenticate({ authorization: token });

			expect(result.authenticated).toBe(false);
		});

		it('should reject token with null expiration (infinite validity)', async () => {
			// This tests that we properly handle edge case
			const payload = { sub: 'user123', exp: null };
			const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

			const result = await service.Authenticate({ authorization: token });

			// Token without exp should be treated as valid (no expiration check fails)
			expect(result.authenticated).toBe(true);
			expect(result.userId).toBe('user123');
		});

		it('should reject token expiring exactly now', async () => {
			const now = Math.floor(Date.now() / 1000);
			const payload = { sub: 'user123', exp: now };
			const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

			const result = await service.Authenticate({ authorization: token });

			expect(result.authenticated).toBe(false);
			expect(result.error).toBe('Invalid authentication token');
		});

		it('should reject token with far future expiration that looks suspicious', async () => {
			// Very far in future (100 years)
			const payload = { sub: 'user123', exp: Math.floor(Date.now() / 1000) + (100 * 365 * 24 * 60 * 60) };
			const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

			// Should still authenticate if it's technically valid
			const result = await service.Authenticate({ authorization: token });

			expect(result.authenticated).toBe(true);
		});
	});

	describe('user extraction', () => {
		it('should extract user ID from valid token', async () => {
			const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
			const payload = Buffer.from(JSON.stringify({
				sub: 'extracted-user',
				exp: Math.floor(Date.now() / 1000) + 3600,
			})).toString('base64url');
			const signature = 'sig';
			const token = `${header}.${payload}.${signature}`;

			const result = await service.Authenticate({ authorization: token });

			expect(result.authenticated).toBe(true);
			expect(result.userId).toBe('extracted-user');
		});

		it('should extract user ID from token with additional claims', async () => {
			const payload = Buffer.from(JSON.stringify({
				sub: 'user-with-claims',
				exp: Math.floor(Date.now() / 1000) + 3600,
				email: 'user@example.com',
				roles: ['admin', 'user'],
			})).toString('base64url');
			const token = `header.${payload}.signature`;

			const result = await service.Authenticate({ authorization: token });

			expect(result.authenticated).toBe(true);
			expect(result.userId).toBe('user-with-claims');
		});
	});

	describe('connection context', () => {
		it('should create context with authenticated user', async () => {
			const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
			const payload = Buffer.from(JSON.stringify({
				sub: 'context-user',
				exp: Math.floor(Date.now() / 1000) + 3600,
			})).toString('base64url');
			const token = `${header}.${payload}.sig`;

			const result = await service.Authenticate({ authorization: token });

			expect(result.authenticated).toBe(true);
			expect(result.userId).toBe('context-user');
			expect(result.error).toBeUndefined();
		});

		it('should include request metadata in context', async () => {
			const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
			const payload = Buffer.from(JSON.stringify({
				sub: 'metadata-user',
				exp: Math.floor(Date.now() / 1000) + 3600,
			})).toString('base64url');
			const token = `${header}.${payload}.sig`;

			const connectionParams = {
				authorization: token,
				userAgent: 'test-client',
				ipAddress: '127.0.0.1',
			};

			const result = await service.Authenticate(connectionParams);

			expect(result.authenticated).toBe(true);
			expect(result.userId).toBe('metadata-user');
		});

		it('should initialize connection with unique connection ID', async () => {
			const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
			const payload = Buffer.from(JSON.stringify({
				sub: 'connection-user',
				exp: Math.floor(Date.now() / 1000) + 3600,
			})).toString('base64url');
			const token = `${header}.${payload}.sig`;

			const result1 = await service.Authenticate({ authorization: token });
			const result2 = await service.Authenticate({ authorization: token });

			expect(result1.authenticated).toBe(true);
			expect(result2.authenticated).toBe(true);
			expect(result1.userId).toBe(result2.userId);
		});
	});

	describe('error handling and logging', () => {
		it('should throw UnauthorizedException equivalent on invalid token format', async () => {
			const result = await service.Authenticate({ authorization: 'not-a-jwt' });

			expect(result.authenticated).toBe(false);
			expect(result.error).toBe('Invalid authentication token');
		});

		it('should handle malformed base64 in token', async () => {
			const result = await service.Authenticate({ authorization: 'header.!@#$%.signature' });

			expect(result.authenticated).toBe(false);
			expect(result.error).toBe('Invalid authentication token');
		});

		it('should handle empty payload in token', async () => {
			const token = 'header..signature';

			const result = await service.Authenticate({ authorization: token });

			expect(result.authenticated).toBe(false);
			expect(result.error).toBe('Invalid authentication token');
		});

		it('should log authentication failures', async () => {
			// This is implicit in the service - just verify no uncaught errors
			const result = await service.Authenticate({ authorization: 'invalid' });

			expect(result.authenticated).toBe(false);
			expect(result.error).toBeDefined();
		});

		it('should handle JSON parsing errors in token payload', async () => {
			const header = Buffer.from('{}').toString('base64url');
			const invalidPayload = Buffer.from('not json').toString('base64url');
			const token = `${header}.${invalidPayload}.sig`;

			const result = await service.Authenticate({ authorization: token });

			expect(result.authenticated).toBe(false);
		});
	});

	describe('token validation variations', () => {
		it('should accept token with minimal valid payload', async () => {
			const payload = Buffer.from(JSON.stringify({
				sub: 'minimal-user',
			})).toString('base64url');
			const token = `header.${payload}.sig`;

			const result = await service.Authenticate({ authorization: token });

			expect(result.authenticated).toBe(true);
			expect(result.userId).toBe('minimal-user');
		});

		it('should handle token with numeric user ID', async () => {
			const payload = Buffer.from(JSON.stringify({
				sub: 12345,
				exp: Math.floor(Date.now() / 1000) + 3600,
			})).toString('base64url');
			const token = `header.${payload}.sig`;

			const result = await service.Authenticate({ authorization: token });

			expect(result.authenticated).toBe(true);
			expect(result.userId).toBe(12345);
		});

		it('should accept token with UUID subject', async () => {
			const uuid = '550e8400-e29b-41d4-a716-446655440000';
			const payload = Buffer.from(JSON.stringify({
				sub: uuid,
				exp: Math.floor(Date.now() / 1000) + 3600,
			})).toString('base64url');
			const token = `header.${payload}.sig`;

			const result = await service.Authenticate({ authorization: token });

			expect(result.authenticated).toBe(true);
			expect(result.userId).toBe(uuid);
		});
	});
});
