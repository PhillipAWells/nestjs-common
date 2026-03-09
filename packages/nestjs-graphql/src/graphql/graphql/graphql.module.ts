import Joi from 'joi';
import { Module, DynamicModule, Global, MiddlewareConsumer, NestModule, OnModuleInit, Optional } from '@nestjs/common';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { HttpAdapterHost } from '@nestjs/core';
import { CommonModule } from '@pawells/nestjs-shared/common';
import { PyroscopeModule } from '@pawells/nestjs-pyroscope';
// Note: AuthModule NOT imported here to avoid circular dependency
// AuthModule depends on CacheModule from this package
// Applications should import both modules at root level
import { GraphQLService } from './graphql.service.js';
import { GraphQLConfigOptions, GraphQLAsyncConfig } from './graphql-config.interface.js';
import { GraphQLCacheService } from '../services/cache.service.js';
import { GraphQLPublicGuard } from '../guards/graphql-public.guard.js';
import { GraphQLAuthGuard } from '../guards/graphql-auth.guard.js';
import { QueryComplexityGuard } from '../guards/query-complexity.guard.js';
import { GraphQLRateLimitGuard } from '../guards/rate-limit.guard.js';
import { GraphQLRolesGuard } from '../guards/graphql-roles.guard.js';
import { GraphQLLoggingInterceptor } from '../interceptors/graphql-logging.interceptor.js';
import { GraphQLErrorInterceptor } from '../interceptors/graphql-error.interceptor.js';
import { GraphQLPerformanceInterceptor } from '../interceptors/graphql-performance.interceptor.js';
import { RateLimitService } from '../services/rate-limit.service.js';
import { BsonSerializationService, BsonSerializationMiddleware, BsonResponseInterceptor } from './bson/index.js';

/**
 * GraphQL module with Apollo Server 5.x integration
 * Provides comprehensive GraphQL functionality with custom scalars, types, and utilities
 */
@Global()
@Module({})
export class GraphQLModule implements NestModule, OnModuleInit {
	/**
	 * Store config for use in onModuleInit
	 */
	private static bsonConfig: any = null;

	constructor(
		@Optional() private readonly httpAdapterHost?: HttpAdapterHost,
		@Optional() private readonly bsonService?: BsonSerializationService,
		@Optional() private readonly bsonMiddleware?: BsonSerializationMiddleware,
	) {}
	/**
	 * Validate GraphQL configuration options
	 * @param options Configuration options
	 * @throws Error if validation fails
	 */
	private static validateGraphQLConfig(options: GraphQLConfigOptions): void {
		const schema = Joi.object({
			autoSchemaFile: Joi.string().optional().description('Path to auto-generated schema file'),
			sortSchema: Joi.boolean().optional().description('Whether to sort schema'),
			playground: Joi.boolean().optional().description('Enable GraphQL playground'),
			introspection: Joi.boolean().optional().description('Enable schema introspection'),
			debug: Joi.boolean().optional().description('Enable debug mode'),
			tracing: Joi.boolean().optional().description('Enable tracing'),
			cache: Joi.boolean().optional().description('Enable caching'),
		});

		const { error } = schema.validate(options);
		if (error) {
			throw new Error(`GraphQL configuration validation failed: ${error.details.map(d => d.message).join(', ')}`);
		}
	}

