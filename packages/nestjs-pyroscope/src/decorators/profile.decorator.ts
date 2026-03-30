import { PyroscopeService } from '../service.js';
import { IProfileContext } from '../interfaces/profiling.interface.js';

type TAnyFunction = (...args: unknown[]) => unknown;

/**
 * Class-level decorator for profiling all methods in a class.
 *
 * Automatically profiles every method of a class (except constructor) by wrapping
 * them with profiling start/stop calls. Supports both sync and async methods.
 *
 * When to use:
 * - You want automatic profiling of all methods in a service/controller
 * - Minimal setup required
 * - Methods must have PyroscopeService injected to work
 *
 * @param options Optional configuration with tags for all profiles
 * @returns ClassDecorator
 *
 * @example
 * ```typescript
 * @Profile({ tags: { service: 'user' } })
 * @Injectable()
 * export class UserService {
 *   constructor(private pyroscope: PyroscopeService) {}
 *
 *   async findById(id: string) {
 *     // Automatically profiled as 'UserService.findById'
 *   }
 *
 *   getCountSync() {
 *     // Sync methods also profiled
 *   }
 * }
 * ```
 *
 * @remarks
 * - Skips profiling silently if PyroscopeService is not injected
 * - Skips profiling if profiling is disabled in config
 * - Works with both sync and async methods
 * - Profile name is formatted as 'ClassName.methodName'
 */
export function Profile(options?: { tags?: Record<string, string> }): ClassDecorator {
	return function(target: object): void {
		const proto = (target as { prototype: Record<string, unknown> }).prototype;
		const originalMethods = Object.getOwnPropertyNames(proto);
		const targetName = (target as { name: string }).name;

		for (const methodName of originalMethods) {
			if (methodName === 'constructor' || typeof proto[methodName] !== 'function') {
				continue;
			}

			const originalMethod = proto[methodName] as TAnyFunction;

			proto[methodName] = function(this: { pyroscopeService?: PyroscopeService }, ...args: unknown[]): unknown {
				const { pyroscopeService } = this;

				// PyroscopeService not injected — skip profiling silently
				if (!pyroscopeService) {
					return originalMethod.apply(this, args);
				}

				if (!pyroscopeService.isEnabled()) {
					return originalMethod.apply(this, args);
				}

				const context: IProfileContext = {
					functionName: `${targetName}.${methodName}`,
					className: targetName,
					methodName,
					startTime: Date.now(),
					...(options?.tags && { tags: options.tags }),
				};

				pyroscopeService.startProfiling(context);

				try {
					const result = originalMethod.apply(this, args);

					// Handle async methods (Promises)
					if (result instanceof Promise) {
						return result
							.then((value) => {
								pyroscopeService.stopProfiling(context);
								return value;
							})
							.catch((error) => {
								context.error = error as Error;
								pyroscopeService.stopProfiling(context);
								throw error;
							});
					}

					// Handle synchronous methods
					pyroscopeService.stopProfiling(context);
					return result;
				} catch (error) {
					context.error = error as Error;
					pyroscopeService.stopProfiling(context);
					throw error;
				}
			};
		}
	};
}

/**
 * Method-level decorator for profiling specific methods.
 *
 * Profiles a single method (works with both sync and async). Useful when you only want
 * to profile certain critical methods, not the entire class.
 *
 * When to use:
 * - You want selective profiling of specific methods
 * - You need custom profile names
 * - You want method-level granularity
 *
 * @param options Optional configuration with custom name and tags
 * @param options.name Custom profile name (default: 'ClassName.methodName')
 * @param options.tags Tags to attach to this profile
 * @returns MethodDecorator
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class DatabaseService {
 *   constructor(private pyroscope: PyroscopeService) {}
 *
 *   @ProfileMethod({ name: 'db.query.expensive' })
 *   async executeExpensiveQuery(sql: string) {
 *     return await this.db.query(sql);
 *   }
 *
 *   @ProfileMethod({ tags: { operation: 'read' } })
 *   getUserById(id: string) {
 *     return this.cache.get(id);
 *   }
 * }
 * ```
 *
 * @remarks
 * - Skips profiling silently if PyroscopeService is not injected
 * - Skips profiling if profiling is disabled in config
 * - Works with both sync and async methods
 */
