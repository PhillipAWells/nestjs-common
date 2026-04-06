/**
 * Module factory utilities for common NestJS module patterns
 *
 * Provides standardized factory functions for creating modules with consistent
 * structure, providers, exports, and configuration patterns.
 */

import { DynamicModule, Logger } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE, APP_GUARD } from '@nestjs/core';

/**
 * Configuration interface for global modules
 */
export interface IGlobalModuleConfig {
	/** Module name for logging */
	name: string;
	/** Providers to include in the module */
	providers?: any[];
	/** Services to export from the module */
	exports?: any[];
	/** Other modules to import */
	imports?: any[];
	/** Whether the module is global (default: true) */
	isGlobal?: boolean;
}

/**
 * Configuration interface for feature modules
 */
export interface IFeatureModuleConfig {
	/** Module name for logging */
	name: string;
	/** Providers to include in the module */
	providers?: any[];
	/** Services to export from the module */
	exports?: any[];
	/** Controllers to include */
	controllers?: any[];
	/** Other modules to import */
	imports?: any[];
}

/**
 * Configuration interface for service modules
 */
export interface IServiceModuleConfig {
	/** Module name for logging */
	name: string;
	/** Service providers */
	providers?: any[];
	/** Services to export */
	exports?: any[];
	/** Other modules to import */
	imports?: any[];
}

/**
 * Configuration interface for application modules
 */
export interface IApplicationModuleConfig {
	/** Module name for logging */
	name: string;
	/** Global filters to apply */
	filters?: any[];
	/** Global interceptors to apply */
	interceptors?: any[];
	/** Global pipes to apply */
	pipes?: any[];
	/** Global guards to apply */
	guards?: any[];
	/** Other modules to import */
	imports?: any[];
}

/**
 * Creates a global module with standardized configuration
 *
 * @param config - Module configuration
 * @returns DynamicModule
 *
 * @example
 * ```typescript
 * @Module({})
 * export class ConfigModule extends createGlobalModule({
 *   name: 'ConfigModule',
 *   providers: [ConfigService],
 *   exports: [ConfigService],
 * }) {}
 * ```
 */
export function CreateGlobalModule(config: IGlobalModuleConfig): DynamicModule {
	const { name, providers = [], exports = [], imports = [], isGlobal = true } = config;

	const ModuleConfig: any = {
		providers: [
			...providers,
			{
				provide: Logger,
				useValue: new Logger(name),
			},
		],
		exports: [
			...exports,
			Logger,
		],
		imports,
	};

	if (isGlobal) {
		ModuleConfig.providers.push({
			provide: 'MODULE_TYPE',
			useValue: 'global',
		});
	}

	return {
		module: class {},
		...ModuleConfig,
		global: isGlobal,
	};
}

/**
 * Creates a feature module with standardized configuration
 *
 * @param config - Module configuration
 * @returns DynamicModule
 *
 * @example
 * ```typescript
 * @Module({})
 * export class UserModule extends createFeatureModule({
 *   name: 'UserModule',
 *   controllers: [UserController],
 *   providers: [UserService],
 *   exports: [UserService],
 * }) {}
 * ```
 */
export function CreateFeatureModule(config: IFeatureModuleConfig): DynamicModule {
	const { name, providers = [], exports = [], controllers = [], imports = [] } = config;

	return {
		module: class {},
		controllers,
		providers: [
			...providers,
			{
				provide: Logger,
				useValue: new Logger(name),
			},
		],
		exports: [
			...exports,
			Logger,
		],
		imports,
	};
}

/**
 * Creates a service module with standardized configuration
 *
 * @param config - Module configuration
 * @returns DynamicModule
 *
 * @example
 * ```typescript
 * @Module({})
 * export class DatabaseModule extends createServiceModule({
 *   name: 'DatabaseModule',
 *   providers: [DatabaseService, DatabaseConnection],
 *   exports: [DatabaseService],
 * }) {}
 * ```
 */
export function CreateServiceModule(config: IServiceModuleConfig): DynamicModule {
	const { name, providers = [], exports = [], imports = [] } = config;

	return {
		module: class {},
		providers: [
			...providers,
			{
				provide: Logger,
				useValue: new Logger(name),
			},
		],
		exports: [
			...exports,
			Logger,
		],
		imports,
	};
}

