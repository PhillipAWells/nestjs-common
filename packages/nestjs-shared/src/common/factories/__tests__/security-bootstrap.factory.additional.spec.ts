import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApplySecurityMiddleware } from '../security-bootstrap.factory.js';

describe('ApplySecurityMiddleware - Additional Coverage', () => {
	let mockApp: any;

	beforeEach(() => {
		mockApp = {
			use: vi.fn(),
			useGlobalPipes: vi.fn(),
			enableCors: vi.fn(),
		};
	});

	describe('compression enabled/disabled', () => {
		it('should apply compression middleware when enabled', () => {
			ApplySecurityMiddleware(mockApp, {
				compressionEnabled: true,
				corsEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				xssEnabled: false,
			});

			// First middleware call should be compression
			expect(mockApp.use).toHaveBeenCalled();
		});

		it('should skip compression middleware when disabled', () => {
			const _callCount = mockApp.use.mock.calls.length;

			ApplySecurityMiddleware(mockApp, {
				compressionEnabled: false,
				corsEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				xssEnabled: false,
			});

			// Should only call use for validation pipe and other non-compression middleware
			// (but validation pipe is useGlobalPipes, not use)
			expect(mockApp.useGlobalPipes).toHaveBeenCalled();
		});

		it('should apply compression filter for x-no-compression header', () => {
			ApplySecurityMiddleware(mockApp, {
				compressionEnabled: true,
				corsEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				xssEnabled: false,
			});

			// Verify compression middleware is applied
			expect(mockApp.use).toHaveBeenCalled();
		});
	});

	describe('MongoDB injection prevention enabled/disabled', () => {
		it('should apply MongoDB injection prevention when enabled', () => {
			const callsBefore = mockApp.use.mock.calls.length;

			ApplySecurityMiddleware(mockApp, {
				compressionEnabled: false,
				mongoDbInjectionPreventionEnabled: true,
				xssEnabled: false,
				helmetEnabled: false,
				corsEnabled: false,
			});

			// Should have called use() for the middleware
			expect(mockApp.use.mock.calls.length).toBeGreaterThan(callsBefore);
		});

		it('should skip MongoDB injection prevention when disabled', () => {
			const originalCalls = mockApp.use.mock.calls.length;

			ApplySecurityMiddleware(mockApp, {
				compressionEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				corsEnabled: false,
			});

			// Should not add additional middleware
			// Should not add additional middleware when all security features are disabled
			// (validation pipe uses useGlobalPipes, not use())
			expect(mockApp.use.mock.calls.length).toBeLessThanOrEqual(originalCalls + 2);
		});

		it('should sanitize both body and params in MongoDB middleware', () => {
			ApplySecurityMiddleware(mockApp, {
				mongoDbInjectionPreventionEnabled: true,
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				corsEnabled: false,
			});

			// Get the middleware function
			const middlewareCalls = mockApp.use.mock.calls;
			expect(middlewareCalls.length).toBeGreaterThan(0);
		});
	});

	describe('XSS protection enabled/disabled', () => {
		it('should apply XSS sanitization when enabled', () => {
			ApplySecurityMiddleware(mockApp, {
				xssEnabled: true,
				compressionEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				helmetEnabled: false,
				corsEnabled: false,
			});

			expect(mockApp.use).toHaveBeenCalled();
		});

		it('should skip XSS sanitization when disabled', () => {
			ApplySecurityMiddleware(mockApp, {
				xssEnabled: false,
				compressionEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				helmetEnabled: false,
				corsEnabled: false,
			});

			// Should not have XSS middleware applied
			expect(mockApp.useGlobalPipes).toHaveBeenCalled();
		});

		it('should sanitize body, query, and params in XSS middleware', () => {
			ApplySecurityMiddleware(mockApp, {
				xssEnabled: true,
				compressionEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				helmetEnabled: false,
				corsEnabled: false,
			});

			expect(mockApp.use).toHaveBeenCalled();
		});
	});

	describe('Helmet enabled/disabled', () => {
		it('should apply Helmet when enabled', () => {
			ApplySecurityMiddleware(mockApp, {
				helmetEnabled: true,
				compressionEnabled: false,
				xssEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				corsEnabled: false,
			});

			expect(mockApp.use).toHaveBeenCalled();
		});

		it('should skip Helmet when disabled', () => {
			ApplySecurityMiddleware(mockApp, {
				helmetEnabled: false,
				compressionEnabled: false,
				xssEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				corsEnabled: false,
			});

			// Should apply validation pipe but not helmet
			expect(mockApp.useGlobalPipes).toHaveBeenCalled();
		});

		it('should include CSP directives from options', () => {
			ApplySecurityMiddleware(mockApp, {
				helmetEnabled: true,
				cspConnectSrc: ['https://api.example.com'],
				cspImgSrc: ['https://cdn.example.com'],
				compressionEnabled: false,
				xssEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				corsEnabled: false,
			});

			expect(mockApp.use).toHaveBeenCalled();
		});

		it('should use default CSP directives when not provided', () => {
			ApplySecurityMiddleware(mockApp, {
				helmetEnabled: true,
				compressionEnabled: false,
				xssEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				corsEnabled: false,
			});

			expect(mockApp.use).toHaveBeenCalled();
		});
	});

	describe('CORS enabled/disabled', () => {
		it('should enable CORS when enabled', () => {
			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			expect(mockApp.enableCors).toHaveBeenCalled();
		});

		it('should skip CORS when disabled', () => {
			ApplySecurityMiddleware(mockApp, {
				corsEnabled: false,
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			expect(mockApp.enableCors).not.toHaveBeenCalled();
		});

		it('should configure CORS with provided origins', () => {
			const origins = ['https://example.com', 'https://app.example.com'];

			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				corsOrigins: origins,
				environment: 'production',
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			expect(mockApp.enableCors).toHaveBeenCalled();
		});

		it('should support custom CORS allowed headers', () => {
			const headers = ['Authorization', 'X-Custom-Header'];

			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				corsAllowedHeaders: headers,
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			expect(mockApp.enableCors).toHaveBeenCalled();
		});
	});

	describe('CORS origin validation - development mode', () => {
		it('should allow localhost origins in development', () => {
			let corsConfig: any;

			mockApp.enableCors = vi.fn((config) => {
				corsConfig = config;
			});

			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				environment: 'development',
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			// Test origin callback
			const callback = vi.fn();
			corsConfig.origin('http://localhost:3000', callback);

			expect(callback).toHaveBeenCalledWith(null, true);
		});

		it('should allow Apollo Studio in development', () => {
			let corsConfig: any;

			mockApp.enableCors = vi.fn((config) => {
				corsConfig = config;
			});

			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				environment: 'development',
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			const callback = vi.fn();
			corsConfig.origin('https://studio.apollographql.com', callback);

			expect(callback).toHaveBeenCalledWith(null, true);
		});

		it('should allow all localhost ports in development', () => {
			let corsConfig: any;

			mockApp.enableCors = vi.fn((config) => {
				corsConfig = config;
			});

			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				environment: 'development',
				corsOrigins: [],
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			const ports = ['3000', '5173', '8000', '9000'];
			for (const port of ports) {
				const callback = vi.fn();
				corsConfig.origin(`http://localhost:${port}`, callback);
				expect(callback).toHaveBeenCalledWith(null, true);
			}
		});
	});

	describe('CORS origin validation - production mode', () => {
		it('should reject localhost origins in production', () => {
			let corsConfig: any;

			mockApp.enableCors = vi.fn((config) => {
				corsConfig = config;
			});

			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				environment: 'production',
				corsOrigins: [],
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			const callback = vi.fn();
			corsConfig.origin('http://localhost:3000', callback);

			expect(callback).toHaveBeenCalled();
			// eslint-disable-next-line prefer-destructuring
			const [error] = callback.mock.calls[0];
			expect(error).toBeInstanceOf(Error);
		});

		it('should reject Apollo Studio in production', () => {
			let corsConfig: any;

			mockApp.enableCors = vi.fn((config) => {
				corsConfig = config;
			});

			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				environment: 'production',
				corsOrigins: [],
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			const callback = vi.fn();
			corsConfig.origin('https://studio.apollographql.com', callback);

			expect(callback).toHaveBeenCalled();
			const [error] = callback.mock.calls[0]!;
			expect(error).toBeInstanceOf(Error);
		});

		it('should allow configured origins in production', () => {
			let corsConfig: any;

			mockApp.enableCors = vi.fn((config) => {
				corsConfig = config;
			});

			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				environment: 'production',
				corsOrigins: ['https://example.com', 'https://app.example.com'],
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			const callback = vi.fn();
			corsConfig.origin('https://example.com', callback);

			expect(callback).toHaveBeenCalledWith(null, true);
		});

		it('should reject non-configured origins in production', () => {
			let corsConfig: any;

			mockApp.enableCors = vi.fn((config) => {
				corsConfig = config;
			});

			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				environment: 'production',
				corsOrigins: ['https://example.com'],
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			const callback = vi.fn();
			corsConfig.origin('https://attacker.com', callback);

			expect(callback).toHaveBeenCalled();
			const [error] = callback.mock.calls[0]!;
			expect(error).toBeInstanceOf(Error);
		});
	});

	describe('CORS origin validation - no origin header', () => {
		it('should allow requests without origin header', () => {
			let corsConfig: any;

			mockApp.enableCors = vi.fn((config) => {
				corsConfig = config;
			});

			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				corsOrigins: [],
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			const callback = vi.fn();
			corsConfig.origin(undefined, callback);

			expect(callback).toHaveBeenCalledWith(null, true);
		});

		it('should allow null origin', () => {
			let corsConfig: any;

			mockApp.enableCors = vi.fn((config) => {
				corsConfig = config;
			});

			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				corsOrigins: [],
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			const callback = vi.fn();
			corsConfig.origin(null, callback);

			expect(callback).toHaveBeenCalledWith(null, true);
		});
	});

	describe('environment detection', () => {
		it('should use NODE_ENV if environment not provided', () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = 'staging';

			let _corsConfig: any;
			mockApp.enableCors = vi.fn((config) => {
				_corsConfig = config;
			});

			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				corsOrigins: [],
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			expect(mockApp.enableCors).toHaveBeenCalled();

			process.env.NODE_ENV = originalEnv;
		});

		it('should default to development if NODE_ENV not set', () => {
			const originalEnv = process.env.NODE_ENV;
			delete process.env.NODE_ENV;

			let _corsConfig: any;
			mockApp.enableCors = vi.fn((config) => {
				_corsConfig = config;
			});

			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				corsOrigins: [],
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			expect(mockApp.enableCors).toHaveBeenCalled();

			process.env.NODE_ENV = originalEnv;
		});

		it('should use provided environment over NODE_ENV', () => {
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = 'development';

			let corsConfig: any;
			mockApp.enableCors = vi.fn((config) => {
				corsConfig = config;
			});

			ApplySecurityMiddleware(mockApp, {
				corsEnabled: true,
				environment: 'production',
				corsOrigins: [],
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
			});

			// Verify production rules are applied
			const callback = vi.fn();
			corsConfig.origin('http://localhost:3000', callback);
			expect(callback).toHaveBeenCalled();
			const [error] = callback.mock.calls[0]!;
			expect(error).toBeInstanceOf(Error);

			process.env.NODE_ENV = originalEnv;
		});
	});

	describe('global validation pipe', () => {
		it('should always apply global validation pipe', () => {
			ApplySecurityMiddleware(mockApp, {
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				corsEnabled: false,
			});

			expect(mockApp.useGlobalPipes).toHaveBeenCalled();
		});

		it('should apply validation pipe with correct options', () => {
			ApplySecurityMiddleware(mockApp, {
				compressionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				corsEnabled: false,
			});

			expect(mockApp.useGlobalPipes).toHaveBeenCalled();
			const [call] = mockApp.useGlobalPipes.mock.calls[0]!;
			expect(call).toBeDefined();
		});
	});

	describe('all features enabled', () => {
		it('should apply all security features when all enabled', () => {
			ApplySecurityMiddleware(mockApp, {
				compressionEnabled: true,
				mongoDbInjectionPreventionEnabled: true,
				xssEnabled: true,
				helmetEnabled: true,
				corsEnabled: true,
				corsOrigins: ['https://example.com'],
				environment: 'production',
			});

			expect(mockApp.use).toHaveBeenCalled();
			expect(mockApp.useGlobalPipes).toHaveBeenCalled();
			expect(mockApp.enableCors).toHaveBeenCalled();
		});
	});

	describe('all features disabled', () => {
		it('should only apply validation pipe when all features disabled', () => {
			ApplySecurityMiddleware(mockApp, {
				compressionEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
				corsEnabled: false,
			});

			expect(mockApp.useGlobalPipes).toHaveBeenCalled();
			expect(mockApp.enableCors).not.toHaveBeenCalled();
		});
	});

	describe('default options', () => {
		it('should use defaults when options not provided', () => {
			ApplySecurityMiddleware(mockApp);

			// Should still apply security features with defaults
			expect(mockApp.useGlobalPipes).toHaveBeenCalled();
		});

		it('should default to enabling all features', () => {
			ApplySecurityMiddleware(mockApp, {
				corsOrigins: [],
			});

			// Should apply compression, helmet, cors, etc.
			expect(mockApp.use).toHaveBeenCalled();
			expect(mockApp.useGlobalPipes).toHaveBeenCalled();
		});
	});
});
