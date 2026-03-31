/**
 * Extracts a string representation of an error suitable for use as a log
 * stack-trace argument. Returns the stack trace when available, falls back to
 * the error message, and stringifies any non-Error thrown value.
 *
 * @param error Any caught value (ideally an Error, but can be anything)
 */
export function GetErrorStack(error: unknown): string {
	if (error instanceof Error) {
		return error.stack ?? error.message;
	}
	return String(error);
}

/**
 * Extracts the human-readable message from a caught value.
 * Returns `error.message` for Error instances and stringifies anything else.
 *
 * @param error Any caught value (ideally an Error, but can be anything)
 */
export function GetErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}