export function ProfileMethod(options?: {
	name?: string;
	tags?: Record<string, string>;
}): MethodDecorator {
	return function(target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
		const originalMethod = descriptor.value as TAnyFunction;
		const methodName = String(propertyKey);

		descriptor.value = function(this: { pyroscopeService?: PyroscopeService }, ...args: unknown[]): unknown {
			const { pyroscopeService } = this;

			// PyroscopeService not injected — skip profiling silently
			if (!pyroscopeService) {
				return originalMethod.apply(this, args);
			}

			if (!pyroscopeService.isEnabled()) {
				return originalMethod.apply(this, args);
			}

			const targetConstructorName = (target as { constructor: { name: string } }).constructor.name;
			const profileName = options?.name ?? `${targetConstructorName}.${methodName}`;
			const context: IProfileContext = {
				functionName: profileName,
				className: targetConstructorName,
				methodName,
				startTime: Date.now(),
				...(options?.tags && { tags: options.tags }),
			};

			pyroscopeService.startProfiling(context);

			try {
				const result = originalMethod.apply(this, args);

				// Handle async methods (Promises)
				if (result instanceof Promise) {
					return result
						.then((value) => {
							pyroscopeService.stopProfiling(context);
							return value;
						})
						.catch((error) => {
							context.error = error as Error;
							pyroscopeService.stopProfiling(context);
							throw error;
						});
				}

				// Handle synchronous methods
				pyroscopeService.stopProfiling(context);
				return result;
			} catch (error) {
				context.error = error as Error;
				pyroscopeService.stopProfiling(context);
				throw error;
			}
		};

		return descriptor;
	};
}

/**
 * Decorator for async methods with proper timing.
 *
 * Specifically designed for async methods to ensure profiling timing is accurate
 * for Promise-based operations. Use this instead of @ProfileMethod when you know
 * the method is async.
 *
 * When to use:
 * - You have async methods (returning Promise)
 * - You want guaranteed Promise handling
 * - You prefer explicit async decoration
 *
 * @param options Optional configuration with custom name and tags
 * @param options.name Custom profile name (default: 'ClassName.methodName')
 * @param options.tags Tags to attach to this profile
 * @returns MethodDecorator
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class ApiService {
 *   constructor(private pyroscope: PyroscopeService) {}
 *
 *   @ProfileAsync({ name: 'api.fetch.user' })
 *   async fetchUser(userId: string) {
 *     return await this.http.get(`/users/${userId}`).toPromise();
 *   }
 *
 *   @ProfileAsync({ tags: { endpoint: 'search' } })
 *   async search(query: string) {
 *     return await this.elasticsearch.search(query);
 *   }
 * }
 * ```
 *
 * @remarks
 * - Skips profiling silently if PyroscopeService is not injected
 * - Skips profiling if profiling is disabled in config
 * - Guarantees async/await handling for accurate timing
 */
export function ProfileAsync(options?: {
	name?: string;
	tags?: Record<string, string>;
}): MethodDecorator {
	return function(target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
		const originalMethod = descriptor.value as TAnyFunction;
		const methodName = String(propertyKey);

		descriptor.value = async function(this: { pyroscopeService?: PyroscopeService }, ...args: unknown[]): Promise<unknown> {
			const { pyroscopeService } = this;

			// PyroscopeService not injected — skip profiling silently
			if (!pyroscopeService) {
				return await originalMethod.apply(this, args);
			}

			if (!pyroscopeService.isEnabled()) {
				return await originalMethod.apply(this, args);
			}

			const targetConstructorName = (target as { constructor: { name: string } }).constructor.name;
			const profileName = options?.name ?? `${targetConstructorName}.${methodName}`;
			const context: IProfileContext = {
				functionName: profileName,
				className: targetConstructorName,
				methodName,
				startTime: Date.now(),
				...(options?.tags && { tags: options.tags }),
			};

			pyroscopeService.startProfiling(context);

			try {
				const result = await originalMethod.apply(this, args);

				// Stop profiling on successful async completion
				pyroscopeService.stopProfiling(context);
				return result;
			} catch (error) {
				context.error = error as Error;
				pyroscopeService.stopProfiling(context);
				throw error;
			}
		};

		return descriptor;
	};
}
