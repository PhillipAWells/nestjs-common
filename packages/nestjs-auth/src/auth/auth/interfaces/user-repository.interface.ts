import type { User } from '../auth.types.js';

/**
 * User repository interface for database abstraction
 */
export interface IUserRepository {
	/**
	 * Find user by email address
	 */
	findByEmail(email: string): Promise<User | null>;

	/**
	 * Find user by ID
	 */
	findById(id: string): Promise<User | null>;

	/**
	 * Create new user
	 */
	create(user: Omit<User, 'id'>): Promise<User>;

	/**
	 * Update existing user
	 */
	update(id: string, updates: Partial<User>): Promise<User>;

	/**
	 * Delete user by ID
	 * @returns true if deleted, false if not found
	 */
	delete(id: string): Promise<boolean>;
}

/**
 * Injection token for user repository
 */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
