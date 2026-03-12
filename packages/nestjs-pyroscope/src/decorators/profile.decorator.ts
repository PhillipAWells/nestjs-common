import { PyroscopeService } from '../service.js';
import { IProfileContext } from '../interfaces/profiling.interface.js';

type AnyFunction = (...args: unknown[]) => unknown;

/**
 * Class-level decorator for profiling all methods in a class
 */
export function Profile(options?: { tags?: Record<string, string> }): ClassDecorator {
	return function(target: object) {
		const proto = (target as { prototype: Record<string, unknown> }).prototype;
		const originalMethods = Object.getOwnPropertyNames(proto);
		const targetName = (target as { name: string }).name;

		for (const methodName of originalMethods) {
			if (methodName === 'constructor' || typeof proto[methodName] !== 'function') {
				continue;
			}

			const originalMethod = proto[methodName] as AnyFunction;

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
 * Method-level decorator for profiling specific methods
 */
export function ProfileMethod(options?: {
	name?: string;
	tags?: Record<string, string>;
}): MethodDecorator {
	return function(target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
		const originalMethod = descriptor.value as AnyFunction;
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
 * Decorator for async methods with proper timing
 */
export function ProfileAsync(options?: {
	name?: string;
	tags?: Record<string, string>;
}): MethodDecorator {
	return function(target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
		const originalMethod = descriptor.value as AnyFunction;
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
