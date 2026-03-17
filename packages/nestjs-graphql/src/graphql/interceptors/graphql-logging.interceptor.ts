import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger } from '@pawells/nestjs-shared/common';

const RESULT_SUMMARY_MAX_KEYS = 3;

/**
 * GraphQL Logging Interceptor
 *
 * Logs GraphQL operations including queries, mutations, and subscriptions.
 * Captures operation details, execution time, and user information.
 *
 * @example
 * ```typescript
 * @UseInterceptors(GraphQLLoggingInterceptor)
 * @Query(() => User)
 * async getUser(): Promise<User> {
 *   // This operation will be logged
 * }
 * ```
 */
@Injectable()
export class GraphQLLoggingInterceptor implements NestInterceptor, LazyModuleRefService {
	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger, { strict: false });
	}

	private get logger(): AppLogger {
		return this.AppLogger.createContextualLogger(GraphQLLoggingInterceptor.name);
	}

	constructor(public readonly Module: ModuleRef) {}

	/**
	 * Intercepts GraphQL operations for logging
	 *
	 * @param context - The execution context
	 * @param next - The call handler
	 * @returns Observable - The intercepted operation
	 */
	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const startTime = Date.now();

		// Extract GraphQL context
		const gqlContext = GqlExecutionContext.create(context);
		const info = gqlContext.getInfo();
		const args = gqlContext.getArgs();

		// Extract operation details
		const operationName = info?.operation?.name?.value ?? 'Anonymous';
		const operationType = info?.operation?.operation ?? 'unknown';
		const fieldName = info?.fieldName ?? 'unknown';

		// Extract user information
		const { user } = gqlContext.getContext();
		const userId = user?.id ?? user?.sub ?? 'anonymous';

		// Log operation start
		this.logger?.info(
			`GraphQL ${operationType} started: ${operationName}.${fieldName} by user ${userId}`,
		);

		// Log variables in debug mode (avoid logging sensitive data in production)
		if (process.env['NODE_ENV'] !== 'production' && args) {
			const safeArgs = this.sanitizeArgs(args);
			this.logger?.debug(`Operation variables: ${JSON.stringify(safeArgs)}`);
		}

		return next.handle().pipe(
			tap({
				next: (result) => {
					const duration = Date.now() - startTime;
					this.logger?.info(
						`GraphQL ${operationType} completed: ${operationName}.${fieldName} in ${duration}ms`,
					);

					// Log result summary in debug mode
					if (process.env['NODE_ENV'] !== 'production') {
						const resultSummary = this.summarizeResult(result);
						this.logger?.debug(`Operation result: ${resultSummary}`);
					}
				},
				error: (error) => {
					const duration = Date.now() - startTime;
					this.logger?.error(
						`GraphQL ${operationType} failed: ${operationName}.${fieldName} after ${duration}ms - ${error instanceof Error ? error.message : String(error)}`,
					);
				},
			}),
		);
	}

	/**
	 * Sanitizes operation arguments to avoid logging sensitive data
	 *
	 * @param args - The operation arguments
	 * @returns any - Sanitized arguments
	 */
	private sanitizeArgs(args: any): any {
		if (!args || typeof args !== 'object') {
			return args;
		}

		const sanitized = { ...args };

		// Remove sensitive fields
		const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
		for (const field of sensitiveFields) {
			if (sanitized[field]) {
				sanitized[field] = '[REDACTED]';
			}
		}

		return sanitized;
	}

	/**
	 * Creates a summary of the operation result for logging
	 *
	 * @param result - The operation result
	 * @returns string - Result summary
	 */
	private summarizeResult(result: any): string {
		if (!result) {
			return 'null';
		}

		if (Array.isArray(result)) {
			return `Array(${result.length})`;
		}

		if (typeof result === 'object') {
			const keys = Object.keys(result);
			return `Object{${keys.slice(0, RESULT_SUMMARY_MAX_KEYS).join(', ')}${keys.length > RESULT_SUMMARY_MAX_KEYS ? '...' : ''}}`;
		}

		return String(result);
	}
}
