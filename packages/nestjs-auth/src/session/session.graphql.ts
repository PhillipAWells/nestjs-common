import { ObjectType, Field, InputType, ID } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

/**
 * GraphQL type for device information
 */
@ObjectType('Session_DeviceInfo')
export class SessionDeviceInfo {
	@Field()
	public userAgent!: string;

	@Field()
	public ipAddress!: string;

	@Field({ nullable: true })
	public deviceId?: string;
}

/**
 * GraphQL type for user profile information
 */
@ObjectType('Session_UserProfile')
export class SessionUserProfile {
	@Field(() => ID)
	public id!: string;

	@Field()
	public email!: string;

	@Field()
	public name!: string;

	@Field({ nullable: true })
	public avatar?: string;

	@Field(() => [String])
	public roles!: string[];

	@Field(() => [String])
	public permissions!: string[];
}

/**
 * GraphQL type for login records
 */
@ObjectType('Session_LoginRecord')
export class SessionLoginRecord {
	@Field()
	public timestamp!: Date;

	@Field(() => SessionDeviceInfo)
	public deviceInfo!: SessionDeviceInfo;

	@Field()
	public success!: boolean;

	@Field({ nullable: true })
	public provider?: string;
}

/**
 * GraphQL type for session
 * Represents a user's session with authentication and device information
 */
@ObjectType('Session')
export class SessionType {
	@Field(() => ID)
	public sessionId!: string;

	@Field(() => ID, { nullable: true })
	public userId?: string;

	@Field()
	public isAuthenticated!: boolean;

	@Field(() => SessionUserProfile, { nullable: true })
	public userProfile?: SessionUserProfile;

	@Field(() => SessionDeviceInfo)
	public deviceInfo!: SessionDeviceInfo;

	@Field()
	public createdAt!: Date;

	@Field()
	public lastActivityAt!: Date;

	@Field()
	public expiresAt!: Date;

	@Field(() => GraphQLJSON, { nullable: true })
	public preferences?: Record<string, any>;

	@Field(() => [SessionLoginRecord])
	public loginHistory!: SessionLoginRecord[];

	@Field(() => Number, { nullable: true })
	public maxConcurrentSessions?: number;
}

/**
 * GraphQL type for authentication payload
 * Returned after successful login or token refresh
 */
@ObjectType('Session_AuthPayload')
export class SessionAuthPayload {
	@Field(() => SessionType)
	public session!: SessionType;

	@Field()
	public accessToken!: string;

	@Field()
	public refreshToken!: string;
}

/**
 * GraphQL type for session events
 * Published when session state changes
 */
@ObjectType('Session_Event')
export class SessionEvent {
	@Field()
	public eventType!: string;

	@Field(() => ID)
	public sessionId!: string;

	@Field(() => ID, { nullable: true })
	public userId?: string;

	@Field()
	public timestamp!: Date;

	@Field(() => GraphQLJSON)
	public data!: Record<string, any>;
}

/**
 * GraphQL input type for session preferences update
 */
@InputType('Session_PreferencesInput')
export class SessionPreferencesInput {
	@Field(() => GraphQLJSON)
	public preferences!: Record<string, any>;
}
