/**
 * @pawells/nestjs-shared - Lazy Module Ref Pattern Utilities
 *
 * This file provides type definitions and utilities for implementing the lazy ModuleRef
 * dependency injection pattern. This pattern enables deferred dependency resolution,
 * reducing constructor complexity and enabling circular dependency handling.
 *
 * @see {@link .claude/skills/lazy-module-ref-pattern.md} - Comprehensive pattern guide
 */

import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

/**
 * Type for a lazy-loaded getter that retrieves a dependency from ModuleRef
 *
 * @template T - The type of dependency being retrieved
 *
 * @example
 * ```typescript
 * public get Logger(): AppLogger {
 *     return this.Module.get(AppLogger);
 * }
 * ```
 */
export type LazyGetter<T> = () => T;

/**
 * Type for an optional lazy-loaded getter that may return undefined
 *
 * @template T - The type of dependency being retrieved
 *
 * @example
 * ```typescript
 * public get OptionalConfig(): ConfigService | undefined {
 *     try {
 *         return this.Module.get(ConfigService, { strict: false });
 *     } catch {
 *         return undefined;
 *     }
 * }
 * ```
 */
export type OptionalLazyGetter<T> = () => T | undefined;

/**
 * Type for a lazy-loaded getter using a string-based injection token
 *
 * @template T - The type of dependency being retrieved
 *
 * @example
 * ```typescript
 * public get PubSub(): PubSub {
 *     return this.Module.get('PUB_SUB');
 * }
 * ```
 */
export type TokenLazyGetter<T> = (token: string) => T;

/**
 * Interface for a service using lazy ModuleRef pattern
 *
 * Services implementing this pattern should have ModuleRef as their only
 * constructor dependency and provide typed getters for accessing other services.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class ExampleService implements LazyModuleRefService {
 *     constructor(public readonly Module: ModuleRef) {}
 *
 *     public get SomeService(): SomeServiceType {
 *         return this.Module.get(SomeServiceType);
 *     }
 * }
 * ```
 */
export interface LazyModuleRefService {
	/**
	 * The ModuleRef instance for lazy dependency resolution
	 * This should be the ONLY injected dependency
	 */
	Module: ModuleRef;
}

/**
 * Utility type to extract dependencies from a service with lazy getters
 *
 * Maps getter names to their return types for documentation and type inference.
 *
 * @template S - The service type with lazy getters
 *
 * @example
 * ```typescript
 * type AuthServiceDeps = LazyGetterDependencies<AuthService>;
 * // Results in: { Config: ConfigService, Logger: AppLogger }
 * ```
 */
export type LazyGetterDependencies<S> = {
	[K in keyof S as S[K] extends LazyGetter<any> ? K : never]: S[K] extends LazyGetter<infer T>
		? T
		: never;
};

/**
 * Configuration for optional dependency resolution
 * Used when a service may not be registered in the module
 */
export interface OptionalGetterConfig {
	/**
	 * Set to false to return undefined instead of throwing if not found
	 * @default true
	 */
	strict?: boolean;
}

/**
 * Utility function to create a memoized lazy getter
 * Caches the resolved dependency to avoid repeated lookups
 *
 * @template T - The type of dependency
 * @param getterFn - Function that retrieves the dependency
 * @returns A memoized getter function
 *
 * @example
 * ```typescript
 * private _cachedService: ServiceType | undefined;
 *
 * public get Service(): ServiceType {
 *     if (!this._cachedService) {
 *         this._cachedService = this.Module.get(ServiceType);
 *     }
 *     return this._cachedService;
 * }
 * ```
 */
export function CreateMemoizedLazyGetter<T>(
	getterFn: () => T,
): () => T {
	let cached: T | undefined;
	let initialized = false;

	return () => {
		if (!initialized) {
			cached = getterFn();
			initialized = true;
		}
		return cached as T;
	};
}

/**
 * Utility function to create a lazy getter with error handling for optional dependencies
 *
 * @template T - The type of dependency
 * @param module - The ModuleRef instance
 * @param token - The dependency token
 * @param config - Optional configuration
 * @returns The dependency or undefined
 *
 * @example
 * ```typescript
 * public get OptionalService(): ServiceType | undefined {
 *     return createOptionalLazyGetter(this.Module, ServiceType);
 * }
 * ```
 */
export function CreateOptionalLazyGetter<T>(
	module: ModuleRef,
	token: string | Function,
	config?: OptionalGetterConfig,
): T | undefined {
	try {
		return module.get(token, { strict: config?.strict ?? true });
	} catch {
		return undefined;
	}
}

/**
 * Type guard to check if a value is a LazyModuleRefService
 *
 * @param value - The value to check
 * @returns True if the value has a Module property of type ModuleRef
 *
 * @example
 * ```typescript
 * if (isLazyModuleRefService(service)) {
 *     // service.Module is available
 * }
 * ```
 */
export function IsLazyModuleRefService(value: any): value is LazyModuleRefService {
	return !!(value && typeof value === 'object' && 'Module' in value && value.Module instanceof ModuleRef);
}

/**
 * Pattern naming convention constants
 * Use these as documentation helpers for your lazy getter implementations
 */
export const LazyGetterNamingConventions = {
	/**
	 * Getter names should use PascalCase matching the service/type name
	 * Examples: Config, Logger, CacheService, OrderModel
	 */
	NAMING_PATTERN: 'PascalCase (matching service/type name)',

	/**
	 * Getter names should NOT include 'get' prefix or 'Service' suffix if redundant
	 * Example: public get Config() NOT public get getConfigService()
	 */
	AVOID_REDUNDANCY: true,

	/**
	 * For Mongoose models, use PascalCase + 'Model' suffix
	 * Example: public get OrderModel()
	 */
	MODEL_SUFFIX: 'Model',

	/**
	 * For string-based tokens, use meaningful names representing the service
	 * Example: public get PubSub() for 'PUB_SUB' token
	 */
	TOKEN_MAPPING: 'Meaningful name for token string',
};

/**
 * Backwards compatibility aliases - exported functions use PascalCase per project conventions
 */
export const createMemoizedLazyGetter = CreateMemoizedLazyGetter;
export const createOptionalLazyGetter = CreateOptionalLazyGetter;
export const isLazyModuleRefService = IsLazyModuleRefService;

/**
 * Abstract base class for NestJS services using the lazy ModuleRef pattern.
 *
 * Extend this class instead of implementing `LazyModuleRefService` directly to avoid
 * boilerplate. Declare lazy-loaded dependencies as protected getters in your subclass.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MediaService extends LazyModuleRefBase {
 *     protected get Library(): MediaLibraryService {
 *         return this.Module.get(MediaLibraryService) as MediaLibraryService;
 *     }
 *
 *     public async processMedia(id: string): Promise<void> {
 *         const library = this.Library;
 *         // ... use library
 *     }
 * }
 * ```
 *
 * Benefits:
 * - Eliminates constructor boilerplate for `Module: ModuleRef` property
 * - Enforces consistent implementation of `LazyModuleRefService`
 * - Getter names follow PascalCase matching the service/type being resolved
 *
 * @implements {LazyModuleRefService}
 */
@Injectable()
export abstract class LazyModuleRefBase implements LazyModuleRefService {
	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}
}
