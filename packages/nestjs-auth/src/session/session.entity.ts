import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema()
export class Session {
	@Prop({ type: String, required: true, unique: true })
	public sessionId!: string;

	@Prop({ type: String })
	public userId?: string;

	@Prop({ type: Boolean, required: true, default: false })
	public isAuthenticated!: boolean;

	@Prop({ type: String })
	public accessToken?: string;

	@Prop({ type: String })
	public refreshToken?: string;

	@Prop({ type: Date })
	public accessTokenExpiresAt?: Date;

	@Prop({ type: Date })
	public refreshTokenExpiresAt?: Date;

	@Prop({
		type: {
			userAgent: String,
			ipAddress: String,
			deviceId: String,
		},
		required: true,
	})
	public deviceInfo!: {
		userAgent: string;
		ipAddress: string;
		deviceId?: string;
	};

	@Prop({
		type: {
			id: String,
			email: String,
			name: String,
			avatar: String,
			roles: [String],
			permissions: [String],
		},
	})
	public userProfile?: {
		id: string;
		email: string;
		name: string;
		avatar?: string;
		roles: string[];
		permissions: string[];
	};

	@Prop({ type: Date, required: true })
	public createdAt!: Date;

	@Prop({ type: Date, required: true })
	public lastActivityAt!: Date;

	@Prop({ type: Date, required: true, index: { expireAfterSeconds: 0 } })
	public expiresAt!: Date;

	@Prop({ type: Map, of: String })
	public preferences?: Record<string, string>;

	@Prop({
		type: [
			{
				timestamp: Date,
				deviceInfo: {
					userAgent: String,
					ipAddress: String,
				},
				success: Boolean,
				provider: String,
			},
		],
		default: [],
	})
	public loginHistory!: Array<{
		timestamp: Date;
		deviceInfo: {
			userAgent: string;
			ipAddress: string;
		};
		success: boolean;
		provider?: string;
	}>;

	@Prop({ type: Number })
	public maxConcurrentSessions?: number;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Create unique index on sessionId
SessionSchema.index({ sessionId: 1 }, { unique: true });

// Create TTL index on expiresAt for automatic cleanup (0 means expire immediately at expiresAt time)
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Create composite index for finding user sessions
SessionSchema.index({ userId: 1, createdAt: -1 });
