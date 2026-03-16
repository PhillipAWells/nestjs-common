import { Injectable, Logger } from '@nestjs/common';
import { GraphQLSchema } from 'graphql';
import type { GraphQLConfigOptions } from './graphql-config.interface.js';
import { Traced } from '@pawells/nestjs-open-telemetry';
import { GraphQLErrorCode } from './error-codes.js';

/**
 * Service for GraphQL module management and utilities
 * Provides helper methods for schema validation, error handling, and resolver development
 */
@Injectable()
export class GraphQLService {
	private readonly logger = new Logger(GraphQLService.name);

	private schema: GraphQLSchema | null = null;

	/**
    * Validate GraphQL schema
    * @param schema The GraphQL schema to validate
    * @throws Error if schema is invalid
    */
	@Traced({ name: 'graphql.validateSchema' })
	public validateSchema(schema: GraphQLSchema): void {
		if (!schema) {
			throw new Error('GraphQL schema is required');
		}

		// Basic validation - check if schema has query type
		if (!schema.getQueryType()) {
			throw new Error('GraphQL schema must have a query type');
		}

		this.schema = schema;
		this.logger.log('GraphQL schema validated successfully');
	}

	/**
   * Get the current GraphQL schema
   * @returns The GraphQL schema or null if not set
   */
	public getSchema(): GraphQLSchema | null {
		return this.schema;
	}

	/**
    * Format GraphQL errors with custom error codes
    * @param error The original error
    * @param config Configuration options
    * @returns Formatted error
    */
	@Traced({ name: 'graphql.formatError' })
	public formatError(error: Error | Record<string, unknown>, config?: GraphQLConfigOptions): Record<string, unknown> {
		const errorRecord = error as Record<string, unknown>;
		const message = error instanceof Error ? error.message : errorRecord['message'] ?? 'Unknown error';
		const extensions = error instanceof Error ? {} : (errorRecord['extensions'] as Record<string, unknown> ?? {});

		const formattedError: Record<string, unknown> = {
			message,
			extensions: {
				code: this.mapErrorToCode(error),
				...extensions,
			},
		};

		// Include stack trace in development mode or if explicitly configured
		const isDevelopment = process.env['NODE_ENV'] === 'development';
		if ((isDevelopment || config?.errorHandling?.includeStackTrace) && (error instanceof Error) && error.stack) {
			const ext = formattedError['extensions'] as Record<string, unknown>;
			ext['stack'] = error.stack;
		}

		return formattedError;
	}

	/**
   * Map error to custom error code
   * @param error The error to map
   * @returns Error code string
   */
	private mapErrorToCode(error: Error | Record<string, unknown>): GraphQLErrorCode {
		const errorRecord = error as Record<string, unknown>;
		const errorMessage = error instanceof Error
			? error.message.toLowerCase()
			: String(errorRecord['message'] ?? '').toLowerCase();

		// Default error codes mapping
		if (errorMessage.includes('validation')) {
			return GraphQLErrorCode.VALIDATION_ERROR;
		}
		if (errorMessage.includes('authentication')) {
			return GraphQLErrorCode.UNAUTHENTICATED;
		}
		if (errorMessage.includes('authorization')) {
			return GraphQLErrorCode.FORBIDDEN;
		}
		if (errorMessage.includes('not found')) {
			return GraphQLErrorCode.NOT_FOUND;
		}

		return GraphQLErrorCode.INTERNAL_ERROR;
	}

	/**
   * Helper method to create cursor from entity ID and timestamp
   * @param id Entity ID
   * @param timestamp Timestamp
   * @returns Base64 encoded cursor
   */
	public createCursor(id: string, timestamp?: number): string {
		const cursorData = {
			id,
			timestamp: timestamp ?? Date.now(),
		};
		return Buffer.from(JSON.stringify(cursorData)).toString('base64');
	}

	/**
   * Helper method to decode cursor
   * @param cursor Base64 encoded cursor
   * @returns Decoded cursor data
   */
	public decodeCursor(cursor: string): { id: string; timestamp: number } {
		try {
			const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
			return JSON.parse(decoded);
		} catch {
			throw new Error('Invalid cursor format');
		}
	}

	/**
   * Helper method for pagination logic
   * @param items Array of items to paginate
   * @param first Number of items to take from start
   * @param after Cursor to start after
   * @returns Paginated result with edges and page info
   */
	public paginateItems<T extends { id: string; createdAt?: Date }>(
		items: T[],
		first?: number,
		after?: string,
	): {
		edges: Array<{ cursor: string; node: T }>;
		pageInfo: {
			hasNextPage: boolean;
			hasPreviousPage: boolean;
			startCursor?: string;
			endCursor?: string;
		};
	} {
		let startIndex = 0;

		if (after) {
			const afterData = this.decodeCursor(after);
			const afterIndex = items.findIndex(item => item.id === afterData.id);
			if (afterIndex !== -1) {
				startIndex = afterIndex + 1;
			}
		}

		const endIndex = first ? startIndex + first : items.length;
		const paginatedItems = items.slice(startIndex, endIndex);

		const edges = paginatedItems.map(item => ({
			cursor: this.createCursor(item.id, item.createdAt ? item.createdAt.getTime() : undefined),
			node: item,
		}));

		return {
			edges,
			pageInfo: {
				hasNextPage: endIndex < items.length,
				hasPreviousPage: startIndex > 0,
				...(edges.length > 0 ? {
					startCursor: edges[0]?.cursor,
					endCursor: edges[edges.length - 1]?.cursor,
				} : {}),
			},
		};
	}
}
