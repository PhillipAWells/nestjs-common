import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLoggerService, IAuditLogEntry } from '../audit-logger.service.js';

describe('AuditLoggerService', () => {
	let service: AuditLoggerService;
	let logCalls: any[];
	let mockLogger: any;
	let mockModuleRef: any;

	beforeEach(() => {
		logCalls = [];
		mockLogger = {
			info(...args: any[]) {
				logCalls.push({ level: 'info', args });
			},
			Info(...args: any[]) {
				logCalls.push({ level: 'info', args });
			},
			warn(...args: any[]) {
				logCalls.push({ level: 'warn', args });
			},
			Warn(...args: any[]) {
				logCalls.push({ level: 'warn', args });
			},
			error(...args: any[]) {
				logCalls.push({ level: 'error', args });
			},
			Error(...args: any[]) {
				logCalls.push({ level: 'error', args });
			},
			debug(...args: any[]) {
				logCalls.push({ level: 'debug', args });
			},
			Debug(...args: any[]) {
				logCalls.push({ level: 'debug', args });
			},
			log(...args: any[]) {
				logCalls.push({ level: 'log', args });
			},
			Log(...args: any[]) {
				logCalls.push({ level: 'log', args });
			},
			createContextualLogger() {
				return mockLogger;
			},
			CreateContextualLogger() {
				return mockLogger;
			},
		};

		mockModuleRef = {
			get() {
				return mockLogger;
			},
		};

		service = new AuditLoggerService(mockModuleRef);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should implement ILazyModuleRefService', () => {
		expect(service.Module).toBeDefined();
		expect(service.Logger).toBeDefined();
	});

	describe('Authentication Logging', () => {
		it('should log successful authentication', () => {
			logCalls = [];

			service.LogAuthenticationAttempt('user@example.com', true, '192.168.1.1');

			expect(logCalls.length).toBeGreaterThan(0);
			// eslint-disable-next-line prefer-destructuring
			const call = logCalls[0];
			expect(call.level).toBe('info');
			expect(call.args[0]).toContain('SUCCESS');
		});

		it('should log failed authentication', () => {
			logCalls = [];

			service.LogAuthenticationAttempt('user@example.com', false, '192.168.1.1', 'Invalid password');

			expect(logCalls.length).toBeGreaterThan(0);
			// eslint-disable-next-line prefer-destructuring
			const call = logCalls[0];
			expect(call.level).toBe('info');
		});

		it('should include email in authentication log', () => {
			logCalls = [];

			service.LogAuthenticationAttempt('test@example.com', true);

			expect(logCalls[0].args[0]).toContain('test@example.com');
		});

		it('should include reason in failed authentication', () => {
			logCalls = [];

			service.LogAuthenticationAttempt('user@example.com', false, undefined, 'Account locked');

			expect(logCalls[0].args[0]).toContain('Account locked');
		});
	});

	describe('Authorization Logging', () => {
		it('should log authorization failure', () => {
			logCalls = [];

			service.LogAuthorizationFailure('user-123', '/admin/users', 'DELETE', '192.168.1.1');

			expect(logCalls.length).toBeGreaterThan(0);
			// eslint-disable-next-line prefer-destructuring
			const call = logCalls[0];
			expect(call.level).toBe('warn');
			expect(call.args[0]).toContain('Authorization FAILURE');
		});

		it('should include user ID in authorization log', () => {
			logCalls = [];

			service.LogAuthorizationFailure('user-456', '/api/data', 'WRITE');

			expect(logCalls[0].args[0]).toContain('user-456');
		});

		it('should include resource in authorization log', () => {
			logCalls = [];

			service.LogAuthorizationFailure('user-789', '/api/reports', 'READ');

			expect(logCalls[0].args[0]).toContain('/api/reports');
		});

		it('should include action in authorization log', () => {
			logCalls = [];

			service.LogAuthorizationFailure('user-123', '/admin', 'DELETE');

			expect(logCalls[0].args[0]).toContain('DELETE');
		});
	});

	describe('Token Logging', () => {
		it('should log token generation', () => {
			logCalls = [];

			service.LogTokenGeneration('user-123', 'access');

			expect(logCalls.length).toBeGreaterThan(0);
			expect(logCalls[0].args[0]).toContain('Token GENERATED');
		});

		it('should include token type in generation log', () => {
			logCalls = [];

			service.LogTokenGeneration('user-456', 'refresh');

			expect(logCalls[0].args[0]).toContain('refresh');
		});

		it('should log token revocation', () => {
			logCalls = [];

			service.LogTokenRevocation('user-789', 'IUser logout');

			expect(logCalls.length).toBeGreaterThan(0);
			expect(logCalls[0].args[0]).toContain('Token REVOCATION');
		});

		it('should include revocation reason', () => {
			logCalls = [];

			service.LogTokenRevocation('user-123', 'Password changed');

			expect(logCalls[0].args[0]).toContain('Password changed');
		});
	});

	describe('Rate Limit Logging', () => {
		it('should log rate limit violation', () => {
			logCalls = [];

			service.LogRateLimitViolation('/api/login', '192.168.1.100', 5);

			expect(logCalls.length).toBeGreaterThan(0);
			// eslint-disable-next-line prefer-destructuring
			const call = logCalls[0];
			expect(call.level).toBe('warn');
			expect(call.args[0]).toContain('Rate LIMIT VIOLATION');
		});

		it('should include endpoint in rate limit log', () => {
			logCalls = [];

			service.LogRateLimitViolation('/api/users', '203.0.113.50', 10);

			expect(logCalls[0].args[0]).toContain('/api/users');
		});

		it('should include IP in rate limit log', () => {
			logCalls = [];

			service.LogRateLimitViolation('/api/data', '10.0.0.5', 15);

			expect(logCalls[0].args[0]).toContain('10.0.0.5');
		});

		it('should include limit count in rate limit log', () => {
			logCalls = [];

			service.LogRateLimitViolation('/api/test', '127.0.0.1', 20);

			expect(logCalls[0].args[0]).toContain('20');
		});
	});

	describe('CSRF Violation Logging', () => {
		it('should log CSRF violation', () => {
			logCalls = [];

			service.LogCsrfViolation('192.168.1.50', '/api/data');

			expect(logCalls.length).toBeGreaterThan(0);
			// eslint-disable-next-line prefer-destructuring
			const call = logCalls[0];
			expect(call.level).toBe('warn');
			expect(call.args[0]).toContain('CSRF VIOLATION');
		});

		it('should include endpoint in CSRF log', () => {
			logCalls = [];

			service.LogCsrfViolation('192.168.1.50', '/admin');

			expect(logCalls[0].args[0]).toContain('/admin');
		});

		it('should include IP in CSRF log', () => {
			logCalls = [];

			service.LogCsrfViolation('10.0.0.100', '/api/endpoint');

			expect(logCalls[0].args[0]).toContain('10.0.0.100');
		});
	});

	describe('Configuration Change Logging', () => {
		it('should log configuration change', () => {
			logCalls = [];

			service.LogConfigurationChange('admin-user', 'api-key-rotation', 'disabled', 'enabled');

			expect(logCalls.length).toBeGreaterThan(0);
			expect(logCalls[0].args[0]).toContain('Configuration CHANGE');
		});

		it('should include config name in change log', () => {
			logCalls = [];

			service.LogConfigurationChange('user-789', 'timeout-value', '30', '60');

			expect(logCalls[0].args[0]).toContain('timeout-value');
		});

		it('should include user in config change log', () => {
			logCalls = [];

			service.LogConfigurationChange('admin-001', 'rate-limit', 100, 200);

			expect(logCalls[0].args[0]).toContain('admin-001');
		});

		it('should include values in config change log', () => {
			logCalls = [];

			service.LogConfigurationChange('admin', 'setting', 'oldVal', 'newVal');

			expect(logCalls[0].args[0]).toContain('oldVal');
			expect(logCalls[0].args[0]).toContain('newVal');
		});
	});

	describe('Data Access Logging', () => {
		it('should log data access', () => {
			logCalls = [];

			service.LogDataAccess('user-123', 'customer-records', 'READ');

			expect(logCalls.length).toBeGreaterThan(0);
			expect(logCalls[0].args[0]).toContain('Data ACCESS');
		});

		it('should include user in data access log', () => {
			logCalls = [];

			service.LogDataAccess('user-456', 'payment-data', 'WRITE');

			expect(logCalls[0].args[0]).toContain('user-456');
		});

		it('should include resource in data access log', () => {
			logCalls = [];

			service.LogDataAccess('user-789', 'audit-logs', 'DELETE');

			expect(logCalls[0].args[0]).toContain('audit-logs');
		});

		it('should include action in data access log', () => {
			logCalls = [];

			service.LogDataAccess('user-111', 'reports', 'EXPORT');

			expect(logCalls[0].args[0]).toContain('EXPORT');
		});
	});

	describe('Security Event Logging', () => {
		it('should log custom security event', () => {
			logCalls = [];

			const auditEntry: IAuditLogEntry = {
				timestamp: new Date(),
				userId: 'user-123',
				action: 'export-data',
				resource: '/reports/financial',
				result: 'success',
			};

			service.LogSecurityEvent(auditEntry);

			expect(logCalls.length).toBeGreaterThan(0);
			expect(logCalls[0].args[0]).toContain('Security EVENT');
		});

		it('should include action in security event', () => {
			logCalls = [];

			const auditEntry: IAuditLogEntry = {
				timestamp: new Date(),
				action: 'permission-change',
				resource: 'user-456',
				result: 'success',
			};

			service.LogSecurityEvent(auditEntry);

			expect(logCalls[0].args[0]).toContain('permission-change');
		});

		it('should include resource in security event', () => {
			logCalls = [];

			const auditEntry: IAuditLogEntry = {
				timestamp: new Date(),
				action: 'delete-user',
				resource: '/users/789',
				result: 'success',
			};

			service.LogSecurityEvent(auditEntry);

			expect(logCalls[0].args[0]).toContain('/users/789');
		});

		it('should include result in security event', () => {
			logCalls = [];

			const auditEntry: IAuditLogEntry = {
				timestamp: new Date(),
				action: 'login-attempt',
				resource: '/auth/login',
				result: 'failure',
			};

			service.LogSecurityEvent(auditEntry);

			expect(logCalls[0].args[0]).toContain('failure');
		});

		it('should handle optional fields in security event', () => {
			logCalls = [];

			const auditEntry: IAuditLogEntry = {
				timestamp: new Date(),
				action: 'system-check',
				resource: 'health-endpoint',
				result: 'success',
			};

			service.LogSecurityEvent(auditEntry);

			expect(logCalls.length).toBeGreaterThan(0);
		});
	});

	describe('Log Context', () => {
		it('should use AuditLogger context', () => {
			logCalls = [];

			service.LogAuthenticationAttempt('user@example.com', true);

			expect(logCalls[0].args[1]).toBe('AuditLogger');
		});

		it('should consistently use AuditLogger context across methods', () => {
			logCalls = [];

			service.LogAuthenticationAttempt('user@example.com', true);
			service.LogAuthorizationFailure('user-2', '/api', 'READ');

			expect(logCalls[0].args[1]).toBe('AuditLogger');
			expect(logCalls[1].args[1]).toBe('AuditLogger');
		});
	});

	describe('Timestamp Handling', () => {
		it('should include timestamp in audit logs', () => {
			logCalls = [];

			service.LogAuthenticationAttempt('user@example.com', true);

			// eslint-disable-next-line prefer-destructuring
			const logMessage = logCalls[0].args[0];
			expect(logMessage).toContain(new Date().getFullYear().toString());
		});

		it('should use ISO timestamp format', () => {
			logCalls = [];

			service.LogTokenGeneration('user-123', 'access');

			// eslint-disable-next-line prefer-destructuring
			const logMessage = logCalls[0].args[0];
			// Timestamp should match ISO date pattern
			expect(logMessage).toMatch(/\d{4}-\d{2}-\d{2}/);
		});
	});
});
