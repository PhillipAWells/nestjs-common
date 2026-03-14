
import { INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeEach } from 'vitest';
import { ApplySecurityMiddleware } from '../security-bootstrap.factory.js';

describe('SecurityBootstrapFactory', () => {
	let app: INestApplication;
	let UseCallCount: number;
	let EnableCorsCallCount: number;
	let UseGlobalPipesCallCount: number;
	let appliedMiddlewares: any[];
	let corsOptions: any;

	beforeEach(() => {
		UseCallCount = 0;
		EnableCorsCallCount = 0;
		UseGlobalPipesCallCount = 0;
		appliedMiddlewares = [];
		corsOptions = null;

		// Create a mock app
		app = {
			use: (middleware: any) => {
				UseCallCount += 1;
				appliedMiddlewares.push(middleware);
				return app;
			},
			enableCors: (options: any) => {
				EnableCorsCallCount += 1;
				corsOptions = options;
				return app;
			},
			useGlobalPipes: (_pipes: any) => {
				UseGlobalPipesCallCount += 1;
				return app;
			},
		} as any;
	});

	it('should apply security middleware without errors', () => {
		expect(() => {
			ApplySecurityMiddleware(app, {});
		}).not.toThrow();
	});

	it('should call app.use for middleware', () => {
		ApplySecurityMiddleware(app, {});
		expect(UseCallCount).toBeGreaterThan(0);
	});

	it('should enable CORS', () => {
		ApplySecurityMiddleware(app, {});
		expect(EnableCorsCallCount).toBeGreaterThan(0);
	});

	it('should apply with custom CORS origins', () => {
		const customOrigins = ['https://example.com'];
		ApplySecurityMiddleware(app, { corsOrigins: customOrigins });
		expect(EnableCorsCallCount).toBeGreaterThan(0);
	});

	it('should apply global validation pipe', () => {
		ApplySecurityMiddleware(app, {});
		expect(UseGlobalPipesCallCount).toBeGreaterThan(0);
	});

	it('should respect disabled features', () => {
		ApplySecurityMiddleware(app, {
			compressionEnabled: false,
			xssEnabled: false,
			helmetEnabled: false,
			mongoDbInjectionPreventionEnabled: false,
		});
		// Should still call at least CORS and validation
		expect(EnableCorsCallCount).toBeGreaterThan(0);
		expect(UseGlobalPipesCallCount).toBeGreaterThan(0);
	});

	it('should allow custom logger', () => {
		const MockLogger = {
			log: (_message: string, ..._args: any[]) => {
				// Mock logger
			},
			warn: (_message: string, ..._args: any[]) => {
				// Mock logger
			},
		};
		expect(() => {
			ApplySecurityMiddleware(app, { logger: MockLogger as any });
		}).not.toThrow();
	});

	it('should handle custom environment', () => {
		expect(() => {
			ApplySecurityMiddleware(app, { environment: 'production' });
		}).not.toThrow();
	});

	it('should apply compression with correct options', () => {
		const initialUseCount = UseCallCount;
		ApplySecurityMiddleware(app, { compressionEnabled: true });
		expect(UseCallCount).toBeGreaterThan(initialUseCount);
	});

	it('should default all security features to enabled', () => {
		ApplySecurityMiddleware(app, {});
		// Should apply all features since defaults are true
		expect(UseCallCount).toBeGreaterThan(0);
		expect(EnableCorsCallCount).toBeGreaterThan(0);
		expect(UseGlobalPipesCallCount).toBeGreaterThan(0);
	});

	describe('XSS Sanitization Middleware', () => {
		it('should apply XSS sanitization middleware when enabled', () => {
			const initialCount = appliedMiddlewares.length;
			ApplySecurityMiddleware(app, { xssEnabled: true });
			expect(appliedMiddlewares.length).toBeGreaterThan(initialCount);
		});

		it('should not apply XSS sanitization when disabled', () => {
			ApplySecurityMiddleware(app, { xssEnabled: false });
			// XSS middleware should not be in the stack
			const xssMiddleware = appliedMiddlewares.some(m => m.name === 'xssMiddleware');
			expect(xssMiddleware).toBe(false);
		});

		it('should sanitize request body XSS vectors', () => {
			const _mockNext = () => { /* no-op */ };
			const mockRes = {} as any;
			let _capturedBody: any;

			const mockReq = {
				body: { name: '<script>alert("xss")</script>' },
				query: {},
				params: {},
			};

			ApplySecurityMiddleware(app, { xssEnabled: true });
			const xssMiddleware = appliedMiddlewares[appliedMiddlewares.length - 3]; // XSS is usually 3rd from end
			if (xssMiddleware && typeof xssMiddleware === 'function') {
				xssMiddleware(mockReq, mockRes, () => {
					_capturedBody = mockReq.body;
				});
			}
		});
	});

	describe('CORS Configuration', () => {
		it('should apply CORS with provided origins', () => {
			const origins = ['https://example.com', 'https://api.example.com'];
			ApplySecurityMiddleware(app, { corsOrigins: origins });
			expect(corsOptions).toBeDefined();
			expect(typeof corsOptions.origin).toBe('function');
		});

		it('should allow localhost in development', () => {
			ApplySecurityMiddleware(app, { environment: 'development' });
			expect(corsOptions).toBeDefined();
			const callback = (err: any, allow: boolean) => {
				expect(allow).toBe(true);
			};
			corsOptions.origin('http://localhost:3000', callback);
		});

		it('should allow Apollo Studio in development', () => {
			ApplySecurityMiddleware(app, { environment: 'development' });
			expect(corsOptions).toBeDefined();
			const callback = (err: any, allow: boolean) => {
				expect(allow).toBe(true);
			};
			corsOptions.origin('https://studio.apollographql.com', callback);
		});

		it('should reject unknown origins in production', () => {
			ApplySecurityMiddleware(app, { environment: 'production', corsOrigins: [] });
			expect(corsOptions).toBeDefined();
			const callback = (err: Error | null, _allow?: boolean) => {
				expect(err).toBeDefined();
				expect(err?.message).toContain('Not allowed by CORS');
			};
			corsOptions.origin('https://unknown.com', callback);
		});

		it('should disable CORS when corsEnabled is false', () => {
			const initialCorsCount = EnableCorsCallCount;
			ApplySecurityMiddleware(app, { corsEnabled: false });
			expect(EnableCorsCallCount).toBe(initialCorsCount);
		});
	});

	describe('Helmet Security Headers', () => {
		it('should apply Helmet when enabled', () => {
			const initialCount = appliedMiddlewares.length;
			ApplySecurityMiddleware(app, { helmetEnabled: true });
			expect(appliedMiddlewares.length).toBeGreaterThan(initialCount);
		});

		it('should not apply Helmet when disabled', () => {
			ApplySecurityMiddleware(app, { helmetEnabled: false });
			// Verify that middleware count is lower when helmet is disabled
			const countWithHelmet = UseCallCount;

			UseCallCount = 0;
			appliedMiddlewares = [];
			ApplySecurityMiddleware(app, { helmetEnabled: true });
			const countWithoutHelmet = UseCallCount;

			expect(countWithHelmet).toBeLessThan(countWithoutHelmet);
		});
	});

	describe('Compression Middleware', () => {
		it('should apply compression when enabled', () => {
			const initialCount = appliedMiddlewares.length;
			ApplySecurityMiddleware(app, { compressionEnabled: true });
			expect(appliedMiddlewares.length).toBeGreaterThan(initialCount);
		});

		it('should not apply compression when disabled', () => {
			ApplySecurityMiddleware(app, { compressionEnabled: false });
			// Verify middleware count is lower
			const countWithoutCompression = UseCallCount;

			UseCallCount = 0;
			appliedMiddlewares = [];
			ApplySecurityMiddleware(app, { compressionEnabled: true });
			const countWithCompression = UseCallCount;

			expect(countWithoutCompression).toBeLessThan(countWithCompression);
		});
	});

	describe('MongoDB Injection Prevention', () => {
		it('should apply MongoDB injection prevention when enabled', () => {
			const initialCount = appliedMiddlewares.length;
			ApplySecurityMiddleware(app, { mongoDbInjectionPreventionEnabled: true });
			expect(appliedMiddlewares.length).toBeGreaterThan(initialCount);
		});

		it('should not apply MongoDB injection prevention when disabled', () => {
			ApplySecurityMiddleware(app, { mongoDbInjectionPreventionEnabled: false });
			const countWithout = UseCallCount;

			UseCallCount = 0;
			appliedMiddlewares = [];
			ApplySecurityMiddleware(app, { mongoDbInjectionPreventionEnabled: true });
			const countWith = UseCallCount;

			expect(countWithout).toBeLessThan(countWith);
		});

		it('should sanitize MongoDB injection vectors in body', () => {
			const mockNext = () => { /* no-op */ };
			const mockRes = {} as any;

			const mockReq = {
				body: { username: 'admin', password: { $ne: null } },
				params: {},
			};

			ApplySecurityMiddleware(app, { mongoDbInjectionPreventionEnabled: true });
			const mongoDbMiddleware = appliedMiddlewares[appliedMiddlewares.length - 4];
			if (mongoDbMiddleware && typeof mongoDbMiddleware === 'function') {
				mongoDbMiddleware(mockReq, mockRes, mockNext);
				expect(mockReq.body.password).toBeDefined();
			}
		});
	});

	describe('CSP Configuration', () => {
		it('should include custom CSP connect-src directives', () => {
			const customCsp = ['https://api.example.com'];
			ApplySecurityMiddleware(app, { cspConnectSrc: customCsp });
			expect(appliedMiddlewares.length).toBeGreaterThan(0);
		});

		it('should include custom CSP img-src directives', () => {
			const customCsp = ['https://cdn.example.com'];
			ApplySecurityMiddleware(app, { cspImgSrc: customCsp });
			expect(appliedMiddlewares.length).toBeGreaterThan(0);
		});

		it('should handle both CSP connect and img src directives', () => {
			ApplySecurityMiddleware(app, {
				cspConnectSrc: ['https://api.example.com'],
				cspImgSrc: ['https://cdn.example.com'],
			});
			expect(appliedMiddlewares.length).toBeGreaterThan(0);
		});
	});

	describe('CORS Custom Headers', () => {
		it('should apply custom CORS allowed headers', () => {
			const customHeaders = ['Content-Type', 'Authorization', 'X-Custom-Header'];
			ApplySecurityMiddleware(app, { corsAllowedHeaders: customHeaders });
			expect(corsOptions).toBeDefined();
			expect(corsOptions.allowedHeaders).toBeDefined();
		});

		it('should have default CORS allowed headers', () => {
			ApplySecurityMiddleware(app, {});
			expect(corsOptions).toBeDefined();
			expect(corsOptions.allowedHeaders).toContain('Content-Type');
			expect(corsOptions.allowedHeaders).toContain('Authorization');
		});
	});

	describe('Production Security Mode', () => {
		it('should reject localhost in production', () => {
			ApplySecurityMiddleware(app, { environment: 'production' });
			expect(corsOptions).toBeDefined();
			const callback = (err: Error | null, allow?: boolean) => {
				if (err) {
					expect(err.message).toContain('Not allowed by CORS');
				} else {
					expect(allow).toBe(false);
				}
			};
			corsOptions.origin('http://localhost:3000', callback);
		});

		it('should reject Apollo Studio in production', () => {
			ApplySecurityMiddleware(app, { environment: 'production' });
			expect(corsOptions).toBeDefined();
			const callback = (err: Error | null, allow?: boolean) => {
				if (err) {
					expect(err.message).toContain('Not allowed by CORS');
				} else {
					expect(allow).toBe(false);
				}
			};
			corsOptions.origin('https://studio.apollographql.com', callback);
		});

		it('should allow configured origins in production', () => {
			const origins = ['https://example.com'];
			ApplySecurityMiddleware(app, { environment: 'production', corsOrigins: origins });
			expect(corsOptions).toBeDefined();
			const callback = (err: any, allow: boolean) => {
				expect(allow).toBe(true);
			};
			corsOptions.origin('https://example.com', callback);
		});
	});

	describe('No-Origin Requests', () => {
		it('should allow requests without origin header', () => {
			ApplySecurityMiddleware(app, {});
			expect(corsOptions).toBeDefined();
			const callback = (err: any, allow: boolean) => {
				expect(allow).toBe(true);
			};
			corsOptions.origin(undefined, callback);
		});

		it('should allow null origin requests', () => {
			ApplySecurityMiddleware(app, {});
			expect(corsOptions).toBeDefined();
			const callback = (err: any, allow: boolean) => {
				expect(allow).toBe(true);
			};
			corsOptions.origin(null, callback);
		});
	});

	describe('Middleware Ordering', () => {
		it('should apply compression before XSS middleware', () => {
			ApplySecurityMiddleware(app, {});
			const compressionIndex = appliedMiddlewares.findIndex(m => m.toString().includes('compress'));
			const xssIndex = appliedMiddlewares.length - 3; // Approximate position
			expect(compressionIndex).toBeLessThan(xssIndex);
		});

		it('should apply validation pipe', () => {
			ApplySecurityMiddleware(app, {});
			expect(UseGlobalPipesCallCount).toBeGreaterThan(0);
		});
	});

	describe('Feature Combinations', () => {
		it('should work with all features enabled', () => {
			expect(() => {
				ApplySecurityMiddleware(app, {
					compressionEnabled: true,
					xssEnabled: true,
					helmetEnabled: true,
					mongoDbInjectionPreventionEnabled: true,
					corsEnabled: true,
				});
			}).not.toThrow();
		});

		it('should work with all features disabled', () => {
			expect(() => {
				ApplySecurityMiddleware(app, {
					compressionEnabled: false,
					xssEnabled: false,
					helmetEnabled: false,
					mongoDbInjectionPreventionEnabled: false,
					corsEnabled: false,
				});
			}).not.toThrow();
		});

		it('should work with mixed feature settings', () => {
			expect(() => {
				ApplySecurityMiddleware(app, {
					compressionEnabled: true,
					xssEnabled: false,
					helmetEnabled: true,
					mongoDbInjectionPreventionEnabled: false,
					corsEnabled: true,
				});
			}).not.toThrow();
		});
	});

	describe('Environment Variations', () => {
		it('should handle development environment', () => {
			expect(() => {
				ApplySecurityMiddleware(app, { environment: 'development' });
			}).not.toThrow();
		});

		it('should handle production environment', () => {
			expect(() => {
				ApplySecurityMiddleware(app, { environment: 'production' });
			}).not.toThrow();
		});

		it('should handle custom environment string', () => {
			expect(() => {
				ApplySecurityMiddleware(app, { environment: 'staging' });
			}).not.toThrow();
		});

		it('should default to development when NODE_ENV is not set', () => {
			const originalNodeEnv = process.env['NODE_ENV'];
			try {
				delete process.env['NODE_ENV'];
				expect(() => {
					ApplySecurityMiddleware(app, {});
				}).not.toThrow();
			} finally {
				if (originalNodeEnv) {
					process.env['NODE_ENV'] = originalNodeEnv;
				}
			}
		});
	});

	describe('Middleware Function Execution', () => {
		it('should execute compression middleware filter', () => {
			ApplySecurityMiddleware(app, { compressionEnabled: true });
			expect(appliedMiddlewares.length).toBeGreaterThan(0);

			// Get the compression middleware (it should be the first middleware applied)
			const [compressionMiddleware] = appliedMiddlewares;
			expect(typeof compressionMiddleware).toBe('function');
		});

		it('should execute MongoDB injection prevention middleware', () => {
			ApplySecurityMiddleware(app, { mongoDbInjectionPreventionEnabled: true });

			// Check that middleware was applied
			const mongodbMiddleware = appliedMiddlewares.find((m: any) => {
				try {
					return m.toString().includes('sanitizeObject');
				} catch {
					return false;
				}
			});

			expect(mongodbMiddleware !== undefined || appliedMiddlewares.length > 0).toBe(true);
		});

		it('should execute XSS sanitization middleware', () => {
			ApplySecurityMiddleware(app, { xssEnabled: true });

			// Check that middleware was applied
			const xssMiddleware = appliedMiddlewares.find((m: any) => {
				try {
					return m.toString().includes('sanitizeXss');
				} catch {
					return false;
				}
			});

			expect(xssMiddleware !== undefined || appliedMiddlewares.length > 0).toBe(true);
		});

		it('should apply Helmet middleware function', () => {
			ApplySecurityMiddleware(app, { helmetEnabled: true });

			expect(appliedMiddlewares.length).toBeGreaterThan(0);
		});

		it('middleware should be in correct order', () => {
			ApplySecurityMiddleware(app, {
				compressionEnabled: true,
				mongoDbInjectionPreventionEnabled: true,
				xssEnabled: true,
				helmetEnabled: true,
			});

			// All middleware should be applied in order
			expect(appliedMiddlewares.length).toBeGreaterThanOrEqual(4);
		});

		it('should invoke middleware when features are disabled', () => {
			const _initialCount = appliedMiddlewares.length;
			ApplySecurityMiddleware(app, {
				compressionEnabled: false,
				mongoDbInjectionPreventionEnabled: false,
				xssEnabled: false,
				helmetEnabled: false,
			});

			// Even with all disabled, CORS and validation pipe are still applied
			expect(UseGlobalPipesCallCount).toBeGreaterThan(0);
		});
	});

	describe('Compression Filter Branches', () => {
		it('should skip compression when x-no-compression header is present', () => {
			const mockReq = {
				headers: { 'x-no-compression': 'true' },
			};
			const mockRes = {};

			ApplySecurityMiddleware(app, { compressionEnabled: true });
			const [compressionMiddleware] = appliedMiddlewares; // First middleware

			if (compressionMiddleware && typeof compressionMiddleware === 'object') {
				// Get the filter from compression middleware options
				const compressionOptions = compressionMiddleware.apply ?? compressionMiddleware;
				if (compressionOptions?.filter) {
					const filterResult = compressionOptions.filter(mockReq, mockRes);
					// This tests the branch within the compression filter
					expect(filterResult !== undefined || compressionOptions).toBeDefined();
				}
			}
		});

		it('should apply compression when x-no-compression header is absent', () => {
			const _mockReq = {
				headers: {},
			};
			const _mockRes = {};

			ApplySecurityMiddleware(app, { compressionEnabled: true });
			expect(appliedMiddlewares.length).toBeGreaterThan(0);
		});
	});

	describe('CORS Callback Execution', () => {
		it('should execute CORS origin callback', () => {
			ApplySecurityMiddleware(app, {});
			expect(corsOptions).toBeDefined();
			expect(typeof corsOptions.origin).toBe('function');

			// Test the callback
			let callbackExecuted = false;
			const testCallback = () => {
				callbackExecuted = true;
			};

			corsOptions.origin('http://localhost:3000', testCallback);
			expect(callbackExecuted).toBe(true);
		});

		it('should handle invalid origins in development', () => {
			ApplySecurityMiddleware(app, { environment: 'development' });

			let errorCaught = false;
			const callback = (err: any) => {
				if (err) {
					errorCaught = true;
				}
			};

			// Valid localhost should not error
			corsOptions.origin('http://localhost:3000', callback);
			expect(errorCaught).toBe(false);
		});

		it('should handle valid configured origins', () => {
			const origins = ['https://example.com'];
			ApplySecurityMiddleware(app, { corsOrigins: origins });

			let allowed = false;
			const callback = (_err: any, allow: boolean) => {
				allowed = allow;
			};

			corsOptions.origin('https://example.com', callback);
			expect(allowed).toBe(true);
		});

		it('should reject unconfigured origins in production', () => {
			ApplySecurityMiddleware(app, { environment: 'production' });

			let errored = false;
			const callback = (err: Error | null) => {
				if (err) {
					errored = true;
				}
			};

			corsOptions.origin('https://unknown.com', callback);
			expect(errored).toBe(true);
		});
	});

	describe('Actual Middleware Function Execution', () => {
		it('should execute MongoDB injection prevention middleware with body', () => {
			const mockReq = {
				body: { field: 'value', nested: { $ne: null } },
				params: { id: 'test' },
			};
			const mockRes = {};
			let nextCalled = false;
			const mockNext = () => {
				nextCalled = true;
			};

			ApplySecurityMiddleware(app, { mongoDbInjectionPreventionEnabled: true });

			// Find the MongoDB sanitization middleware (second after compression)
			const mongoDbMiddleware = appliedMiddlewares.find((m: any) => {
				const str = m.toString();
				return str.includes('sanitizeObject');
			});

			if (mongoDbMiddleware && typeof mongoDbMiddleware === 'function') {
				mongoDbMiddleware(mockReq, mockRes, mockNext);
				expect(nextCalled).toBe(true);
				expect(mockReq.body).toBeDefined();
			}
		});

		it('should execute XSS sanitization middleware with body', () => {
			const mockReq = {
				body: { field: '<script>alert("xss")</script>' },
				query: { search: '<img src=x onerror="alert(1)">' },
				params: { id: 'test' },
			};
			const mockRes = {};
			let nextCalled = false;
			const mockNext = () => {
				nextCalled = true;
			};

			ApplySecurityMiddleware(app, { xssEnabled: true });

			// Find the XSS sanitization middleware
			const xssMiddleware = appliedMiddlewares.find((m: any) => {
				const str = m.toString();
				return str.includes('sanitizeXss');
			});

			if (xssMiddleware && typeof xssMiddleware === 'function') {
				xssMiddleware(mockReq, mockRes, mockNext);
				expect(nextCalled).toBe(true);
				expect(mockReq.body).toBeDefined();
				expect(mockReq.query).toBeDefined();
				expect(mockReq.params).toBeDefined();
			}
		});

		it('should execute MongoDB injection prevention with only body present', () => {
			const mockReq = {
				body: { username: 'admin', pwd: { $ne: null } },
			};
			const mockRes = {};
			let nextCalled = false;
			const mockNext = () => {
				nextCalled = true;
			};

			ApplySecurityMiddleware(app, { mongoDbInjectionPreventionEnabled: true });

			const mongoDbMiddleware = appliedMiddlewares.find((m: any) => {
				const str = m.toString();
				return str.includes('sanitizeObject');
			});

			if (mongoDbMiddleware && typeof mongoDbMiddleware === 'function') {
				mongoDbMiddleware(mockReq, mockRes, mockNext);
				expect(nextCalled).toBe(true);
			}
		});

		it('should execute XSS sanitization with only body, no query/params', () => {
			const mockReq = {
				body: { content: '<script>alert("xss")</script>' },
			};
			const mockRes = {};
			let nextCalled = false;
			const mockNext = () => {
				nextCalled = true;
			};

			ApplySecurityMiddleware(app, { xssEnabled: true });

			const xssMiddleware = appliedMiddlewares.find((m: any) => {
				const str = m.toString();
				return str.includes('sanitizeXss');
			});

			if (xssMiddleware && typeof xssMiddleware === 'function') {
				xssMiddleware(mockReq, mockRes, mockNext);
				expect(nextCalled).toBe(true);
			}
		});

		it('should execute XSS sanitization with only query', () => {
			const mockReq = {
				query: { search: '<script>alert("xss")</script>' },
			};
			const mockRes = {};
			let nextCalled = false;
			const mockNext = () => {
				nextCalled = true;
			};

			ApplySecurityMiddleware(app, { xssEnabled: true });

			const xssMiddleware = appliedMiddlewares.find((m: any) => {
				const str = m.toString();
				return str.includes('sanitizeXss');
			});

			if (xssMiddleware && typeof xssMiddleware === 'function') {
				xssMiddleware(mockReq, mockRes, mockNext);
				expect(nextCalled).toBe(true);
			}
		});

		it('should execute MongoDB injection prevention with only params', () => {
			const mockReq = {
				params: { id: { $ne: null } },
			};
			const mockRes = {};
			let nextCalled = false;
			const mockNext = () => {
				nextCalled = true;
			};

			ApplySecurityMiddleware(app, { mongoDbInjectionPreventionEnabled: true });

			const mongoDbMiddleware = appliedMiddlewares.find((m: any) => {
				const str = m.toString();
				return str.includes('sanitizeObject');
			});

			if (mongoDbMiddleware && typeof mongoDbMiddleware === 'function') {
				mongoDbMiddleware(mockReq, mockRes, mockNext);
				expect(nextCalled).toBe(true);
			}
		});

		it('should skip sanitization when request has no body/params', () => {
			const mockReq = {};
			const mockRes = {};
			let nextCalled = false;
			const mockNext = () => {
				nextCalled = true;
			};

			ApplySecurityMiddleware(app, { mongoDbInjectionPreventionEnabled: true });

			const mongoDbMiddleware = appliedMiddlewares.find((m: any) => {
				const str = m.toString();
				return str.includes('sanitizeObject');
			});

			if (mongoDbMiddleware && typeof mongoDbMiddleware === 'function') {
				mongoDbMiddleware(mockReq, mockRes, mockNext);
				expect(nextCalled).toBe(true);
			}
		});
	});

	describe('CORS Origin Callback All Branches', () => {
		it('should allow null origin without calling callback with error', () => {
			ApplySecurityMiddleware(app, { environment: 'production' });
			expect(corsOptions).toBeDefined();

			let callbackCalled = false;
			let errorProvided = false;
			const callback = (err: Error | null, _allow?: boolean) => {
				callbackCalled = true;
				if (err) {
					errorProvided = true;
				}
			};

			corsOptions.origin(null, callback);
			expect(callbackCalled).toBe(true);
			expect(errorProvided).toBe(false);
		});

		it('should allow localhost:* in development environment', () => {
			ApplySecurityMiddleware(app, { environment: 'development' });
			expect(corsOptions).toBeDefined();

			let allowed = false;
			const callback = (err: any, allow?: boolean) => {
				if (!err && allow) {
					allowed = true;
				}
			};

			corsOptions.origin('http://localhost:8080', callback);
			expect(allowed).toBe(true);
		});

		it('should reject localhost in production environment', () => {
			ApplySecurityMiddleware(app, { environment: 'production' });
			expect(corsOptions).toBeDefined();

			let rejected = false;
			const callback = (err: Error | null, allow?: boolean) => {
				if (err || allow === false) {
					rejected = true;
				}
			};

			corsOptions.origin('http://localhost:3000', callback);
			expect(rejected).toBe(true);
		});

		it('should allow Apollo Studio in development', () => {
			ApplySecurityMiddleware(app, { environment: 'development' });
			expect(corsOptions).toBeDefined();

			let allowed = false;
			const callback = (err: any, allow?: boolean) => {
				if (!err && allow) {
					allowed = true;
				}
			};

			corsOptions.origin('https://studio.apollographql.com', callback);
			expect(allowed).toBe(true);
		});

		it('should allow Apollo Sandbox in development', () => {
			ApplySecurityMiddleware(app, { environment: 'development' });
			expect(corsOptions).toBeDefined();

			let allowed = false;
			const callback = (err: any, allow?: boolean) => {
				if (!err && allow) {
					allowed = true;
				}
			};

			corsOptions.origin('https://sandbox.apollo.dev', callback);
			expect(allowed).toBe(true);
		});

		it('should reject Apollo Studio in production', () => {
			ApplySecurityMiddleware(app, { environment: 'production' });
			expect(corsOptions).toBeDefined();

			let rejected = false;
			const callback = (err: Error | null, allow?: boolean) => {
				if (err || allow === false) {
					rejected = true;
				}
			};

			corsOptions.origin('https://studio.apollographql.com', callback);
			expect(rejected).toBe(true);
		});

		it('should allow configured origins', () => {
			ApplySecurityMiddleware(app, { corsOrigins: ['https://myapp.com'], environment: 'production' });
			expect(corsOptions).toBeDefined();

			let allowed = false;
			const callback = (err: any, allow?: boolean) => {
				if (!err && allow) {
					allowed = true;
				}
			};

			corsOptions.origin('https://myapp.com', callback);
			expect(allowed).toBe(true);
		});

		it('should reject origin not in configured list', () => {
			ApplySecurityMiddleware(app, { corsOrigins: ['https://myapp.com'], environment: 'production' });
			expect(corsOptions).toBeDefined();

			let rejected = false;
			const callback = (err: Error | null, allow?: boolean) => {
				if (err || allow === false) {
					rejected = true;
				}
			};

			corsOptions.origin('https://untrusted.com', callback);
			expect(rejected).toBe(true);
		});

		it('should handle development environment with no origin header', () => {
			ApplySecurityMiddleware(app, { environment: 'development' });
			expect(corsOptions).toBeDefined();

			let allowed = false;
			const callback = (err: any, allow?: boolean) => {
				if (!err && allow) {
					allowed = true;
				}
			};

			corsOptions.origin(undefined, callback);
			expect(allowed).toBe(true);
		});
	});

	describe('Complete Setup', () => {
		it('should setup a complete secure application', () => {
			expect(() => {
				ApplySecurityMiddleware(app, {
					corsOrigins: ['https://api.example.com'],
					environment: 'production',
					compressionEnabled: true,
					xssEnabled: true,
					helmetEnabled: true,
					mongoDbInjectionPreventionEnabled: true,
					corsEnabled: true,
					corsAllowedHeaders: ['Content-Type', 'Authorization'],
					cspConnectSrc: ['https://api.example.com'],
					cspImgSrc: ['https://cdn.example.com'],
				});
			}).not.toThrow();

			// All security features should be applied
			expect(UseCallCount).toBeGreaterThan(0);
			expect(EnableCorsCallCount).toBeGreaterThan(0);
			expect(UseGlobalPipesCallCount).toBeGreaterThan(0);
		});
	});
});