/**
 * Creates an application module with global filters, interceptors, pipes, and guards
 *
 * @param config - Module configuration
 * @returns DynamicModule
 *
 * @example
 * ```typescript
 * @Module({})
 * export class AppModule extends createApplicationModule({
 *   name: 'AppModule',
 *   imports: [UserModule, AuthModule],
 *   filters: [HttpExceptionFilter],
 *   interceptors: [LoggingInterceptor],
 *   pipes: [ValidationPipe],
 *   guards: [AuthGuard],
 * }) {}
 * ```
 */
export function CreateApplicationModule(config: IApplicationModuleConfig): DynamicModule {
	const { name, filters = [], interceptors = [], pipes = [], guards = [], imports = [] } = config;

	const Providers: any[] = [
		{
			provide: Logger,
			useValue: new Logger(name),
		},
	];

	// Add global filters
	filters.forEach((filter) => {
		Providers.push({
			provide: APP_FILTER,
			useClass: filter,
		});
	});

	// Add global interceptors
	interceptors.forEach((interceptor) => {
		Providers.push({
			provide: APP_INTERCEPTOR,
			useClass: interceptor,
		});
	});

	// Add global pipes
	pipes.forEach((pipe) => {
		Providers.push({
			provide: APP_PIPE,
			useClass: pipe,
		});
	});

	// Add global guards
	guards.forEach((guard) => {
		Providers.push({
			provide: APP_GUARD,
			useClass: guard,
		});
	});

	return {
		module: class {},
		providers: Providers,
		exports: [Logger],
		imports,
	};
}

/**
 * Creates a module with conditional providers based on configuration
 *
 * @param config - Base module configuration
 * @param conditions - Array of conditional provider configurations
 * @returns DynamicModule
 *
 * @example
 * ```typescript
 * @Module({})
 * export class CacheModule extends createConditionalModule(
 *   { name: 'CacheModule', imports: [ConfigModule] },
 *   [
 *     {
 *       condition: (config) => config.get('CACHE_ENABLED'),
 *       providers: [RedisService],
 *       exports: [RedisService],
 *     },
 *   ]
 * ) {}
 * ```
 */
export function CreateConditionalModule(
	baseConfig: Partial<IGlobalModuleConfig & IFeatureModuleConfig & IServiceModuleConfig>,
	conditions: Array<{
		condition: (config?: any) => boolean;
		providers?: any[];
		exports?: any[];
		imports?: any[];
		controllers?: any[];
		config?: any;
	}>,
): DynamicModule {
	const { name = 'ConditionalModule', providers = [], exports = [], imports = [] } = baseConfig;

	const ConditionalProviders: any[] = [];
	const ConditionalExports: any[] = [];
	const ConditionalImports: any[] = [];

	conditions.forEach(({ condition, providers: condProviders = [], exports: condExports = [], imports: condImports = [], config }) => {
		if (condition(config)) {
			ConditionalProviders.push(...condProviders);
			ConditionalExports.push(...condExports);
			ConditionalImports.push(...condImports);
		}
	});

	return {
		module: class {},
		providers: [
			...providers,
			...ConditionalProviders,
			{
				provide: Logger,
				useValue: new Logger(name),
			},
		],
		exports: [
			...exports,
			...ConditionalExports,
			Logger,
		],
		imports: [
			...imports,
			...ConditionalImports,
		],
	};
}

/**
 * Backwards compatibility aliases - exported functions use PascalCase per project conventions
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const createApplicationModule = CreateApplicationModule;
// eslint-disable-next-line @typescript-eslint/naming-convention
export const createConditionalModule = CreateConditionalModule;
// eslint-disable-next-line @typescript-eslint/naming-convention
export const createFeatureModule = CreateFeatureModule;
// eslint-disable-next-line @typescript-eslint/naming-convention
export const createGlobalModule = CreateGlobalModule;
// eslint-disable-next-line @typescript-eslint/naming-convention
export const createServiceModule = CreateServiceModule;
