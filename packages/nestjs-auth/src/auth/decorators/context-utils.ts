import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Context Options for Authentication Decorators
 *
 * Defines options for context-aware parameter extraction in authentication decorators.
 * Supports automatic context detection and explicit context type specification.
 */
export interface ContextOptions {
	/**
	 * The execution context type. If not specified, context will be auto-detected.
	 */
	contextType?: 'http' | 'graphql' | 'websocket' | undefined;

	/**
	 * Whether to auto-detect the context type. Defaults to true.
	 * When true, the decorator will automatically determine the context type.
	 * When false, the contextType must be explicitly specified.
	 */
	autoDetect?: boolean;
}

/**
 * Default context options with auto-detection enabled
 */
export const DEFAULT_CONTEXT_OPTIONS: ContextOptions = {
	autoDetect: true,
};

/**
 * Detects the execution context type from the current ExecutionContext
 *
 * @param ctx - The NestJS execution context
 * @returns The detected context type ('http', 'graphql', or 'websocket')
 * @throws Error if context type cannot be determined
 *
 * @example
 * ```typescript
 * const contextType = detectContextType(ctx);
 * if (contextType === 'graphql') {
 *   // Handle GraphQL context
 * }
 * ```
 */
export function DetectContextType(ctx: ExecutionContext): 'http' | 'graphql' | 'websocket' {
	try {
		// Try GraphQL context first
		GqlExecutionContext.create(ctx);
		return 'graphql';
	} catch {
		// Check for WebSocket context
		try {
			ctx.switchToWs();
			return 'websocket';
		} catch {
			// Fall back to HTTP context
			try {
				ctx.switchToHttp();
				return 'http';
			} catch {
				throw new Error('Unable to determine execution context type');
			}
		}
	}
}

/**
 * Extracts the request object from any supported execution context
 *
 * @param ctx - The NestJS execution context
 * @param options - Context options for extraction behavior
 * @returns The request object from the appropriate context
 * @throws Error if request cannot be extracted or context type is unsupported
 *
 * @example
 * ```typescript
 * const request = extractRequestFromContext(ctx);
 * const user = request.user;
 * const token = request.headers.authorization;
 * ```
 */
export function ExtractRequestFromContext(
	ctx: ExecutionContext,
	options: ContextOptions = DEFAULT_CONTEXT_OPTIONS,
): any {
	const contextType = options.autoDetect
		? DetectContextType(ctx)
		: options.contextType;

	if (!contextType) {
		throw new Error('Context type must be specified when autoDetect is false');
	}

	switch (contextType) {
		case 'http':
			return ctx.switchToHttp().getRequest();

		case 'graphql': {
			const gqlCtx = GqlExecutionContext.create(ctx);
			return gqlCtx.getContext().req;
		}

		case 'websocket': {
			const wsCtx = ctx.switchToWs();
			return wsCtx.getClient();
		}

		default:
			throw new Error(`Unsupported context type: ${contextType}`);
	}
}

/**
 * Extracts the authenticated user from any supported execution context
 *
 * @param ctx - The NestJS execution context
 * @param options - Context options for extraction behavior
 * @returns The authenticated user object or undefined if not found
 *
 * @example
 * ```typescript
 * const user = extractUserFromContext(ctx);
 * if (user) {
 *   console.log('User ID:', user.id);
 * }
 * ```
 *
 * @example With property path
 * ```typescript
 * const userId = extractUserFromContext(ctx, { property: 'id' });
 * ```
 */
export function ExtractUserFromContext(
	ctx: ExecutionContext,
	options: ContextOptions & { property?: string } = DEFAULT_CONTEXT_OPTIONS,
): any {
	const request = ExtractRequestFromContext(ctx, options);

	if (!request) {
		return undefined;
	}

	let { user } = request;

	if (options.property && user) {
		// Extract nested property using dot notation
		const keys = options.property.split('.');
		for (const key of keys) {
			if (user && typeof user === 'object') {
				user = user[key];
			} else {
				return undefined;
			}
		}
	}

	return user;
}

/**
 * Backwards compatibility aliases - exported functions use PascalCase per project conventions
 */
export const detectContextType = DetectContextType;
export const extractAuthTokenFromContext = ExtractAuthTokenFromContext;
export const extractRequestFromContext = ExtractRequestFromContext;
export const extractUserFromContext = ExtractUserFromContext;

/**
 * Extracts the authorization token from any supported execution context
 *
 * @param ctx - The NestJS execution context
 * @param options - Context options for extraction behavior
 * @returns The authorization token string or undefined if not found
 *
 * @example
 * ```typescript
 * const token = extractAuthTokenFromContext(ctx);
 * if (token) {
 *   // Validate token
 * }
 * ```
 */
export function ExtractAuthTokenFromContext(
	ctx: ExecutionContext,
	options: ContextOptions = DEFAULT_CONTEXT_OPTIONS,
): string | undefined {
	const request = ExtractRequestFromContext(ctx, options);

	if (!request) {
		return undefined;
	}

	// Try different common header variations
	const authHeader =
		request.headers?.authorization ??
		request.headers?.Authorization ??
		request.headers?.['authorization'] ??
		request.headers?.['Authorization'];

	if (typeof authHeader === 'string') {
		// Remove 'Bearer ' prefix if present
		return authHeader.replace(/^Bearer\s+/i, '');
	}

	return undefined;
}
