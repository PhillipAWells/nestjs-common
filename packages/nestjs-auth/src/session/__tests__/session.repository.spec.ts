import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getModelToken } from '@nestjs/mongoose';
import { Session } from '../session.entity.js';
import { SessionRepository } from '../session.repository.js';

describe('SessionRepository', () => {
	let repository: SessionRepository;
	let mockSessionModel: any;

	beforeEach(() => {
		mockSessionModel = {
			create: vi.fn(),
			findOne: vi.fn(),
			find: vi.fn(),
			findOneAndUpdate: vi.fn(),
			updateOne: vi.fn(),
			deleteOne: vi.fn(),
			deleteMany: vi.fn(),
		};

		const mockModuleRef = {
			get: (token: any, _opts?: any) => {
				if (token === getModelToken(Session.name)) return mockSessionModel;
				return null;
			},
		};

		repository = new SessionRepository(mockModuleRef as any);
	});

	describe('Create', () => {
		it('should create a session', async () => {
			const sessionData = {
				sessionId: 'test-session-123',
				isAuthenticated: false,
				deviceInfo: { userAgent: 'Mozilla/5.0', ipAddress: '127.0.0.1' },
				createdAt: new Date(),
				lastActivityAt: new Date(),
				expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
			};

			const mockDocument = { ...sessionData, toObject: vi.fn().mockReturnValue(sessionData) };
			mockSessionModel.create.mockResolvedValue(mockDocument);

			const result = await repository.Create(sessionData as any);

			expect(mockSessionModel.create).toHaveBeenCalledWith(sessionData);
			expect(result).toEqual(sessionData);
		});
	});

	describe('FindBySessionId', () => {
		it('should find session by sessionId', async () => {
			const sessionData = { sessionId: 'test-123' };
			const mockQuery = {
				lean: vi.fn().mockReturnThis(),
				exec: vi.fn().mockResolvedValue(sessionData),
			};

			mockSessionModel.findOne.mockReturnValue(mockQuery);

			const result = await repository.FindBySessionId('test-123');

			expect(mockSessionModel.findOne).toHaveBeenCalledWith({ sessionId: 'test-123' });
			expect(mockQuery.lean).toHaveBeenCalled();
			expect(mockQuery.exec).toHaveBeenCalled();
			expect(result).toEqual(sessionData);
		});

		it('should return null if session not found', async () => {
			const mockQuery = {
				lean: vi.fn().mockReturnThis(),
				exec: vi.fn().mockResolvedValue(null),
			};

			mockSessionModel.findOne.mockReturnValue(mockQuery);

			const result = await repository.FindBySessionId('nonexistent-id');

			expect(result).toBeNull();
		});
	});

	describe('FindUserSessions', () => {
		it('should find all sessions for a user', async () => {
			const sessions = [{ sessionId: 'session-1' }, { sessionId: 'session-2' }];
			const mockQuery = {
				lean: vi.fn().mockReturnThis(),
				exec: vi.fn().mockResolvedValue(sessions),
			};

			mockSessionModel.find.mockReturnValue(mockQuery);

			const result = await repository.FindUserSessions('user-123');

			expect(mockSessionModel.find).toHaveBeenCalledWith({ userId: 'user-123' });
			expect(mockQuery.lean).toHaveBeenCalled();
			expect(mockQuery.exec).toHaveBeenCalled();
			expect(result).toEqual(sessions);
		});
	});

	describe('Update', () => {
		it('should update a session', async () => {
			const sessionData = { sessionId: 'session-123', userId: 'user-456' };
			const updateData = { lastActivityAt: new Date() };
			const mockQuery = {
				lean: vi.fn().mockReturnThis(),
				exec: vi.fn().mockResolvedValue({ ...sessionData, ...updateData }),
			};

			mockSessionModel.findOneAndUpdate.mockReturnValue(mockQuery);

			const result = await repository.Update('session-123', updateData as any);

			expect(mockSessionModel.findOneAndUpdate).toHaveBeenCalledWith(
				{ sessionId: 'session-123' },
				updateData,
				{ new: true },
			);
			expect(mockQuery.lean).toHaveBeenCalled();
			expect(mockQuery.exec).toHaveBeenCalled();
			expect(result).toBeDefined();
		});

		it('should return null if session not found during update', async () => {
			const mockQuery = {
				lean: vi.fn().mockReturnThis(),
				exec: vi.fn().mockResolvedValue(null),
			};

			mockSessionModel.findOneAndUpdate.mockReturnValue(mockQuery);

			const result = await repository.Update('nonexistent-id', { userId: 'user-123' } as any);

			expect(result).toBeNull();
		});
	});

	describe('UpdateSessionActivity', () => {
		it('should update lastActivityAt', async () => {
			const mockQuery = {
				exec: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
			};

			mockSessionModel.updateOne.mockReturnValue(mockQuery);

			await repository.UpdateSessionActivity('session-123');

			expect(mockSessionModel.updateOne).toHaveBeenCalledWith(
				{ sessionId: 'session-123' },
				{ lastActivityAt: expect.any(Date) },
			);
			expect(mockQuery.exec).toHaveBeenCalled();
		});
	});

	describe('DeleteSession', () => {
		it('should delete a session', async () => {
			const mockQuery = {
				exec: vi.fn().mockResolvedValue({ deletedCount: 1 }),
			};

			mockSessionModel.deleteOne.mockReturnValue(mockQuery);

			await repository.DeleteSession('session-123');

			expect(mockSessionModel.deleteOne).toHaveBeenCalledWith({ sessionId: 'session-123' });
			expect(mockQuery.exec).toHaveBeenCalled();
		});
	});

	describe('DeleteUserSessions', () => {
		it('should delete all sessions for a user', async () => {
			const mockQuery = {
				exec: vi.fn().mockResolvedValue({ deletedCount: 2 }),
			};

			mockSessionModel.deleteMany.mockReturnValue(mockQuery);

			await repository.DeleteUserSessions('user-123');

			expect(mockSessionModel.deleteMany).toHaveBeenCalledWith({ userId: 'user-123' });
			expect(mockQuery.exec).toHaveBeenCalled();
		});
	});

	describe('FindActiveSessions', () => {
		it('should find non-expired sessions for a user', async () => {
			const sessions = [
				{ sessionId: 'session-1', userId: 'user-123', expiresAt: new Date(Date.now() + 3600000) },
				{ sessionId: 'session-2', userId: 'user-123', expiresAt: new Date(Date.now() + 7200000) },
			];
			const mockQuery = {
				lean: vi.fn().mockReturnThis(),
				exec: vi.fn().mockResolvedValue(sessions),
			};

			mockSessionModel.find.mockReturnValue(mockQuery);

			const result = await repository.FindActiveSessions('user-123');

			expect(mockSessionModel.find).toHaveBeenCalledWith({
				userId: 'user-123',
				expiresAt: { $gt: expect.any(Date) },
			});
			expect(mockQuery.lean).toHaveBeenCalled();
			expect(mockQuery.exec).toHaveBeenCalled();
			expect(result).toEqual(sessions);
		});

		it('should return empty array if user has no active sessions', async () => {
			const mockQuery = {
				lean: vi.fn().mockReturnThis(),
				exec: vi.fn().mockResolvedValue([]),
			};

			mockSessionModel.find.mockReturnValue(mockQuery);

			const result = await repository.FindActiveSessions('user-no-sessions');

			expect(result).toEqual([]);
		});
	});
});
