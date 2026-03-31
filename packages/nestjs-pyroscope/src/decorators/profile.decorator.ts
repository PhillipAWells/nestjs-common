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
		const Proto = (target as { prototype: Record<string, unknown> }).prototype;
		const OriginalMethods = Object.getOwnPropertyNames(Proto);
		const TargetName = (target as { name: string }).name;

		for (const MethodName of OriginalMethods) {
			if (MethodName === 'constructor' || typeof Proto[MethodName] !== 'function') {
				continue;
			}

			const OriginalMethod = Proto[MethodName] as TAnyFunction;

			Proto[MethodName] = function(this: { pyroscopeService?: PyroscopeService }, ...args: unknown[]): unknown {
				const { pyroscopeService } = this;

				// PyroscopeService not injected — skip profiling silently
				if (!pyroscopeService) {
					return OriginalMethod.apply(this, args);
				}

				if (!pyroscopeService.IsEnabled()) {
					return OriginalMethod.apply(this, args);
				}

				const Context: IProfileContext = {
					functionName: `${TargetName}.${MethodName}`,
					className: TargetName,
					methodName: MethodName,
					startTime: Date.now(),
					...(options?.tags && { tags: options.tags }),
				};

				pyroscopeService.StartProfiling(Context);

				try {
					const Result = OriginalMethod.apply(this, args);

					// Handle async methods (Promises)
					if (Result instanceof Promise) {
						return Result
							.then((value) => {
								pyroscopeService.StopProfiling(Context);
								return value;
							})
							.catch((error) => {
								Context.error = error as Error;
								pyroscopeService.StopProfiling(Context);
								throw error;
							});
					}

					// Handle synchronous methods
					pyroscopeService.StopProfiling(Context);
					return Result;
				} catch (error) {
					Context.error = error as Error;
					pyroscopeService.StopProfiling(Context);
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
		const OriginalMethod = descriptor.value as TAnyFunction;
		const MethodName = String(propertyKey);

		descriptor.value = function(this: { pyroscopeService?: PyroscopeService }, ...args: unknown[]): unknown {
			const { pyroscopeService } = this;

			// PyroscopeService not injected — skip profiling silently
			if (!pyroscopeService) {
				return OriginalMethod.apply(this, args);
			}

			if (!pyroscopeService.IsEnabled()) {
				return OriginalMethod.apply(this, args);
			}

			const TargetConstructorName = (target as { constructor: { name: string } }).constructor.name;
			const ProfileName = options?.name ?? `${TargetConstructorName}.${MethodName}`;
			const Context: IProfileContext = {
				functionName: ProfileName,
				className: TargetConstructorName,
				methodName: MethodName,
				startTime: Date.now(),
				...(options?.tags && { tags: options.tags }),
			};

			pyroscopeService.StartProfiling(Context);

			try {
				const Result = OriginalMethod.apply(this, args);

				// Handle async methods (Promises)
				if (Result instanceof Promise) {
					return Result
						.then((value) => {
							pyroscopeService.StopProfiling(Context);
							return value;
						})
						.catch((error) => {
							Context.error = error as Error;
							pyroscopeService.StopProfiling(Context);
							throw error;
						});
				}

				// Handle synchronous methods
				pyroscopeService.StopProfiling(Context);
				return Result;
			} catch (error) {
				Context.error = error as Error;
				pyroscopeService.StopProfiling(Context);
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
		const OriginalMethod = descriptor.value as TAnyFunction;
		const MethodName = String(propertyKey);

		descriptor.value = async function(this: { pyroscopeService?: PyroscopeService }, ...args: unknown[]): Promise<unknown> {
			const { pyroscopeService } = this;

			// PyroscopeService not injected — skip profiling silently
			if (!pyroscopeService) {
				return await OriginalMethod.apply(this, args);
			}

			if (!pyroscopeService.IsEnabled()) {
				return await OriginalMethod.apply(this, args);
			}

			const TargetConstructorName = (target as { constructor: { name: string } }).constructor.name;
			const ProfileName = options?.name ?? `${TargetConstructorName}.${MethodName}`;
			const Context: IProfileContext = {
				functionName: ProfileName,
				className: TargetConstructorName,
				methodName: MethodName,
				startTime: Date.now(),
				...(options?.tags && { tags: options.tags }),
			};

			pyroscopeService.StartProfiling(Context);

			try {
				const Result = await OriginalMethod.apply(this, args);

				// Stop profiling on successful async completion
				pyroscopeService.StopProfiling(Context);
				return Result;
			} catch (error) {
				Context.error = error as Error;
				pyroscopeService.StopProfiling(Context);
				throw error;
			}
		};

		return descriptor;
	};
}
