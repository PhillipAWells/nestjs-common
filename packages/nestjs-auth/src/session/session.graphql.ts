import { ObjectType, Field, InputType, ID } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

/**
 * GraphQL type for device information
 */
@ObjectType('Session_DeviceInfo')
export class Session_DeviceInfo {
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
export class Session_UserProfile {
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
export class Session_LoginRecord {
	@Field()
	public timestamp!: Date;

	@Field(() => Session_DeviceInfo)
	public deviceInfo!: Session_DeviceInfo;

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
export class Session_Type {
	@Field(() => ID)
	public sessionId!: string;

	@Field(() => ID, { nullable: true })
	public userId?: string;

	@Field()
	public isAuthenticated!: boolean;

	@Field(() => Session_UserProfile, { nullable: true })
	public userProfile?: Session_UserProfile;

	@Field(() => Session_DeviceInfo)
	public deviceInfo!: Session_DeviceInfo;

	@Field()
	public createdAt!: Date;

	@Field()
	public lastActivityAt!: Date;

	@Field()
	public expiresAt!: Date;

	@Field(() => GraphQLJSON, { nullable: true })
	public preferences?: Record<string, any>;

	@Field(() => [Session_LoginRecord])
	public loginHistory!: Session_LoginRecord[];

	@Field(() => Number, { nullable: true })
	public maxConcurrentSessions?: number;
}

/**
 * GraphQL type for authentication payload
 * Returned after successful login or token refresh
 */
@ObjectType('Session_AuthPayload')
export class Session_AuthPayload {
	@Field(() => Session_Type)
	public session!: Session_Type;

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
export class Session_Event {
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
export class Session_PreferencesInput {
	@Field(() => GraphQLJSON)
	public preferences!: Record<string, any>;
}
