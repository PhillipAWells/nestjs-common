import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from './session.entity.js';

@Injectable()
export class SessionRepository {
	constructor(@InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>) {}

	public async Create(sessionData: Partial<Session>): Promise<Session> {
		const session = await this.sessionModel.create(sessionData);
		return session.toObject();
	}

	public async FindBySessionId(sessionId: string): Promise<Session | null> {
		return this.sessionModel.findOne({ sessionId }).lean().exec();
	}

	public async FindUserSessions(userId: string): Promise<Session[]> {
		return this.sessionModel.find({ userId }).lean().exec();
	}

	public async Update(sessionId: string, updateData: Partial<Session>): Promise<Session | null> {
		return this.sessionModel
			.findOneAndUpdate({ sessionId }, updateData, { new: true })
			.lean()
			.exec();
	}

	public async UpdateSessionActivity(sessionId: string): Promise<void> {
		await this.sessionModel.updateOne(
			{ sessionId },
			{ lastActivityAt: new Date() },
		).exec();
	}

	public async DeleteSession(sessionId: string): Promise<void> {
		await this.sessionModel.deleteOne({ sessionId }).exec();
	}

	public async DeleteUserSessions(userId: string): Promise<void> {
		await this.sessionModel.deleteMany({ userId }).exec();
	}

	public async FindActiveSessions(userId: string): Promise<Session[]> {
		return this.sessionModel
			.find({
				userId,
				expiresAt: { $gt: new Date() },
			})
			.lean()
			.exec();
	}
}
