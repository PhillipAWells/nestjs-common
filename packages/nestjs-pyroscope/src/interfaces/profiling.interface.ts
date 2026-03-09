// Configuration interface
export interface IPyroscopeConfig {
	enabled: boolean;
	serverAddress: string;
	applicationName: string;
	environment?: string;
	version?: string;
	sampleRate?: number;
	profileTypes?: TProfileType[];
	tags?: Record<string, string>;
	basicAuthUser?: string;
	basicAuthPassword?: string;
	tlsEnabled?: boolean;
	tlsCertPath?: string;
	tlsKeyPath?: string;
	tlsCaPath?: string;
	tlsInsecureSkipVerify?: boolean;
	logLevel?: 'debug' | 'info' | 'warn' | 'error';
	enableHealthChecks?: boolean;
	degradedActiveProfilesThreshold?: number;
	retryBaseDelayMs?: number;
	retryMaxDelayMs?: number;
	retryJitterMs?: number;
	tagMaxLength?: number;
}

export type TProfileType = 'cpu' | 'memory' | 'goroutine' | 'mutex' | 'block';

export interface IProfileMetrics {
	cpuTime: number;
	memoryUsage: number;
	duration: number;
	timestamp: number;
	tags?: Record<string, string>;
}

export interface IProfileContext {
	profileId?: string;
	functionName: string;
	className?: string;
	methodName?: string;
	startTime: number;
	endTime?: number;
	duration?: number;
	error?: Error;
	tags?: Record<string, string>;
}
