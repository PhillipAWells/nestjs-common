import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Context Options for Authentication Decorators
 *
 * Defines options for context-aware parameter extraction in authentication decorators.
 * Supports automatic context detection and explicit context type specification.
 */
export interface IContextOptions {
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
export const DEFAULT_CONTEXT_OPTIONS: IContextOptions = {
	autoDetect: true,
};

/**
 * Detects the execution context type from the current ExecutionContext
 *
 * @param ctx - The NestJS execution context
 * @returns The detected context type ('http', 'graphql', or 'websocket'); defaults to 'http' if undetermined
 *
 * @example
 * ```typescript
 * const contextType = DetectContextType(ctx);
 * if (contextType === 'graphql') {
 *   // Handle GraphQL context
 * }
 * ```
 */
export function DetectContextType(ctx: ExecutionContext): 'http' | 'graphql' | 'websocket' {
	// Use the context type reported by NestJS rather than try/catch,
	// because GqlExecutionContext.create() never throws - it always wraps the context.
	const ContextType = ctx.getType<string>();

	if (ContextType === 'graphql') {
		return 'graphql';
	}

	if (ContextType === 'ws') {
		return 'websocket';
	}

	if (ContextType === 'http') {
		return 'http';
	}

	// For GraphQL contexts using @nestjs/graphql, the type is 'graphql'
	// but some setups may use 'http' with a GraphQL layer on top.
	// Fall back to checking if GqlExecutionContext can extract GraphQL args.
	try {
		const GqlCtx = GqlExecutionContext.create(ctx);
		const Info = GqlCtx.getInfo();
		if (Info?.fieldName) {
			return 'graphql';
		}
	} catch {
		// Not a GraphQL context
	}

	// Default to http if we can't determine the type
	return 'http';
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
	options: IContextOptions = DEFAULT_CONTEXT_OPTIONS,
): any {
	const ContextType = options.autoDetect
		? DetectContextType(ctx)
		: options.contextType;

	if (!ContextType) {
		throw new Error('Context type must be specified when autoDetect is false');
	}

	switch (ContextType) {
		case 'http':
			return ctx.switchToHttp().getRequest();

		case 'graphql': {
			const GqlCtx = GqlExecutionContext.create(ctx);
			return GqlCtx.getContext().req;
		}

		case 'websocket': {
			const WsCtx = ctx.switchToWs();
			const Client = WsCtx.getClient();

			// Socket.IO provides handshake data with headers; raw WebSockets use upgradeReq
			// Attempt to return an object with headers for header-based auth extraction
			if (Client?.handshake) {
				// Socket.IO client — has handshake with headers
				return { headers: Client.handshake.headers, ...Client };
			}
			if (Client?.upgradeReq?.headers) {
				// Raw WS — has upgradeReq with headers
				return { headers: Client.upgradeReq.headers, ...Client };
			}

			// Fallback to raw client if no headers available
			return Client;
		}

		default:
			throw new Error(`Unsupported context type: ${ContextType}`);
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
 *   console.log('IUser ID:', user.id);
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
	options: IContextOptions & { property?: string } = DEFAULT_CONTEXT_OPTIONS,
): any {
	const Request = ExtractRequestFromContext(ctx, options);

	if (!Request) {
		return undefined;
	}

	let { user: User } = Request;

	if (options.property && User) {
		// Extract nested property using dot notation
		const Keys = options.property.split('.');
		for (const Key of Keys) {
			if (User && typeof User === 'object') {
				User = User[Key];
			} else {
				return undefined;
			}
		}
	}

	return User;
}

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
	options: IContextOptions = DEFAULT_CONTEXT_OPTIONS,
): string | undefined {
	const Request = ExtractRequestFromContext(ctx, options);

	if (!Request) {
		return undefined;
	}

	// Try different common header variations
	const AuthHeader =
		Request.headers?.authorization ??
		Request.headers?.Authorization ??
		Request.headers?.['authorization'] ??
		Request.headers?.['Authorization'];

	if (typeof AuthHeader === 'string') {
		// Remove 'Bearer ' prefix if present
		return AuthHeader.replace(/^Bearer\s+/i, '');
	}

	return undefined;
}

/**
 * Backwards compatibility aliases - exported functions use PascalCase per project conventions
 * Note: PascalCase versions are exported directly above
 */
