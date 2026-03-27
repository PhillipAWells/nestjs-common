import { ErrorSanitizerService } from '../error-sanitizer.service.js';

describe('ErrorSanitizerService', () => {
	let service: ErrorSanitizerService;

	beforeEach(() => {
		const mockModuleRef = {
			get: () => ({}),
			resolve: () => Promise.resolve({}),
		} as any;

		service = new ErrorSanitizerService(mockModuleRef);
	});

	describe('sanitizeErrorResponse', () => {
		it('should remove file paths', () => {
			const error = {
				message: 'Error at /workspaces/nestjs/packages/nestjs-auth/source/auth.service.ts:123',
				statusCode: 500,
			};

			const sanitized = service.sanitizeErrorResponse(error);
			expect(sanitized.message).not.toContain('/workspaces');
			expect(sanitized.message).toContain('[FILE]');
		});

		it('should remove database connection strings', () => {
			const error = {
				message: 'Connection failed: mongodb://user:pass@localhost:27017/db',
				statusCode: 500,
			};

			const sanitized = service.sanitizeErrorResponse(error);
			expect(sanitized.message).not.toContain('mongodb://');
			expect(sanitized.message).toContain('[REDACTED]');
		});

		it('should remove API keys', () => {
			const error = {
				message: 'Invalid API key: sk_live_abc123def456',
				statusCode: 401,
			};

			const sanitized = service.sanitizeErrorResponse(error);
			expect(sanitized.message).not.toContain('sk_live_');
			expect(sanitized.message).toContain('[REDACTED]');
		});

		it('should not include stack trace in production', () => {
			const error = {
				message: 'Error',
				statusCode: 500,
				stack: 'Error: Something went wrong\n  at ...',
			};

			const sanitized = service.sanitizeErrorResponse(error, false);
			expect(sanitized.stack).toBeUndefined();
		});

		it('should include stack trace in development', () => {
			const error = {
				message: 'Error',
				statusCode: 500,
				stack: 'Error: Something went wrong\n  at ...',
			};

			const sanitized = service.sanitizeErrorResponse(error, true);
			expect(sanitized.stack).toBeDefined();
		});
	});

	describe('sanitizeContext', () => {
		it('should redact sensitive fields', () => {
			const context = {
				userId: '123',
				password: 'secret123',
				apiKey: 'sk_live_abc123',
			};

			const sanitized = service['sanitizeContext'](context);
			expect(sanitized.userId).toBe('123');
			expect(sanitized.password).toBe('***REDACTED***');
			expect(sanitized.apiKey).toBe('***REDACTED***');
		});

		it('should handle circular references by marking with [CIRCULAR_REF]', () => {
			const context: any = {
				userId: '123',
				nested: {
					value: 'test',
				},
			};
			// Create circular reference
			context.nested.parent = context;

			const sanitized = service['sanitizeContext'](context);
			expect(sanitized.userId).toBe('123');
			expect(sanitized.nested.value).toBe('test');
			expect(sanitized.nested.parent).toBe('[CIRCULAR_REF]');
		});

		it('should preserve sibling data when circular reference is detected', () => {
			const context: any = {
				userId: '123',
				nested: {
					a: 'value_a',
					b: 'value_b',
					self: null,
				},
			};
			context.nested.self = context.nested;

			const sanitized = service['sanitizeContext'](context);
			expect(sanitized.userId).toBe('123');
			expect(sanitized.nested.a).toBe('value_a');
			expect(sanitized.nested.b).toBe('value_b');
			expect(sanitized.nested.self).toBe('[CIRCULAR_REF]');
		});

		it('should handle arrays with circular references', () => {
			const context: any = {
				items: [1, 2, 'test'],
			};
			context.items.push(context);

			const sanitized = service['sanitizeContext'](context);
			expect(sanitized.items[0]).toBe(1);
			expect(sanitized.items[1]).toBe(2);
			expect(sanitized.items[2]).toBe('test');
			expect(sanitized.items[3]).toBe('[CIRCULAR_REF]');
		});

		it('should limit depth to prevent deeply nested structures', () => {
			const context: any = {
				level1: {
					level2: {
						level3: {
							level4: {
								level5: {
									level6: {
										value: 'deep',
									},
								},
							},
						},
					},
				},
			};

			const sanitized = service['sanitizeContext'](context);
			expect(sanitized.level1.level2.level3.level4.level5).toBe('[MAX_DEPTH]');
		});

		it('should sanitize string values in nested objects', () => {
			const context = {
				nested: {
					message: 'Error at /home/user/app.ts',
					email: 'user@example.com',
				},
			};

			const sanitized = service['sanitizeContext'](context);
			expect(sanitized.nested.message).toContain('[FILE]');
			expect(sanitized.nested.email).toContain('[EMAIL]');
		});

		it('should redact sensitive fields at any depth', () => {
			const context = {
				user: 'john',
				nested: {
					config: {
						password: 'secret',
						apiKey: 'sk_123',
					},
				},
			};

			const sanitized = service['sanitizeContext'](context);
			expect(sanitized.user).toBe('john');
			expect(sanitized.nested.config.password).toBe('***REDACTED***');
			expect(sanitized.nested.config.apiKey).toBe('***REDACTED***');
		});
	});
});
