import { vi } from 'vitest';
import { CurrentUser, AuthToken, IS_PUBLIC_KEY, ROLES_KEY } from '../auth-decorators.js';

describe('Auth Decorators', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Metadata Keys', () => {
		it('should export correct metadata keys', () => {
			expect(IS_PUBLIC_KEY).toBe('isPublic');
			expect(ROLES_KEY).toBe('roles');
		});
	});

	describe('CurrentUser', () => {
		it('should return a function when called without parameters', () => {
			const decorator = CurrentUser();
			expect(typeof decorator).toBe('function');
		});

		it('should return a function when called with property parameter', () => {
			const decorator = CurrentUser('id');
			expect(typeof decorator).toBe('function');
		});

		it('should return a function when called with options', () => {
			const decorator = CurrentUser(undefined, { contextType: 'graphql' });
			expect(typeof decorator).toBe('function');
		});
	});

	describe('AuthToken', () => {
		it('should return a function when called without parameters', () => {
			const decorator = AuthToken();
			expect(typeof decorator).toBe('function');
		});

		it('should return a function when called with options', () => {
			const decorator = AuthToken({ contextType: 'graphql' });
			expect(typeof decorator).toBe('function');
		});
	});
});
