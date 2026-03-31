import { describe, it, expect, beforeEach, vi } from 'vitest';
import type KcAdminClient from '@keycloak/keycloak-admin-client';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { BaseService } from '../base-service.js';
import { KeycloakAdminScopeError } from '../../../permissions/keycloak-admin.permissions.js';
import type { TKeycloakAdminScope } from '../../../permissions/keycloak-admin.permissions.js';
import {
	KeycloakClientError,
	AuthenticationError,
	AuthorizationError,
	NotFoundError,
	IValidationError,
	TimeoutError,
	NetworkError,
} from '../../errors/index.js';

/**
 * Concrete test subclass of BaseService that exposes requireScope and handleError for testing
 */
class TestService extends BaseService {
	public testRequireScope(scope: TKeycloakAdminScope): void {
		this.RequireScope(scope);
	}

	public testHandleError(error: unknown): never {
		return this.HandleError(error);
	}
}

describe('BaseService', () => {
	let service: TestService;
	let mockAdminClient: Partial<KcAdminClient>;
	let grantedScopes: Set<TKeycloakAdminScope>;

	beforeEach(() => {
		mockAdminClient = {};
		grantedScopes = new Set(['users:read', 'users:write']);
		service = new TestService(
			mockAdminClient as KcAdminClient,
			grantedScopes as ReadonlySet<TKeycloakAdminScope>,
		);

		// Spy on the logger to verify calls
		vi.spyOn(AppLogger.prototype, 'warn');
		vi.spyOn(AppLogger.prototype, 'info');
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
				expect((error as KeycloakAdminScopeError).Scope).toBe('roles:write');
			}
		});

		it('should log a warning when scope check fails', () => {
			const warnSpy = vi.spyOn(AppLogger.prototype, 'warn');
			try {
				service.testRequireScope('roles:write');
			} catch {
				// Expected
			}
			expect(warnSpy).toHaveBeenCalled();
		});

		it('should log an audit message for write scopes', () => {
			const infoSpy = vi.spyOn(AppLogger.prototype, 'info');
			service.testRequireScope('users:write');
			expect(infoSpy).toHaveBeenCalledWith(
				expect.stringContaining('Keycloak admin mutation'),
			);
		});

		it('should not log an audit message for read scopes', () => {
			const infoSpy = vi.spyOn(AppLogger.prototype, 'info');
			infoSpy.mockClear();
			service.testRequireScope('users:read');
			// Read scope check should not log audit message
			expect(infoSpy).not.toHaveBeenCalledWith(
				expect.stringContaining('Keycloak admin mutation'),
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

		it('should throw IValidationError on 400 status', () => {
			const error = { response: { status: 400 }, message: 'Bad Request' };
			expect(() => {
				service.testHandleError(error);
			}).toThrow(IValidationError);
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
				expect(e).toBeInstanceOf(IValidationError);
				expect((e as IValidationError).Response).toEqual(data);
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
				expect((e as KeycloakClientError).Cause).toBe(cause);
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
