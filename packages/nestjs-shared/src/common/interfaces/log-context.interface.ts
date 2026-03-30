/**
 * Structured logging context for distributed tracing and monitoring
 *
 * Provides base fields for structured JSON logging compatible with Loki and other
 * observability platforms. All fields are optional to support flexible usage patterns.
 *
 * @example
 * // Basic usage
 * const context: ILogContext = {
 *   correlationId: 'req-123',
 *   userId: 'user-456',
 *   action: 'CreateStream',
 *   status: 'success'
 * };
 *
 * @example
 * // Extending with domain-specific fields
 * interface StreamingContext extends ILogContext {
 *   streamId: string;
 *   bitrate: number;
 *   codec: string;
 * }
 *
 * const streamContext: StreamingContext = {
 *   correlationId: 'req-123',
 *   userId: 'user-456',
 *   streamId: 'stream-789',
 *   action: 'StartStream',
 *   duration: 1250,
 *   status: 'success',
 *   bitrate: 5000,
 *   codec: 'h264'
 * };
 */
export interface ILogContext {
	/**
	 * Request correlation ID for distributed tracing
	 * Used to correlate logs across multiple services
	 */
	correlationId?: string;

	/**
	 * Authenticated user ID
	 * Identifies which user initiated the operation
	 */
	userId?: string;

	/**
	 * Stream or resource identifier
	 * Domain-specific identifier for the primary resource being operated on
	 */
	streamId?: string;

	/**
	 * Viewer or client identifier
	 * Identifies the viewer/client consuming a stream or resource
	 */
	viewerId?: string;

	/**
	 * Operation or action being performed
	 * Examples: 'CreateStream', 'StartBroadcast', 'UpdateMetadata'
	 */
	action?: string;

	/**
	 * Operation duration in milliseconds
	 * Useful for performance monitoring and SLO tracking
	 */
	duration?: number;

	/**
	 * Operation or request status
	 * Examples: 'success', 'failed', 'pending', 'completed'
	 */
	status?: string;

	/**
	 * Support for custom/domain-specific fields
	 * Allows extending the interface with additional context data
	 */
	[key: string]: any;
}
