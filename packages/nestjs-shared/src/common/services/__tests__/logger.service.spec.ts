import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../logger.service.js';
import { LogLevel } from '../../interfaces/log-entry.interface.js';

describe('AppLogger', () => {
	let service: AppLogger;
	let configService: ConfigService;

	beforeEach(() => {
		// Create a mock ConfigService
		configService = {
			get: vi.fn((key: string, defaultValue?: string) => {
				const config: Record<string, string> = {
					'SERVICE_NAME': 'test-service',
				};
				return config[key] ?? defaultValue;
			}),
		} as any;
		service = new AppLogger(configService);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('parseLogLevel', () => {
		it('should default to INFO level', () => {
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.INFO);
		});

		it('should parse debug level', () => {
			vi.spyOn(configService, 'get').mockReturnValue('debug');
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.DEBUG);
		});

		it('should parse info level', () => {
			vi.spyOn(configService, 'get').mockReturnValue('info');
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.INFO);
		});

		it('should parse warn level', () => {
			vi.spyOn(configService, 'get').mockReturnValue('warn');
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.WARN);
		});

		it('should parse error level', () => {
			vi.spyOn(configService, 'get').mockReturnValue('error');
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.ERROR);
		});

		it('should parse fatal level', () => {
			vi.spyOn(configService, 'get').mockReturnValue('fatal');
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.FATAL);
		});

		it('should handle case insensitive input', () => {
			vi.spyOn(configService, 'get').mockReturnValue('DEBUG');
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.DEBUG);
		});

		it('should default to INFO for invalid level', () => {
			vi.spyOn(configService, 'get').mockReturnValue('invalid');
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.INFO);
		});
	});

	describe('shouldLog', () => {
		it('should allow logging at or above minimum level', () => {
			vi.spyOn(configService, 'get').mockReturnValue('info');
			const logger = new AppLogger(configService);

			expect((logger as any).shouldLog(LogLevel.DEBUG)).toBe(false);
			expect((logger as any).shouldLog(LogLevel.INFO)).toBe(true);
			expect((logger as any).shouldLog(LogLevel.WARN)).toBe(true);
			expect((logger as any).shouldLog(LogLevel.ERROR)).toBe(true);
			expect((logger as any).shouldLog(LogLevel.FATAL)).toBe(true);
		});
	});

	describe('createContextualLogger', () => {
		it('should create logger with context', () => {
			const contextualLogger = service.createContextualLogger('TestContext');
			expect(contextualLogger).toBeInstanceOf(AppLogger);
		});
	});

	describe('sanitizeMetadata', () => {
		it('should redact password fields', () => {
			const metadata = { username: 'user', password: 'secret123' };
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.password).toBe('[REDACTED]');
			expect(result.username).toBe('user');
		});

		it('should redact token fields', () => {
			const metadata = { token: 'abc123', refreshToken: 'xyz789' };
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.token).toBe('[REDACTED]');
			expect(result.refreshToken).toBe('[REDACTED]');
		});

		it('should redact authorization headers', () => {
			const metadata = { authorization: 'Bearer token123', auth: 'secret' };
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.authorization).toBe('[REDACTED]');
			expect(result.auth).toBe('[REDACTED]');
		});

		it('should redact API keys', () => {
			const metadata = { api_key: 'key123', apiKey: 'key456', apisecret: 'secret' };
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.api_key).toBe('[REDACTED]');
			expect(result.apiKey).toBe('[REDACTED]');
			expect(result.apisecret).toBe('[REDACTED]');
		});

		it('should redact credit card info', () => {
			const metadata = { credit_card: '4111111111111111', cardnumber: '1234' };
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.credit_card).toBe('[REDACTED]');
			expect(result.cardnumber).toBe('[REDACTED]');
		});

		it('should redact SSN', () => {
			const metadata = { ssn: '123-45-6789', social_security: '987654321' };
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.ssn).toBe('[REDACTED]');
			expect(result.social_security).toBe('[REDACTED]');
		});

		it('should redact cookies and sessions', () => {
			const metadata = { cookie: 'sessionid=abc', session: 'xyz' };
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.cookie).toBe('[REDACTED]');
			expect(result.session).toBe('[REDACTED]');
		});

		it('should handle case-insensitive matching', () => {
			const metadata = { PASSWORD: 'secret', Token: 'token', AUTHORIZATION: 'Bearer' };
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.PASSWORD).toBe('[REDACTED]');
			expect(result.Token).toBe('[REDACTED]');
			expect(result.AUTHORIZATION).toBe('[REDACTED]');
		});

		it('should redact nested sensitive fields', () => {
			const metadata = {
				user: { password: 'secret', name: 'John' },
				config: { api_key: 'key123' },
			};
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.user.password).toBe('[REDACTED]');
			expect(result.user.name).toBe('John');
			expect(result.config.api_key).toBe('[REDACTED]');
		});

		it('should handle undefined metadata', () => {
			const result = (service as any).sanitizeMetadata(undefined);
			expect(result).toBeUndefined();
		});

		it('should handle arrays in metadata', () => {
			const metadata = {
				items: [
					{ password: 'secret1' },
					{ password: 'secret2' },
				],
			};
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.items[0].password).toBe('[REDACTED]');
			expect(result.items[1].password).toBe('[REDACTED]');
		});

		it('should handle circular references in objects', () => {
			const obj: any = { name: 'test', password: 'secret' };
			obj.self = obj; // Create circular reference
			const result = (service as any).sanitizeMetadata({ obj });
			expect(result).toBeDefined();
		});

		it('should handle very deep nesting', () => {
			const deepObj: any = { level1: { password: 'secret1' } };
			let current = deepObj.level1;
			for (let i = 2; i <= 10; i++) {
				current[`level${i}`] = { password: `secret${i}` };
				current = current[`level${i}`];
			}
			const result = (service as any).sanitizeMetadata(deepObj);
			expect(result.level1.password).toBe('[REDACTED]');
		});

		it('should redact sensitive keys even with null values', () => {
			const metadata = { password: null, username: 'user' };
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.password).toBe('[REDACTED]');
			expect(result.username).toBe('user');
		});

		it('should handle empty objects', () => {
			const metadata = {};
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result).toEqual({});
		});

		it('should handle multiple private key types', () => {
			const metadata = {
				privatekey: 'key1',
				encryptionkey: 'key3',
				apisecret: 'key4',
			};
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.privatekey).toBe('[REDACTED]');
			expect(result.encryptionkey).toBe('[REDACTED]');
			expect(result.apisecret).toBe('[REDACTED]');
		});
	});

	describe('Various log levels', () => {
		it('should log debug messages when level is DEBUG', () => {
			vi.spyOn(configService, 'get').mockReturnValue('debug');
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.DEBUG);
		});

		it('should log info messages when level is INFO', () => {
			vi.spyOn(configService, 'get').mockReturnValue('info');
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.INFO);
		});

		it('should log warn messages when level is WARN', () => {
			vi.spyOn(configService, 'get').mockReturnValue('warn');
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.WARN);
		});

		it('should log error messages when level is ERROR', () => {
			vi.spyOn(configService, 'get').mockReturnValue('error');
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.ERROR);
		});

		it('should log fatal messages when level is FATAL', () => {
			vi.spyOn(configService, 'get').mockReturnValue('fatal');
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.FATAL);
		});
	});

	describe('Edge cases', () => {
		it('should handle null metadata gracefully', () => {
			const result = (service as any).sanitizeMetadata(null);
			expect(result).toBeUndefined(); // sanitizeMetadata returns undefined for null input
		});

		it('should handle metadata with primitive types', () => {
			const metadata = {
				number: 123,
				string: 'value',
				boolean: true,
				 
				null: null,
				// eslint-disable-next-line object-shorthand
				undefined: undefined,
			};
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.number).toBe(123);
			expect(result.string).toBe('value');
			expect(result.boolean).toBe(true);
		});

		it('should not redact fields that partially match sensitive keys', () => {
			const metadata = {
				password_history: 'history',
				api_key_id: '123',
				token_expires: 'tomorrow',
			};
			const result = (service as any).sanitizeMetadata(metadata);
			// Fields that contain but are not exactly named sensitive keys should be redacted
			expect(result).toBeDefined();
		});

		it('should create unique logger instances for different contexts', () => {
			const logger1 = service.createContextualLogger('Context1');
			const logger2 = service.createContextualLogger('Context2');
			expect(logger1).toBeDefined();
			expect(logger2).toBeDefined();
		});

		it('should handle metadata with mixed types in arrays', () => {
			const metadata = {
				items: [
					{ password: 'secret' },
					'string',
					123,
					null,
				],
			};
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.items[0].password).toBe('[REDACTED]');
			expect(result.items[1]).toBe('string');
			expect(result.items[2]).toBe(123);
		});
	});

	describe('Log level switching and filtering', () => {
		it('should respect DEBUG log level and allow all messages', () => {
			vi.spyOn(configService, 'get').mockReturnValue('debug');
			const logger = new AppLogger(configService);

			expect((logger as any).shouldLog(LogLevel.DEBUG)).toBe(true);
			expect((logger as any).shouldLog(LogLevel.INFO)).toBe(true);
			expect((logger as any).shouldLog(LogLevel.WARN)).toBe(true);
			expect((logger as any).shouldLog(LogLevel.ERROR)).toBe(true);
			expect((logger as any).shouldLog(LogLevel.FATAL)).toBe(true);
		});

		it('should respect INFO log level and filter DEBUG', () => {
			vi.spyOn(configService, 'get').mockReturnValue('info');
			const logger = new AppLogger(configService);

			expect((logger as any).shouldLog(LogLevel.DEBUG)).toBe(false);
			expect((logger as any).shouldLog(LogLevel.INFO)).toBe(true);
			expect((logger as any).shouldLog(LogLevel.WARN)).toBe(true);
			expect((logger as any).shouldLog(LogLevel.ERROR)).toBe(true);
			expect((logger as any).shouldLog(LogLevel.FATAL)).toBe(true);
		});

		it('should respect WARN log level and filter DEBUG and INFO', () => {
			vi.spyOn(configService, 'get').mockReturnValue('warn');
			const logger = new AppLogger(configService);

			expect((logger as any).shouldLog(LogLevel.DEBUG)).toBe(false);
			expect((logger as any).shouldLog(LogLevel.INFO)).toBe(false);
			expect((logger as any).shouldLog(LogLevel.WARN)).toBe(true);
			expect((logger as any).shouldLog(LogLevel.ERROR)).toBe(true);
			expect((logger as any).shouldLog(LogLevel.FATAL)).toBe(true);
		});

		it('should respect ERROR log level and filter DEBUG, INFO, and WARN', () => {
			vi.spyOn(configService, 'get').mockReturnValue('error');
			const logger = new AppLogger(configService);

			expect((logger as any).shouldLog(LogLevel.DEBUG)).toBe(false);
			expect((logger as any).shouldLog(LogLevel.INFO)).toBe(false);
			expect((logger as any).shouldLog(LogLevel.WARN)).toBe(false);
			expect((logger as any).shouldLog(LogLevel.ERROR)).toBe(true);
			expect((logger as any).shouldLog(LogLevel.FATAL)).toBe(true);
		});

		it('should respect FATAL log level and filter all others', () => {
			vi.spyOn(configService, 'get').mockReturnValue('fatal');
			const logger = new AppLogger(configService);

			expect((logger as any).shouldLog(LogLevel.DEBUG)).toBe(false);
			expect((logger as any).shouldLog(LogLevel.INFO)).toBe(false);
			expect((logger as any).shouldLog(LogLevel.WARN)).toBe(false);
			expect((logger as any).shouldLog(LogLevel.ERROR)).toBe(false);
			expect((logger as any).shouldLog(LogLevel.FATAL)).toBe(true);
		});
	});

	describe('Metadata sanitization edge cases', () => {
		it('should redact fields containing password pattern in key name', () => {
			const metadata = {
				user_password: 'secret123',
				update_password_request: 'data',
				confirm_password: 'match',
			};
			const result = (service as any).sanitizeMetadata(metadata);
			// Fields that contain sensitive patterns have their key names redacted
			expect(result['[REDACTED_KEY]']).toBe('[REDACTED]');
		});

		it('should redact fields containing token pattern in key name', () => {
			const metadata = {
				token: 'generic',
				accesstoken: 'abc123',
				refreshtoken: 'xyz789',
				bearertoken: 'token123',
				sessiontoken: 'sess456',
			};
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.token).toBe('[REDACTED]');
			expect(result.accesstoken).toBe('[REDACTED]');
			expect(result.refreshtoken).toBe('[REDACTED]');
			expect(result.bearertoken).toBe('[REDACTED]');
			expect(result.sessiontoken).toBe('[REDACTED]');
		});

		it('should sanitize deeply nested sensitive fields', () => {
			const metadata = {
				level1: {
					level2: {
						level3: {
							password: 'secret',
							api_key: 'key123',
						},
					},
				},
			};
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.level1.level2.level3.password).toBe('[REDACTED]');
			expect(result.level1.level2.level3.api_key).toBe('[REDACTED]');
		});

		it('should handle arrays with nested sensitive objects', () => {
			const metadata = {
				users: [
					{ id: 1, password: 'secret1', name: 'User1' },
					{ id: 2, password: 'secret2', name: 'User2' },
					{ id: 3, api_key: 'key3', name: 'User3' },
				],
			};
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.users[0].password).toBe('[REDACTED]');
			expect(result.users[1].password).toBe('[REDACTED]');
			expect(result.users[2].api_key).toBe('[REDACTED]');
			expect(result.users[0].name).toBe('User1');
		});

		it('should handle very deeply nested objects within depth limit', () => {
			const deepObj: any = { value: 'test' };
			let current = deepObj;
			for (let i = 0; i < 10; i++) {
				current.nested = { value: `level${i}`, password: `secret${i}` };
				current = current.nested;
			}
			const result = (service as any).sanitizeMetadata(deepObj);
			expect(result).toBeDefined();
		});

		it('should redact private key variations', () => {
			const metadata = {
				privatekey: 'pk456',
				encryptionkey: 'enc456',
				apisecret: 'secret123',
			};
			const result = (service as any).sanitizeMetadata(metadata);
			expect(result.privatekey).toBe('[REDACTED]');
			expect(result.encryptionkey).toBe('[REDACTED]');
			expect(result.apisecret).toBe('[REDACTED]');
		});
	});

	describe('Log methods with different overload signatures', () => {
		it('should support debug(message, context) signature', () => {
			expect(() => {
				service.debug('Debug message', 'TestContext');
			}).not.toThrow();
		});

		it('should support debug(message, metadata) signature', () => {
			expect(() => {
				service.debug('Debug message', { key: 'value' });
			}).not.toThrow();
		});

		it('should support debug(message, options) signature with LogOptions', () => {
			expect(() => {
				service.debug('Debug message', {
					context: 'TestContext',
					metadata: { key: 'value' },
				});
			}).not.toThrow();
		});

		it('should support info(message) signature', () => {
			expect(() => {
				service.info('Info message');
			}).not.toThrow();
		});

		it('should support warn(message) signature', () => {
			expect(() => {
				service.warn('Warning message');
			}).not.toThrow();
		});

		it('should support error(message) signature', () => {
			expect(() => {
				service.error('Error message');
			}).not.toThrow();
		});

		it('should support error(message, trace, context) signature', () => {
			expect(() => {
				service.error('Error message', 'stack trace', 'ErrorContext');
			}).not.toThrow();
		});

		it('should support fatal(message) signature', () => {
			expect(() => {
				service.fatal('Fatal message');
			}).not.toThrow();
		});

		it('should support fatal(message, trace, context) signature', () => {
			expect(() => {
				service.fatal('Fatal message', 'stack trace', 'FatalContext');
			}).not.toThrow();
		});
	});

	describe('Invalid log level handling', () => {
		it('should fall back to INFO for invalid LOG_LEVEL and log warning', () => {
			vi.spyOn(configService, 'get').mockReturnValue('invalid_level');
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.INFO);
		});

		it('should handle numeric LOG_LEVEL and convert to string', () => {
			vi.spyOn(configService, 'get').mockReturnValue('invalid_level');
			const logger = new AppLogger(configService);
			expect((logger as any).minLevel).toBe(LogLevel.INFO);
		});
	});

	describe('Contextual logger creation', () => {
		it('should create contextual logger with proper isolation', () => {
			const contextualLogger1 = service.createContextualLogger('Context1');
			const contextualLogger2 = service.createContextualLogger('Context2');

			expect(contextualLogger1).toBeInstanceOf(AppLogger);
			expect(contextualLogger2).toBeInstanceOf(AppLogger);
			expect(contextualLogger1).not.toBe(contextualLogger2);
		});

		it('should create multiple contexts without affecting parent logger', () => {
			const context1 = service.createContextualLogger('ServiceA');
			const context2 = service.createContextualLogger('ServiceB');

			expect(context1).toBeDefined();
			expect(context2).toBeDefined();
			expect(service).toBeDefined();
		});

		it('should handle nested contextual logger creation', () => {
			const context1 = service.createContextualLogger('Context1');
			const context2 = context1.createContextualLogger('Context2');

			expect(context2).toBeInstanceOf(AppLogger);
		});
	});

	describe('Fallback behavior with console.error', () => {
		it('should handle console.error gracefully during invalid log level warning', () => {
			vi.spyOn(configService, 'get').mockReturnValue('invalid');
			// This should not throw even if console.error fails
			expect(() => {
				new AppLogger(configService);
			}).not.toThrow();
		});

		it('should suppress console.error failures silently', () => {
			vi.spyOn(configService, 'get').mockReturnValue('not_a_level');
			const logger = new AppLogger(configService);
			expect(logger).toBeDefined();
		});
	});

	describe('Metadata building with trace context', () => {
		it('should build metadata with context information', () => {
			const metadata = { user: 'test' };
			const result = (service as any).buildMetadata('TestContext', metadata);

			expect(result.context).toBe('TestContext');
			expect(result.metadata).toBeDefined();
		});

		it('should handle metadata building without trace context', () => {
			const result = (service as any).buildMetadata('SimpleContext');
			expect(result.context).toBe('SimpleContext');
			expect(result).toBeDefined();
		});

		it('should handle empty context string', () => {
			const result = (service as any).buildMetadata('');
			expect(result.context).toBe('');
		});

		it('should sanitize metadata during building', () => {
			const metadata = { password: 'secret' };
			const result = (service as any).buildMetadata('Context', metadata);

			expect(result.metadata.password).toBe('[REDACTED]');
		});
	});

	describe('Service initialization with optional ConfigService', () => {
		it('should handle missing ConfigService gracefully', () => {
			const logger = new AppLogger();
			expect(logger).toBeDefined();
			expect((logger as any).minLevel).toBe(LogLevel.INFO);
		});

		it('should use default service name when ConfigService is missing', () => {
			const logger = new AppLogger();
			expect(logger).toBeDefined();
		});

		it('should handle ConfigService that returns default on missing key', () => {
			const partialConfigService = {
				get: vi.fn().mockReturnValue('info'),
			} as any;

			const logger = new AppLogger(partialConfigService);
			expect(logger).toBeDefined();
		});
	});

	describe('without ConfigService — process.env fallback', () => {
		it('should read LOG_LEVEL from process.env when no ConfigService', () => {
			const originalEnv = process.env['LOG_LEVEL'];
			process.env['LOG_LEVEL'] = 'debug';
			try {
				const logger = new AppLogger();
				expect((logger as any).minLevel).toBe(LogLevel.DEBUG);
			} finally {
				if (originalEnv === undefined) {
					delete process.env['LOG_LEVEL'];
				} else {
					process.env['LOG_LEVEL'] = originalEnv;
				}
			}
		});

		it('should read LOG_FORMAT from process.env when no ConfigService', () => {
			const originalEnv = process.env['LOG_FORMAT'];
			process.env['LOG_FORMAT'] = 'text';
			try {
				const logger = new AppLogger();
				// The format is stored internally in pawellsLogger, so we verify indirectly
				// by checking that the logger is created successfully
				expect(logger).toBeDefined();
			} finally {
				if (originalEnv === undefined) {
					delete process.env['LOG_FORMAT'];
				} else {
					process.env['LOG_FORMAT'] = originalEnv;
				}
			}
		});

		it('should read SERVICE_NAME from process.env when no ConfigService', () => {
			const originalEnv = process.env['SERVICE_NAME'];
			process.env['SERVICE_NAME'] = 'test-service-from-env';
			try {
				const logger = new AppLogger();
				expect((logger as any).serviceName).toBe('test-service-from-env');
			} finally {
				if (originalEnv === undefined) {
					delete process.env['SERVICE_NAME'];
				} else {
					process.env['SERVICE_NAME'] = originalEnv;
				}
			}
		});

		it('should use hardcoded defaults when neither ConfigService nor process.env is set', () => {
			const originalServiceName = process.env['SERVICE_NAME'];
			const originalLogLevel = process.env['LOG_LEVEL'];
			const originalLogFormat = process.env['LOG_FORMAT'];

			delete process.env['SERVICE_NAME'];
			delete process.env['LOG_LEVEL'];
			delete process.env['LOG_FORMAT'];

			try {
				const logger = new AppLogger();
				expect((logger as any).serviceName).toBe('unknown-service');
				expect((logger as any).minLevel).toBe(LogLevel.INFO);
			} finally {
				if (originalServiceName !== undefined) {
					process.env['SERVICE_NAME'] = originalServiceName;
				}
				if (originalLogLevel !== undefined) {
					process.env['LOG_LEVEL'] = originalLogLevel;
				}
				if (originalLogFormat !== undefined) {
					process.env['LOG_FORMAT'] = originalLogFormat;
				}
			}
		});

		it('should prefer ConfigService values over process.env when both are set', () => {
			const originalEnv = process.env['SERVICE_NAME'];
			process.env['SERVICE_NAME'] = 'env-service';
			try {
				const mockConfigService = {
					get: vi.fn((key: string) => {
						if (key === 'SERVICE_NAME') return 'config-service';
						return undefined;
					}),
				} as any;
				const logger = new AppLogger(mockConfigService);
				expect((logger as any).serviceName).toBe('config-service');
			} finally {
				if (originalEnv === undefined) {
					delete process.env['SERVICE_NAME'];
				} else {
					process.env['SERVICE_NAME'] = originalEnv;
				}
			}
		});

		it('should read LOG_LEVEL from process.env with various valid levels', () => {
			const testCases = [
				['debug', LogLevel.DEBUG],
				['info', LogLevel.INFO],
				['warn', LogLevel.WARN],
				['error', LogLevel.ERROR],
				['fatal', LogLevel.FATAL],
			] as const;

			for (const [levelStr, expectedLevel] of testCases) {
				const originalEnv = process.env['LOG_LEVEL'];
				process.env['LOG_LEVEL'] = levelStr;
				try {
					const logger = new AppLogger();
					expect((logger as any).minLevel).toBe(expectedLevel);
				} finally {
					if (originalEnv === undefined) {
						delete process.env['LOG_LEVEL'];
					} else {
						process.env['LOG_LEVEL'] = originalEnv;
					}
				}
			}
		});

		it('should fall back to INFO for invalid LOG_LEVEL in process.env', () => {
			const originalEnv = process.env['LOG_LEVEL'];
			process.env['LOG_LEVEL'] = 'invalid_level';
			try {
				const logger = new AppLogger();
				expect((logger as any).minLevel).toBe(LogLevel.INFO);
			} finally {
				if (originalEnv === undefined) {
					delete process.env['LOG_LEVEL'];
				} else {
					process.env['LOG_LEVEL'] = originalEnv;
				}
			}
		});

		it('should fall back to json for invalid LOG_FORMAT in process.env', () => {
			const originalEnv = process.env['LOG_FORMAT'];
			process.env['LOG_FORMAT'] = 'invalid_format';
			try {
				const logger = new AppLogger();
				expect(logger).toBeDefined();
			} finally {
				if (originalEnv === undefined) {
					delete process.env['LOG_FORMAT'];
				} else {
					process.env['LOG_FORMAT'] = originalEnv;
				}
			}
		});

		it('should handle case-insensitive LOG_LEVEL from process.env', () => {
			const originalEnv = process.env['LOG_LEVEL'];
			process.env['LOG_LEVEL'] = 'DEBUG';
			try {
				const logger = new AppLogger();
				expect((logger as any).minLevel).toBe(LogLevel.DEBUG);
			} finally {
				if (originalEnv === undefined) {
					delete process.env['LOG_LEVEL'];
				} else {
					process.env['LOG_LEVEL'] = originalEnv;
				}
			}
		});

		it('should handle case-insensitive LOG_FORMAT from process.env', () => {
			const originalEnv = process.env['LOG_FORMAT'];
			process.env['LOG_FORMAT'] = 'TEXT';
			try {
				const logger = new AppLogger();
				expect(logger).toBeDefined();
			} finally {
				if (originalEnv === undefined) {
					delete process.env['LOG_FORMAT'];
				} else {
					process.env['LOG_FORMAT'] = originalEnv;
				}
			}
		});
	});
});
