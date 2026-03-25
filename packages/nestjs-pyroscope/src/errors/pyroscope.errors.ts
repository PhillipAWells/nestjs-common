/**
 * Base error class for Pyroscope-related errors.
 * Used throughout the package for consistent error handling and context tracking.
 */
export class PyroscopeError extends Error {
	public readonly context?: string;

	public constructor(message: string, context?: string) {
		super(message);
		this.name = this.constructor.name;
		this.context = context;
	}
}
