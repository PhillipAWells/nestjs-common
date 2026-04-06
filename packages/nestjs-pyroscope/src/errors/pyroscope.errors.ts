/**
 * Base error class for Pyroscope-related errors.
 * Used throughout the package for consistent error handling and context tracking.
 */
export class PyroscopeError extends Error {
	/** Optional context string providing additional detail about where the error occurred. */
	public readonly Context?: string;

	constructor(message: string, context?: string) {
		super(message);
		this.name = this.constructor.name;
		this.Context = context;
	}
}
