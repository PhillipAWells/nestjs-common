import { AuditLoggerService } from '../audit-logger.service.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { ModuleRef } from '@nestjs/core';

describe('AuditLoggerService', () => {
	let service: AuditLoggerService;
	let mockLogger: any;
	let mockModuleRef: any;

	beforeEach(() => {
		mockLogger = {
			info() {},
			warn() {},
			error() {},
			createContextualLogger() {
				return mockLogger;
			},
		};

		mockModuleRef = {
			get: () => mockLogger,
		};

		service = new AuditLoggerService(mockModuleRef as ModuleRef);
	});

	describe('logAuthenticationAttempt', () => {
		it('should log successful authentication', () => {
			const calls: any[] = [];
			mockLogger.info = function(...args: any[]) {
				calls.push(args);
			};

			service.logAuthenticationAttempt('test@example.com', true, '192.168.1.1');

			expect(calls.length).toBeGreaterThan(0);
			expect(calls[0][0]).toContain('Authentication SUCCESS');
		});

		it('should log failed authentication', () => {
			const calls: any[] = [];
			mockLogger.info = function(...args: any[]) {
				calls.push(args);
			};

			service.logAuthenticationAttempt('test@example.com', false, '192.168.1.1', 'Invalid credentials');

			expect(calls.length).toBeGreaterThan(0);
			expect(calls[0][0]).toContain('Authentication FAILURE');
		});
	});

	describe('logTokenRevocation', () => {
		it('should log token revocation', () => {
			const calls: any[] = [];
			mockLogger.info = function(...args: any[]) {
				calls.push(args);
			};

			service.logTokenRevocation('user-123', 'User logout');

			expect(calls.length).toBeGreaterThan(0);
			expect(calls[0][0]).toContain('Token REVOCATION');
		});
	});

	describe('logCsrfViolation', () => {
		it('should log CSRF violation', () => {
			const calls: any[] = [];
			mockLogger.warn = function(...args: any[]) {
				calls.push(args);
			};

			service.logCsrfViolation('192.168.1.1', '/api/login');

			expect(calls.length).toBeGreaterThan(0);
			expect(calls[0][0]).toContain('CSRF VIOLATION');
		});
	});
});
