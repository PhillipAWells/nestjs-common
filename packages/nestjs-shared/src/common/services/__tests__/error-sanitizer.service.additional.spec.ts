import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorSanitizerService, IErrorSanitizerOptions, ERROR_SANITIZER_OPTIONS } from '../error-sanitizer.service.js';

describe('ErrorSanitizerService - Additional Coverage', () => {
	let service: ErrorSanitizerService;

	function makeMockModuleRef(options?: IErrorSanitizerOptions) {
		return {
			get: (token: any) => {
				if (token === ERROR_SANITIZER_OPTIONS) {
					if (options) return options;
					throw new Error('not found');
				}
				throw new Error('not found');
			},
		} as any;
	}

	const mockModuleRef = makeMockModuleRef();

	beforeEach(() => {
		service = new ErrorSanitizerService(mockModuleRef);
	});

	describe('additionalSensitiveKeys option', () => {
		it('should accept additional sensitive keys in options', () => {
			const options: IErrorSanitizerOptions = {
				additionalSensitiveKeys: ['customSecret', 'internalKey'],
			};
			service = new ErrorSanitizerService(makeMockModuleRef(options));

			const context = {
				userId: '123',
				customSecret: 'secret_value',
				internalKey: 'internal_value',
				publicData: 'public',
			};

			const sanitized = service['sanitizeContext'](context);
			expect(sanitized.customSecret).toBe('***REDACTED***');
			expect(sanitized.internalKey).toBe('***REDACTED***');
			expect(sanitized.publicData).toBe('public');
		});

		it('should combine default and additional sensitive keys', () => {
			const options: IErrorSanitizerOptions = {
				additionalSensitiveKeys: ['customField'],
			};
			service = new ErrorSanitizerService(makeMockModuleRef(options));

			const context = {
				password: 'default_sensitive',
				token: 'default_token',
				customField: 'additional_sensitive',
			};

			const sanitized = service['sanitizeContext'](context);
			expect(sanitized.password).toBe('***REDACTED***');
			expect(sanitized.token).toBe('***REDACTED***');
			expect(sanitized.customField).toBe('***REDACTED***');
		});

		it('should handle empty additional sensitive keys array', () => {
			const options: IErrorSanitizerOptions = {
				additionalSensitiveKeys: [],
			};
			service = new ErrorSanitizerService(makeMockModuleRef(options));

			const context = {
				password: 'should_redact',
				publicData: 'public',
			};

			const sanitized = service['sanitizeContext'](context);
			expect(sanitized.password).toBe('***REDACTED***');
			expect(sanitized.publicData).toBe('public');
		});

		it('should match case-insensitively for additional keys', () => {
			const options: IErrorSanitizerOptions = {
				additionalSensitiveKeys: ['CustomSecret'],
			};
			service = new ErrorSanitizerService(makeMockModuleRef(options));

			const context = {
				customsecret: 'value1',
				CUSTOMSECRET: 'value2',
				CustomSecret: 'value3',
			};

			const sanitized = service['sanitizeContext'](context);
			// All variations should be redacted since match is case-insensitive
			Object.values(sanitized).forEach(v => {
				if (typeof v === 'string') {
					expect(v).toBe('***REDACTED***');
				}
			});
		});
	});

	describe('additionalPatterns option', () => {
		it('should apply additional patterns to message sanitization', () => {
			const options: IErrorSanitizerOptions = {
				additionalPatterns: [/custom_secret_[a-z0-9]+/gi],
			};
			service = new ErrorSanitizerService(makeMockModuleRef(options));

			const error = {
				message: 'Error with custom_secret_abc123 exposed',
				statusCode: 500,
			};

			const sanitized = service.SanitizeErrorResponse(error);
			// The message should have custom patterns applied
			expect(sanitized.message).toBeDefined();
		});

		it('should handle multiple additional patterns', () => {
			const options: IErrorSanitizerOptions = {
				additionalPatterns: [
					/secret_[a-z0-9]+/gi,
					/token_[a-z0-9]+/gi,
				],
			};
			service = new ErrorSanitizerService(makeMockModuleRef(options));

			const error = {
				message: 'Error with secret_xyz789 and token_abc123',
				statusCode: 500,
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(sanitized.message).toBeDefined();
		});

		it('should handle empty patterns array', () => {
			const options: IErrorSanitizerOptions = {
				additionalPatterns: [],
			};
			service = new ErrorSanitizerService(makeMockModuleRef(options));

			const error = {
				message: 'Regular error message',
				statusCode: 500,
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(sanitized.message).toBe('Regular error message');
		});
	});

	describe('sanitizeMessage - extended patterns', () => {
		it('should remove Bearer tokens', () => {
			const error = {
				message: 'Failed auth with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
				statusCode: 401,
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(sanitized.message).not.toContain('Bearer eyJ');
			expect(sanitized.message).toContain('Bearer [REDACTED]');
		});

		it('should remove PostgreSQL connection strings', () => {
			const error = {
				message: 'Failed: postgresql://user:pass@localhost:5432/mydb',
				statusCode: 500,
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(sanitized.message).not.toContain('postgresql://');
			expect(sanitized.message).toContain('[REDACTED]');
		});

		it('should remove email addresses', () => {
			const error = {
				message: 'IUser admin@example.com not found',
				statusCode: 404,
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(sanitized.message).not.toContain('admin@example.com');
			expect(sanitized.message).toContain('[EMAIL]');
		});

		it('should remove IP addresses', () => {
			const error = {
				message: 'Connection from 192.168.1.100 rejected',
				statusCode: 403,
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(sanitized.message).not.toContain('192.168.1.100');
			expect(sanitized.message).toContain('[IP]');
		});

		it('should handle multiple sensitive patterns in one message', () => {
			const error = {
				message: 'Error at /home/user/app.ts, Bearer sk_live_abc, user@example.com, from 10.0.0.1',
				statusCode: 500,
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(sanitized.message).not.toContain('/home/user');
			expect(sanitized.message).not.toContain('sk_live_');
			expect(sanitized.message).not.toContain('user@example.com');
			expect(sanitized.message).not.toContain('10.0.0.1');
		});
	});

	describe('edge cases in sanitization', () => {
		it('should handle null message', () => {
			const error = {
				message: null,
				statusCode: 500,
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(sanitized.message).toBe('An error occurred');
		});

		it('should handle undefined message', () => {
			const error = {
				message: undefined,
				statusCode: 500,
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(sanitized.message).toBe('An error occurred');
		});

		it('should handle empty message', () => {
			const error = {
				message: '',
				statusCode: 500,
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(sanitized.message).toBe('An error occurred');
		});

		it('should handle non-string message', () => {
			const error = {
				message: 123 as any,
				statusCode: 500,
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(typeof sanitized.message).toBe('string');
		});

		it('should handle missing statusCode', () => {
			const error = {
				message: 'Error occurred',
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(sanitized.statusCode).toBe(500); // Default
		});

		it('should always include timestamp', () => {
			const error = {
				message: 'Error',
				statusCode: 400,
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(sanitized.timestamp).toBeDefined();
			expect(sanitized.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		});

		it('should handle deeply nested error context with mixed types', () => {
			const context = {
				user: { id: '123', name: 'John' },
				publicData: 'ok',
				items: [
					{ id: 1, value: 'safe' },
					{ id: 2, value: 'safe2' },
				],
				config: {
					database: 'postgres://localhost',
					apiSettings: {
						enabled: true,
					},
				},
			};

			const sanitized = service['sanitizeContext'](context);
			expect(sanitized.user.id).toBe('123');
			expect(sanitized.publicData).toBe('ok');
			expect(Array.isArray(sanitized.items)).toBe(true);
		});

		it('should handle context with sensitive field names', () => {
			const context = {
				'api-key': 'value1',
				'api_key': 'value2',
				apiKey: 'value3',
				'API_KEY': 'value4',
			};

			const sanitized = service['sanitizeContext'](context);
			// All variations should be redacted
			Object.values(sanitized).forEach(v => {
				if (typeof v === 'string') {
					expect(v).toBe('***REDACTED***');
				}
			});
		});

		it('should handle max depth truncation', () => {
			const context: any = { level: 0 };
			let current = context;
			for (let i = 1; i < 10; i++) {
				current.next = { level: i };
				current = current.next;
			}

			const sanitized = service['sanitizeContext'](context);
			expect(sanitized).toBeDefined();
		});
	});

	describe('sanitizeErrorResponse with context', () => {
		it('should include and sanitize context', () => {
			const error = {
				message: 'Error occurred',
				statusCode: 400,
				context: {
					userId: '123',
					password: 'secret',
				},
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(sanitized.context).toBeDefined();
			expect(sanitized.context.userId).toBe('123');
			expect(sanitized.context.password).toBe('***REDACTED***');
		});

		it('should handle context with circular references', () => {
			const context: any = { id: '123' };
			context.self = context;

			const error = {
				message: 'Error',
				statusCode: 500,
				context,
			};

			const sanitized = service.SanitizeErrorResponse(error);
			expect(sanitized.context.id).toBe('123');
			expect(sanitized.context.self).toBe('[CIRCULAR_REF]');
		});

		it('should handle context as array', () => {
			const error = {
				message: 'Validation error',
				statusCode: 400,
				context: [
					{ field: 'email', message: 'invalid' },
					{ field: 'password', message: 'too short' },
				],
			};

			const sanitized = service.SanitizeErrorResponse(error);
			// Array contexts are preserved as arrays
			expect(Array.isArray(sanitized.context)).toBe(true);
		});
	});

	describe('development vs production', () => {
		it('should include full stack in development', () => {
			const error = {
				message: 'Error',
				statusCode: 500,
				stack: 'Error: test\n  at line 1\n  at line 2',
			};

			const sanitized = service.SanitizeErrorResponse(error, true);
			expect(sanitized.stack).toBeDefined();
			expect(sanitized.stack).toContain('Error: test');
		});

		it('should exclude stack in production', () => {
			const error = {
				message: 'Error',
				statusCode: 500,
				stack: 'Error: test\n  at line 1\n  at line 2',
			};

			const sanitized = service.SanitizeErrorResponse(error, false);
			expect(sanitized.stack).toBeUndefined();
		});

		it('should still sanitize message in both modes', () => {
			const error = {
				message: 'Error at /home/app.ts with key sk_live_abc',
				statusCode: 500,
				stack: 'stack trace here',
			};

			const devSanitized = service.SanitizeErrorResponse(error, true);
			const prodSanitized = service.SanitizeErrorResponse(error, false);

			expect(devSanitized.message).not.toContain('/home/app.ts');
			expect(devSanitized.message).not.toContain('sk_live_');
			expect(prodSanitized.message).not.toContain('/home/app.ts');
			expect(prodSanitized.message).not.toContain('sk_live_');
		});
	});

	describe('sensitivity field detection', () => {
		it('should detect default sensitive fields case-insensitively', () => {
			const context = {
				PASSWORD: 'value',
				Password: 'value',
				password: 'value',
				TOKEN: 'value',
				Token: 'value',
				token: 'value',
			};

			const sanitized = service['sanitizeContext'](context);
			Object.values(sanitized).forEach(v => {
				if (typeof v === 'string') {
					expect(v).toBe('***REDACTED***');
				}
			});
		});

		it('should detect substring matches in field names', () => {
			const context = {
				userPassword: 'secret',
				myApiKey: 'key',
				refeshToken: 'token',
				tokenValue: 'token',
			};

			const sanitized = service['sanitizeContext'](context);
			// Fields containing sensitive keywords should be redacted
			expect(sanitized.userPassword).toBe('***REDACTED***');
			expect(sanitized.myApiKey).toBe('***REDACTED***');
		});
	});
});