	/**
    * Configure the GraphQL module synchronously
    * @param options Configuration options for Apollo Server
    * @returns Dynamic module configuration
    */
	public static forRoot(options: GraphQLConfigOptions = {}): DynamicModule {
		// Validate configuration
		this.validateGraphQLConfig(options);

		// Store bson config for middleware registration
		this.bsonConfig = options.bson;

		const defaultOptions: ApolloDriverConfig = {
			driver: ApolloDriver,
			autoSchemaFile: options.autoSchemaFile ?? './schema.gql',
			sortSchema: options.sortSchema ?? true,
			playground: options.playground ?? true,
			introspection: options.introspection ?? true,
			...(options.context !== undefined ? { context: options.context } : {}),
			...(options.cors !== undefined ? { cors: options.cors } : {}),
			...(options.formatError !== undefined ? { formatError: options.formatError } : {}),
			...options,
		};

		const providers: any[] = [
			GraphQLService,
			RateLimitService,
			GraphQLCacheService,
			GraphQLPublicGuard,
			GraphQLAuthGuard,
			QueryComplexityGuard,
			GraphQLRateLimitGuard,
			GraphQLRolesGuard,
			GraphQLLoggingInterceptor,
			GraphQLErrorInterceptor,
			GraphQLPerformanceInterceptor,
		];

		// Add BSON service if enabled
		if (options.bson?.enabled) {
			providers.push(BsonSerializationService);
			providers.push(BsonResponseInterceptor);
		}

		return {
			module: GraphQLModule,
			imports: [
				CommonModule,
				// PyroscopeModule explicitly registered for profiling support
				PyroscopeModule.forRoot({
					config: {
						enabled: true,
						serverAddress: process.env['PYROSCOPE_SERVER_URL'] ?? 'http://localhost:4040',
						applicationName: 'nestjs-graphql',
						environment: process.env['NODE_ENV'] ?? 'development',
						tags: {
							env: process.env['NODE_ENV'] ?? 'development',
							package: 'nestjs-graphql',
						},
					},
				}),
				NestGraphQLModule.forRoot(defaultOptions),
			],
			providers,
			exports: [
				GraphQLService,
				RateLimitService,
				NestGraphQLModule,
				GraphQLCacheService,
				GraphQLPublicGuard,
				GraphQLAuthGuard,
				QueryComplexityGuard,
				GraphQLRateLimitGuard,
				GraphQLRolesGuard,
				GraphQLLoggingInterceptor,
				GraphQLErrorInterceptor,
				GraphQLPerformanceInterceptor,
				...(options.bson?.enabled ? [BsonSerializationService, BsonResponseInterceptor] : []),
			],
			global: true,
		};
	}

	/**
   * Configure the GraphQL module asynchronously
   * @param options Asynchronous configuration options
   * @returns Dynamic module configuration
   */
	public static forRootAsync(options: GraphQLAsyncConfig): DynamicModule {
		const providers: any[] = [
			GraphQLService,
			RateLimitService,
			GraphQLCacheService,
			GraphQLPublicGuard,
			GraphQLAuthGuard,
			QueryComplexityGuard,
			GraphQLRateLimitGuard,
			GraphQLRolesGuard,
			GraphQLLoggingInterceptor,
			GraphQLErrorInterceptor,
			GraphQLPerformanceInterceptor,
			// Always include BSON service in async mode for flexibility
			BsonSerializationService,
		];

		return {
			module: GraphQLModule,
			imports: [
				CommonModule,
				// PyroscopeModule explicitly registered for profiling support
				PyroscopeModule.forRoot({
					config: {
						enabled: true,
						serverAddress: process.env['PYROSCOPE_SERVER_URL'] ?? 'http://localhost:4040',
						applicationName: 'nestjs-graphql',
						environment: process.env['NODE_ENV'] ?? 'development',
						tags: {
							env: process.env['NODE_ENV'] ?? 'development',
							package: 'nestjs-graphql',
						},
					},
				}),
				NestGraphQLModule.forRootAsync({
					driver: ApolloDriver,
					useFactory: options.useFactory,
					...(options.inject ? { inject: options.inject } : {}),
				}),
			],
			providers: [...providers, BsonResponseInterceptor],
			exports: [
				GraphQLService,
				RateLimitService,
				NestGraphQLModule,
				GraphQLCacheService,
				GraphQLPublicGuard,
				GraphQLAuthGuard,
				QueryComplexityGuard,
				GraphQLRateLimitGuard,
				GraphQLRolesGuard,
				GraphQLLoggingInterceptor,
				GraphQLErrorInterceptor,
				GraphQLPerformanceInterceptor,
				BsonSerializationService,
				BsonResponseInterceptor,
			],
			global: true,
		};
	}

	/**
	 * Configure middleware for the module
	 */
	public configure(consumer: MiddlewareConsumer): void {
		// Only configure if BSON is enabled
		if (GraphQLModule.bsonConfig?.enabled && this.bsonMiddleware) {
			consumer
				 
				.apply(this.bsonMiddleware as any)
				.forRoutes('graphql');
		}
	}

	/**
	 * Lifecycle hook called after module initialization
	 */
	public onModuleInit(): void {
		// BSON service is optional and only initialized if enabled
		// Middleware is already registered in configure method
	}
}
