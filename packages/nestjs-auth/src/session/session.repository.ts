import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from './session.entity.js';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';

@Injectable()
export class SessionRepository implements LazyModuleRefService {
	private get SessionModel(): Model<SessionDocument> {
		return this.Module.get(getModelToken(Session.name), { strict: false });
	}

	constructor(public readonly Module: ModuleRef) {}

	public async Create(sessionData: Partial<Session>): Promise<Session> {
		const session = await this.SessionModel.create(sessionData);
		return session.toObject();
	}

	public async FindBySessionId(sessionId: string): Promise<Session | null> {
		const session = await this.SessionModel.findOne({ sessionId }).lean().exec();
		return session;
	}

	public async FindUserSessions(userId: string): Promise<Session[]> {
		const sessions = await this.SessionModel.find({ userId }).lean().exec();
		return sessions;
	}

	public async Update(sessionId: string, updateData: Partial<Session>): Promise<Session | null> {
		const session = await this.SessionModel
			.findOneAndUpdate({ sessionId }, updateData, { new: true })
			.lean()
			.exec();
		return session;
	}

	public async UpdateSessionActivity(sessionId: string): Promise<void> {
		await this.SessionModel.updateOne(
			{ sessionId },
			{ lastActivityAt: new Date() },
		).exec();
	}

	public async DeleteSession(sessionId: string): Promise<void> {
		await this.SessionModel.deleteOne({ sessionId }).exec();
	}

	public async DeleteUserSessions(userId: string): Promise<void> {
		await this.SessionModel.deleteMany({ userId }).exec();
	}

	public async FindActiveSessions(userId: string): Promise<Session[]> {
		const sessions = await this.SessionModel
			.find({
				userId,
				expiresAt: { $gt: new Date() },
			})
			.lean()
			.exec();
		return sessions;
	}
}
