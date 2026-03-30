declare global {
	namespace NodeJS {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		interface Timeout {}
	}
}

import { createHash } from 'node:crypto';
import {
	Injectable,
	CanActivate,
	ExecutionContext,
	BadRequestException,
	InternalServerErrorException,
	OnModuleDestroy,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';
import type {
	IComplexityConfig,
} from '../graphql/query-complexity.js';
import {
	calculateQueryComplexity,
	exceedsComplexityLimit,
	DEFAULT_COMPLEXITY_CONFIG,
} from '../graphql/query-complexity.js';
import { QUERY_COMPLEXITY_CACHE_MAX_SIZE, QUERY_COMPLEXITY_CACHE_CLEANUP_INTERVAL_MS, QUERY_COMPLEXITY_THRESHOLD } from '../constants/complexity.constants.js';

/**
 * Guard that enforces query complexity limits
 * Prevents complex queries that could impact performance
 *
 * Implements query complexity caching to avoid recalculating
 * complexity for identical queries
 */
@Injectable()
export class QueryComplexityGuard implements CanActivate, OnModuleDestroy, ILazyModuleRefService {
	public readonly Module: ModuleRef;

	private get AppLogger(): AppLogger | undefined {
		try {
			return this.Module.get(AppLogger, { strict: false });
		} catch {
			return undefined;
		}
	}

	private get Logger(): AppLogger | undefined {
		try {
			return this.AppLogger?.createContextualLogger(QueryComplexityGuard.name);
		} catch {
			return undefined;
		}
	}

	private readonly ComplexityCache = new Map<string, number>();

	// eslint-disable-next-line no-undef
	private CleanupIntervalRef: NodeJS.Timeout | null = null;

	private get Config(): IComplexityConfig {
		try {
			return this.Module.get<IComplexityConfig>('COMPLEXITY_CONFIG', { strict: false });
		} catch {
			return DEFAULT_COMPLEXITY_CONFIG;
		}
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
		this.startPeriodicCleanup();
	}

	/**
	 * Hashes a query for cache key generation using SHA-256
	 * Collision-safe hash for reliable cache lookups
	 * @param query GraphQL query document
	 * @returns SHA-256 hex string
	 */
	private hashQuery(query: any): string {
		const queryStr = JSON.stringify(query);
		return createHash('sha256').update(queryStr).digest('hex');
	}

	/**
	 * Gets cached complexity for a query
	 * @param query GraphQL query document
	 * @returns Cached complexity or undefined
	 */
	private getComplexityFromCache(query: any): number | undefined {
		return this.ComplexityCache.get(this.hashQuery(query));
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
		if (this.ComplexityCache.size >= QUERY_COMPLEXITY_CACHE_MAX_SIZE) {
			const firstKey = this.ComplexityCache.keys().next().value as string;
			if (firstKey) {
				this.ComplexityCache.delete(firstKey);
			}
		}

		this.ComplexityCache.set(key, complexity);
	}

	/**
	 * Starts periodic cleanup of the complexity cache
	 * Clears cache every 10 minutes to prevent stale entries
	 */
	private startPeriodicCleanup(): void {
		if (this.CleanupIntervalRef) {
			return;
		}

		this.CleanupIntervalRef = setInterval(() => {
			this.Logger?.debug(`Clearing complexity cache (size: ${this.ComplexityCache.size})`);
			this.ComplexityCache.clear();
		}, QUERY_COMPLEXITY_CACHE_CLEANUP_INTERVAL_MS);
	}

	/**
	 * Cleanup on module destruction
	 * Clears interval and memory structures
	 */
	public onModuleDestroy(): void {
		if (this.CleanupIntervalRef) {
			clearInterval(this.CleanupIntervalRef);
			this.CleanupIntervalRef = null;
			this.ComplexityCache.clear();
		}
	}

	/**
	 * Checks if the query complexity is within acceptable limits
	 * Uses caching to avoid recalculating complexity for identical queries
	 * @param context Execution context
	 * @returns True if query is allowed
	 */
	// eslint-disable-next-line require-await
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
				this.Logger?.debug(`Query complexity from cache: ${complexity}`);
			} else {
				// Calculate query complexity
				complexity = calculateQueryComplexity(
					schema,
					document,
					variables,
					operationName,
					this.Config,
				);

				// Store in cache
				this.setComplexityCache(document, complexity);
				this.Logger?.debug(`Query complexity calculated: ${complexity}`);
			}

			// Check if complexity exceeds limits
			if (exceedsComplexityLimit(complexity, this.Config)) {
				const maxComplexity = this.Config.limits?.maxComplexity ?? QUERY_COMPLEXITY_THRESHOLD;
				const message = `Query complexity ${complexity} exceeds maximum allowed complexity of ${maxComplexity}`;

				this.Logger?.warn(message, {
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

			this.Logger?.error(`Query complexity calculation failed: ${(error as Error).message}`, (error as Error).stack);
			throw new InternalServerErrorException('Unable to validate query complexity');
		}
	}
}
