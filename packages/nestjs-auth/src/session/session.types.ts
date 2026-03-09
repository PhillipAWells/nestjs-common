export enum SessionEventType {
	AUTHENTICATED = 'AUTHENTICATED',
	LOGGED_OUT = 'LOGGED_OUT',
	TOKEN_REFRESHED = 'TOKEN_REFRESHED',
	SESSION_REVOKED = 'SESSION_REVOKED',
	PERMISSIONS_CHANGED = 'PERMISSIONS_CHANGED',
	PROFILE_UPDATED = 'PROFILE_UPDATED',
	LOGIN_ELSEWHERE = 'LOGIN_ELSEWHERE',
	ACTIVITY_UPDATE = 'ACTIVITY_UPDATE',
	SECURITY_ALERT = 'SECURITY_ALERT',
}

export interface ISessionEvent {
	eventType: SessionEventType;
	sessionId: string;
	userId?: string;
	timestamp: Date;
	data: Record<string, any>;
}

export interface ISessionConfig {
	mongoUri?: string;
	redisUri?: string;
	sessionTtlMinutes: number;
	inactivityTimeoutMinutes: number;
	defaultMaxConcurrentSessions?: number | null;
	enforceSessionLimit: boolean;
}

export interface IDeviceInfo {
	userAgent: string;
	ipAddress: string;
	deviceId?: string;
}

export interface IUserProfile {
	id: string;
	email: string;
	name: string;
	avatar?: string;
	roles: string[];
	permissions: string[];
}
