import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { IUserRepository } from '../interfaces/user-repository.interface.js';
import type { User } from '../auth.types.js';

/**
 * In-memory mock user repository for testing and development
 */
@Injectable()
export class MockUserRepository implements IUserRepository {
	private readonly users = new Map<string, User>();

	private readonly emailIndex = new Map<string, string>(); // lowercase email -> userId

	public async findByEmail(email: string): Promise<User | null> {
		const userId = this.emailIndex.get(email.toLowerCase());
		if (!userId) {
			return null;
		}
		const user = this.users.get(userId);
		return user ?? null;
	}

	public async findById(id: string): Promise<User | null> {
		return this.users.get(id) ?? null;
	}

	public async create(userData: Omit<User, 'id'>): Promise<User> {
		const email = userData['email'];
		const emailKey = email.toLowerCase();

		// Check for duplicate email (case-insensitive)
		if (this.emailIndex.has(emailKey)) {
			throw new Error(`User with email ${email} already exists`);
		}

		const user: User = {
			id: randomUUID(),
			...userData,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		this.users.set(user.id, user);
		this.emailIndex.set(emailKey, user.id);

		return user;
	}

	public async update(id: string, updates: Partial<User>): Promise<User> {
		const existing = this.users.get(id);
		if (!existing) {
			throw new Error(`User with id ${id} not found`);
		}

		// Handle email change - update index
		const updatesEmail = updates['email'];
		if (updatesEmail && updatesEmail !== existing['email']) {
			const newEmailKey = updatesEmail.toLowerCase();

			// Check for duplicate (case-insensitive)
			if (this.emailIndex.has(newEmailKey)) {
				throw new Error(`User with email ${updatesEmail} already exists`);
			}

			const existingEmail = existing['email'];
			this.emailIndex.delete(existingEmail.toLowerCase());
			this.emailIndex.set(newEmailKey, id);
		}

		const updated: User = {
			...existing,
			...updates,
			id, // Preserve ID
			updatedAt: new Date(),
		};

		this.users.set(id, updated);
		return updated;
	}

	public async delete(id: string): Promise<boolean> {
		const user = this.users.get(id);
		if (!user) {
			return false;
		}

		this.users.delete(id);
		this.emailIndex.delete(user.email.toLowerCase());
		return true;
	}
}
