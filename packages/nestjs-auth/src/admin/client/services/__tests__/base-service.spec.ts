import { describe, it, expect, beforeEach, vi } from 'vitest';
import type KcAdminClient from '@keycloak/keycloak-admin-client';
import { Logger } from '@nestjs/common';
import { BaseService } from '../base-service.js';
import { KeycloakAdminScopeError } from '../../../permissions/keycloak-admin.permissions.js';
import type { KeycloakAdminScope } from '../../../permissions/keycloak-admin.permissions.js';
import {
	KeycloakClientError,
	AuthenticationError,
	AuthorizationError,
	NotFoundError,
	ValidationError,
	TimeoutError,
	NetworkError,
} from '../../errors/index.js';

/**
 * Concrete test subclass of BaseService that exposes requireScope and handleError for testing
 */
class TestService extends BaseService {
	public testRequireScope(scope: KeycloakAdminScope): void {
		this.requireScope(scope);
	}

	public testHandleError(error: unknown): never {
		return this.handleError(error);
	}
}

describe('BaseService', () => {
	let service: TestService;
	let mockAdminClient: Partial<KcAdminClient>;
	let grantedScopes: Set<KeycloakAdminScope>;

	beforeEach(() => {
		mockAdminClient = {};
		grantedScopes = new Set(['users:read', 'users:write']);
		service = new TestService(
			mockAdminClient as KcAdminClient,
			grantedScopes as ReadonlySet<KeycloakAdminScope>,
		);

		// Spy on the logger to verify calls
		vi.spyOn(Logger.prototype, 'warn');
		vi.spyOn(Logger.prototype, 'log');
	});

	describe('requireScope', () => {
		it('should pass when scope is granted', () => {
			expect(() => {
				service.testRequireScope('users:read');
			}).not.toThrow();
		});

		it('should throw KeycloakAdminScopeError when scope is not granted', () => {
			expect(() => {
				service.testRequireScope('clients:write');
			}).toThrow(KeycloakAdminScopeError);
		});

		it('should expose the scope property on the thrown error', () => {
			try {
				service.testRequireScope('roles:write');
				expect.fail('Should have thrown');
			} catch (error) {
				expect(error).toBeInstanceOf(KeycloakAdminScopeError);
				expect((error as KeycloakAdminScopeError).scope).toBe('roles:write');
			}
		});

		it('should log a warning when scope check fails', () => {
			const warnSpy = vi.spyOn(Logger.prototype, 'warn');
			try {
				service.testRequireScope('roles:write');
			} catch {
				// Expected
			}
			expect(warnSpy).toHaveBeenCalled();
		});

		it('should log an audit message for write scopes', () => {
			const logSpy = vi.spyOn(Logger.prototype, 'log');
			service.testRequireScope('users:write');
			expect(logSpy).toHaveBeenCalledWith(
				expect.stringContaining('Keycloak admin mutation'),
				expect.any(Object),
			);
		});

		it('should not log an audit message for read scopes', () => {
			const logSpy = vi.spyOn(Logger.prototype, 'log');
			logSpy.mockClear();
			service.testRequireScope('users:read');
			// Read scope check should not log
			expect(logSpy).not.toHaveBeenCalledWith(
				expect.stringContaining('Keycloak admin mutation'),
				expect.any(Object),
			);
		});
	});

	describe('handleError', () => {
		it('should re-throw KeycloakAdminScopeError without wrapping', () => {
			const error = new KeycloakAdminScopeError('users:write');
			expect(() => {
				service.testHandleError(error);
			}).toThrow(KeycloakAdminScopeError);
		});

		it('should re-throw KeycloakClientError without wrapping', () => {
			const error = new KeycloakClientError('test error', 500);
			expect(() => {
				service.testHandleError(error);
			}).toThrow(KeycloakClientError);
		});

		it('should throw AuthenticationError on 401 status', () => {
			const error = { response: { status: 401 }, message: 'Unauthorized' };
			expect(() => {
				service.testHandleError(error);
			}).toThrow(AuthenticationError);
		});

		it('should throw AuthorizationError on 403 status', () => {
			const error = { response: { status: 403 }, message: 'Forbidden' };
			expect(() => {
				service.testHandleError(error);
			}).toThrow(AuthorizationError);
		});

		it('should throw NotFoundError on 404 status', () => {
			const error = { response: { status: 404 }, message: 'Not Found' };
			expect(() => {
				service.testHandleError(error);
			}).toThrow(NotFoundError);
		});

		it('should throw ValidationError on 400 status', () => {
			const error = { response: { status: 400 }, message: 'Bad Request' };
			expect(() => {
				service.testHandleError(error);
			}).toThrow(ValidationError);
		});

		it('should throw TimeoutError on 408 status', () => {
			const error = { response: { status: 408 }, message: 'Request Timeout' };
			expect(() => {
				service.testHandleError(error);
			}).toThrow(TimeoutError);
		});

		it('should throw NetworkError on ECONNREFUSED code', () => {
			const error = { response: {}, code: 'ECONNREFUSED', message: 'ECONNREFUSED' };
			expect(() => {
				service.testHandleError(error);
			}).toThrow(NetworkError);
		});

		it('should throw NetworkError on ETIMEDOUT code', () => {
			const error = { response: {}, code: 'ETIMEDOUT', message: 'ETIMEDOUT' };
			expect(() => {
				service.testHandleError(error);
			}).toThrow(NetworkError);
		});

		it('should throw KeycloakClientError with status code for unknown status', () => {
			const error = { response: { status: 500 }, message: 'Server Error' };
			expect(() => {
				service.testHandleError(error);
			}).toThrow(KeycloakClientError);
		});

		it('should throw KeycloakClientError for generic errors', () => {
			const error = new Error('Generic error');
			expect(() => {
				service.testHandleError(error);
			}).toThrow(KeycloakClientError);
		});

		it('should wrap string errors as KeycloakClientError', () => {
			expect(() => {
				service.testHandleError('string error');
			}).toThrow(KeycloakClientError);
		});

		it('should include response data in thrown error', () => {
			const data = { error: 'details' };
			const error = { response: { status: 400, data }, message: 'Bad Request' };
			try {
				service.testHandleError(error);
				expect.fail('Should have thrown');
			} catch (e) {
				expect(e).toBeInstanceOf(ValidationError);
				expect((e as ValidationError).response).toEqual(data);
			}
		});

		it('should preserve cause for Error objects', () => {
			const cause = new Error('Original error');
			const error = cause;
			try {
				service.testHandleError(error);
				expect.fail('Should have thrown');
			} catch (e) {
				expect(e).toBeInstanceOf(KeycloakClientError);
				expect((e as KeycloakClientError).cause).toBe(cause);
			}
		});

		it('should use default message when response message is missing', () => {
			const error = { response: { status: 500 } };
			try {
				service.testHandleError(error);
				expect.fail('Should have thrown');
			} catch (e) {
				expect(e).toBeInstanceOf(KeycloakClientError);
				expect((e as KeycloakClientError).message).toBe('Unknown error');
			}
		});

		it('should throw KeycloakClientError if error object has no response', () => {
			const error = { code: 'UNKNOWN_ERROR' };
			expect(() => {
				service.testHandleError(error);
			}).toThrow(KeycloakClientError);
		});
	});
});
