declare global {
	namespace NodeJS {
		interface Timeout {}
	}
}

import {
	Injectable,
	CanActivate,
	ExecutionContext,
	BadRequestException,
	InternalServerErrorException,
	Logger,
	OnModuleDestroy,
} from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import type {
	ComplexityConfig,
} from '../graphql/query-complexity.js';
import {
	calculateQueryComplexity,
	exceedsComplexityLimit,
	DEFAULT_COMPLEXITY_CONFIG,
} from '../graphql/query-complexity.js';
import { QUERY_COMPLEXITY_CACHE_MAX_SIZE, QUERY_COMPLEXITY_CACHE_CLEANUP_INTERVAL_MS, QUERY_HASH_BASE, QUERY_HASH_CONVERSION_BASE, QUERY_COMPLEXITY_THRESHOLD } from '../constants/complexity.constants.js';

/**
 * Guard that enforces query complexity limits
 * Prevents complex queries that could impact performance
 *
 * Implements query complexity caching to avoid recalculating
 * complexity for identical queries
 */
@Injectable()
export class QueryComplexityGuard implements CanActivate, OnModuleDestroy, LazyModuleRefService {
	private readonly logger = new Logger(QueryComplexityGuard.name);

	private readonly complexityCache = new Map<string, number>();

	// eslint-disable-next-line no-undef
	private cleanupIntervalRef: NodeJS.Timeout | null = null;

	private get config(): ComplexityConfig {
		try {
			return this.Module.get<ComplexityConfig>('COMPLEXITY_CONFIG', { strict: false });
		} catch {
			return DEFAULT_COMPLEXITY_CONFIG;
		}
	}

	constructor(public readonly Module: ModuleRef) {
		this.startPeriodicCleanup();
	}

	/**
	 * Hashes a query for cache key generation
	 * Simple string hash for fast lookups
	 * @param query GraphQL query document
	 * @returns Hash string
	 */
	private hashQuery(query: any): string {
		const queryStr = JSON.stringify(query);
		let hash = 0;
		for (let i = 0; i < queryStr.length; i++) {
			const char = queryStr.charCodeAt(i);
			hash = ((hash << QUERY_HASH_BASE) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return hash.toString(QUERY_HASH_CONVERSION_BASE);
	}

	/**
	 * Gets cached complexity for a query
	 * @param query GraphQL query document
	 * @returns Cached complexity or undefined
	 */
	private getComplexityFromCache(query: any): number | undefined {
		return this.complexityCache.get(this.hashQuery(query));
	}

	/**
	 * Sets cached complexity for a query
	 * Implements FIFO eviction when cache exceeds max size
	 * @param query GraphQL query document
	 * @param complexity Calculated complexity
	 */
	private setComplexityCache(query: any, complexity: number): void {
		const key = this.hashQuery(query);

		// Clean up cache if it exceeds max size (FIFO)
		if (this.complexityCache.size >= QUERY_COMPLEXITY_CACHE_MAX_SIZE) {
			const firstKey = this.complexityCache.keys().next().value as string;
			if (firstKey) {
				this.complexityCache.delete(firstKey);
			}
		}

		this.complexityCache.set(key, complexity);
	}

	/**
	 * Starts periodic cleanup of the complexity cache
	 * Clears cache every 10 minutes to prevent stale entries
	 */
	private startPeriodicCleanup(): void {
		if (this.cleanupIntervalRef) {
			return;
		}

		this.cleanupIntervalRef = setInterval(() => {
			this.logger.debug(`Clearing complexity cache (size: ${this.complexityCache.size})`);
			this.complexityCache.clear();
		}, QUERY_COMPLEXITY_CACHE_CLEANUP_INTERVAL_MS);
	}

	/**
	 * Cleanup on module destruction
	 * Clears interval and memory structures
	 */
	public onModuleDestroy(): void {
		if (this.cleanupIntervalRef) {
			clearInterval(this.cleanupIntervalRef);
			this.cleanupIntervalRef = null;
			this.complexityCache.clear();
		}
	}

	/**
	 * Checks if the query complexity is within acceptable limits
	 * Uses caching to avoid recalculating complexity for identical queries
	 * @param context Execution context
	 * @returns True if query is allowed
	 */
	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const gqlContext = GqlExecutionContext.create(context);
		const { req } = gqlContext.getContext();
		const { schema, document, variables, operationName } = gqlContext.getArgs();

		try {
			// Check cache first
			const cachedComplexity = this.getComplexityFromCache(document);
			let complexity: number;

			if (cachedComplexity !== undefined) {
				complexity = cachedComplexity;
				this.logger.debug(`Query complexity from cache: ${complexity}`);
			} else {
				// Calculate query complexity
				complexity = calculateQueryComplexity(
					schema,
					document,
					variables,
					operationName,
					this.config,
				);

				// Store in cache
				this.setComplexityCache(document, complexity);
				this.logger.debug(`Query complexity calculated: ${complexity}`);
			}

			// Check if complexity exceeds limits
			if (exceedsComplexityLimit(complexity, this.config)) {
				const maxComplexity = this.config.limits?.maxComplexity ?? QUERY_COMPLEXITY_THRESHOLD;
				const message = `Query complexity ${complexity} exceeds maximum allowed complexity of ${maxComplexity}`;

				this.logger.warn(message, {
					complexity,
					maxComplexity,
					operationName,
					userId: req?.user?.id,
				});

				throw new BadRequestException(message);
			}

			// Add complexity to request for monitoring
			if (req) {
				req.queryComplexity = complexity;
			}

			return true;
		} catch (error) {
			if (error instanceof BadRequestException) {
				throw error;
			}

			this.logger.error(`Query complexity calculation failed: ${(error as Error).message}`, (error as Error).stack);
			throw new InternalServerErrorException('Unable to validate query complexity');
		}
	}
}
