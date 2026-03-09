import type { IUserRepository } from '../interfaces/user-repository.interface';
import { MockUserRepository } from '../repositories/mock-user.repository';

describe('IUserRepository Interface Contract', () => {
	let repository: IUserRepository;

	beforeEach(() => {
		repository = new MockUserRepository();
	});

	it('should find user by email', async () => {
		const user = await repository.findByEmail('test@example.com');
		expect(user).toBeDefined();
	});

	it('should find user by id', async () => {
		const user = await repository.findById('user_123');
		expect(user).toBeDefined();
	});

	it('should create new user', async () => {
		const userData = {
			email: 'new@example.com',
			firstName: 'New',
			lastName: 'User',
			isActive: true
		};
		const user = await repository.create(userData);
		expect(user.id).toBeDefined();
		expect(user.email).toBe('new@example.com');
	});

	it('should update existing user', async () => {
		const created = await repository.create({
			email: 'update@example.com',
			isActive: true
		});
		const updated = await repository.update(created.id, {
			firstName: 'Updated'
		});
		expect(updated.firstName).toBe('Updated');
	});

	it('should delete user', async () => {
		const created = await repository.create({
			email: 'delete@example.com',
			isActive: true
		});
		const result = await repository.delete(created.id);
		expect(result).toBe(true);
		const found = await repository.findById(created.id);
		expect(found).toBeNull();
	});

	it('should throw error when creating user with duplicate email', async () => {
		await repository.create({
			email: 'duplicate@example.com',
			isActive: true
		});

		await expect(repository.create({
			email: 'duplicate@example.com',
			isActive: true
		})).rejects.toThrow('already exists');
	});

	it('should throw error when updating to duplicate email', async () => {
		const user1 = await repository.create({
			email: 'user1@example.com',
			isActive: true
		});

		await repository.create({
			email: 'user2@example.com',
			isActive: true
		});

		await expect(repository.update(user1.id, {
			email: 'user2@example.com'
		})).rejects.toThrow('already exists');
	});

	it('should throw error when updating non-existent user', async () => {
		await expect(repository.update('non-existent-id', {
			firstName: 'Test'
		})).rejects.toThrow('not found');
	});

	it('should handle email case-insensitivity', async () => {
		await repository.create({
			email: 'Test@Example.com',
			isActive: true
		});

		// Should find by lowercase
		const found = await repository.findByEmail('test@example.com');
		expect(found).not.toBeNull();
		expect(found?.email).toBe('Test@Example.com'); // Preserves original case

		// Should prevent duplicate with different case
		await expect(repository.create({
			email: 'TEST@EXAMPLE.COM',
			isActive: true
		})).rejects.toThrow('already exists');
	});
});
