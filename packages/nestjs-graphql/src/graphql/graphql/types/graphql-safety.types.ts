import { GraphQLError } from 'graphql';
import { Request, Response } from 'express';
import { GraphQLErrorCode } from '../error-codes.js';

// Re-export GraphQLErrorCode for backward compatibility with test imports
export { GraphQLErrorCode } from '../error-codes.js';

/**
 * User information interface for GraphQL context
 */
export interface IGraphQLUser {
	/** User ID */
	id: string;
	/** User email */
	email?: string;
	/** User roles */
	roles?: string[];
	/** Additional user properties */
	[key: string]: unknown;
}

/**
 * Enhanced GraphQL Context Interface
 * Properly typed context with user information
 */
export interface IGraphQLContextExtended {
	/** HTTP request object */
	req: Request;
	/** HTTP response object */
	res: Response;
	/** Authenticated user information */
	user?: IGraphQLUser;
	/** Request ID for tracing */
	requestId: string;
	/** Request start time */
	startTime: Date;
	/** GraphQL operation name */
	operationName?: string;
	/** Additional context properties */
	[key: string]: unknown;
}

/**
 * Error input interface for GraphQL error factory
 */
export interface IGraphQLErrorInput {
	/** Error message */
	message: string;
	/** Error code for programmatic identification */
	code: GraphQLErrorCode;
	/** HTTP status code */
	statusCode: number;
	/** Additional error details */
	details?: Record<string, unknown>;
	/** Error context */
	context?: Record<string, unknown>;
}

/**
 * Formatted GraphQL error response
 */
export interface IFormattedGraphQLError {
	/** Error message */
	message: string;
	/** Error extensions */
	extensions: {
		code: GraphQLErrorCode | string;
		statusCode?: number;
		timestamp?: string;
		stack?: string;
		details?: Record<string, unknown>;
		[key: string]: unknown;
	};
	/** Error locations in query */
	locations?: Array<{ line: number; column: number }>;
	/** Path to the field that caused the error */
	path?: Array<string | number>;
}

/**
 * WebSocket connection context interface
 */
export interface IWebSocketConnectionContext {
	/** Connection ID */
	id: string;
	/** Connection establishment time */
	connectedAt: Date;
	/** Connection parameters */
	params?: Record<string, unknown>;
}

/**
 * Subscription context interface
 */
export interface ISubscriptionContext {
	/** Subscription ID */
	id: string;
	/** Subscription operation name */
	operationName?: string;
	/** Subscription variables */
	variables?: Record<string, unknown>;
}

/**
 * Cursor data interface for pagination
 */
export interface ICursorData {
	/** Entity ID */
	id: string;
	/** Timestamp for pagination */
	timestamp: number;
}

/**
 * Pagination result interface
 */
export interface IPaginationResult<T> {
	/** Edges with cursors */
	edges: Array<{ cursor: string; node: T }>;
	/** Page information */
	pageInfo: {
		hasNextPage: boolean;
		hasPreviousPage: boolean;
		startCursor?: string;
		endCursor?: string;
	};
}

/**
 * CORS configuration interface
 */
export interface ICORSConfig {
	/** Allowed origins */
	origin?: string | string[] | RegExp | ((origin: string, cb: (err: Error | null, allow?: boolean) => void) => void);
	/** Allowed methods */
	methods?: string[];
	/** Allowed headers */
	allowedHeaders?: string[];
	/** Exposed headers */
	exposedHeaders?: string[];
	/** Credentials flag */
	credentials?: boolean;
	/** Max age for preflight cache */
	maxAge?: number;
	/** Preflight continue flag */
	preflightContinue?: boolean;
	/** Options success status */
	optionsSuccessStatus?: number;
}

/**
 * Error formatting callback type
 */
export type ErrorFormatterFn = (error: GraphQLError | Error) => IFormattedGraphQLError;

/**
 * Context factory callback type
 */
export type ContextFactoryFn = (req: Request, res: Response) => Promise<IGraphQLContextExtended> | IGraphQLContextExtended;

/**
 * Connection context for WebSocket
 */
export interface IWebSocketConnection {
	/** WebSocket request object */
	request?: Request;
	/** Connection ID */
	id?: string;
	/** Connected user */
	user?: IGraphQLUser;
	/** Connection parameters */
	params?: Record<string, unknown>;
}
