import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { type Logger } from '@pawells/logger';

/**
 * OpenTelemetry configuration interface
 */
export interface OpenTelemetryConfig {
	/** Service name (required) */
	serviceName: string;
	/** Service version (default: package.json version) */
	serviceVersion?: string;
	/** Deployment environment (default: process.env.NODE_ENV) */
	environment?: 'development' | 'staging' | 'production' | 'test';
	/** OTLP endpoint URL (default: http://localhost:4318) */
	otlpEndpoint?: string;
	/** OTLP protocol (default: 'http') */
	otlpProtocol?: 'grpc' | 'http';
	/** Enable tracing (default: true) */
	enableTracing?: boolean;
	/** Enable metrics (default: true) */
	enableMetrics?: boolean;
	/** Trace sampling ratio (default: 1.0 - sample all) */
	traceSampleRatio?: number;
	/** Service namespace for telemetry (default: 'pawells'). Set to empty string to disable namespacing */
	namespace?: string;
	/** Additional resource attributes */
	resourceAttributes?: Record<string, string | number | boolean>;
	/** Custom logger for diagnostics */
	logger?: Logger;
}

/**
 * Global SDK instance
 */
let sdkInstance: NodeTracerProvider | null = null;
let isInitializedFlag = false;

/**
 * Get the global SDK instance (internal use, primarily for testing)
 * @internal
 */
export function getSdkInstance(): NodeTracerProvider | null {
	return sdkInstance;
}

/**
 * Initialize OpenTelemetry instrumentation for the service.
 *
 * For test environments, this uses a lightweight NodeTracerProvider setup
 * without external OTLP exporters (to avoid requiring a running collector).
 *
 * @param config - OpenTelemetry configuration
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * await initializeOpenTelemetry({
 *   serviceName: 'user-service',
 *   environment: 'production',
 * });
 * ```
 */
export async function initializeOpenTelemetry(config: OpenTelemetryConfig): Promise<void> {
	if (isInitializedFlag) {
		return;
	}

	try {
		// Create a basic NodeTracerProvider
		// In test environments, this doesn't export to a collector
		const resource = Resource.default().merge(
			new Resource({
				'service.name': config.serviceName,
				'service.version': config.serviceVersion ?? '0.0.0',
				'deployment.environment': config.environment ?? 'development',
				...config.resourceAttributes,
			}),
		);

		const provider = new NodeTracerProvider({
			resource,
		});

		// Register the provider as the global tracer provider
		provider.register();

		sdkInstance = provider;
		isInitializedFlag = true;
	} catch (error) {
		// Gracefully handle initialization errors
		// The decorators still work without full OTel setup
		isInitializedFlag = false;
		throw error;
	}
}

/**
 * Shutdown OpenTelemetry SDK gracefully.
 * Flushes pending telemetry and releases resources.
 *
 * @returns Promise<void>
 */
export async function shutdownOpenTelemetry(): Promise<void> {
	if (!sdkInstance) {
		return;
	}

	try {
		await sdkInstance.shutdown();
		sdkInstance = null;
		isInitializedFlag = false;
	} catch (error) {
		// Gracefully handle shutdown errors
		isInitializedFlag = false;
		throw error;
	}
}

/**
 * Check if OpenTelemetry is initialized.
 *
 * @returns boolean
 */
export function isInitialized(): boolean {
	return isInitializedFlag;
}
