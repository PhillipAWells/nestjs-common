import { PyroscopeService } from '../service.js';
import { IProfileContext } from '../interfaces/profiling.interface.js';

/**
 * Class-level decorator for profiling all methods in a class
 */
export function Profile(options?: { tags?: Record<string, string> }): ClassDecorator {
	return function(target: any) {
		const originalMethods = Object.getOwnPropertyNames(target.prototype);

		for (const methodName of originalMethods) {
			if (methodName === 'constructor' || typeof target.prototype[methodName] !== 'function') {
				continue;
			}

			const originalMethod = target.prototype[methodName];

			target.prototype[methodName] = function(...args: any[]) {
				const pyroscopeService = (this as any).pyroscopeService as PyroscopeService;

				// PyroscopeService not injected — skip profiling silently
				if (!pyroscopeService) {
					return originalMethod.apply(this, args);
				}

				if (!pyroscopeService.isEnabled()) {
					return originalMethod.apply(this, args);
				}

				const context: IProfileContext = {
					functionName: `${target.name}.${methodName}`,
					className: target.name,
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
	captureArgs?: boolean;
	captureResult?: boolean;
}): MethodDecorator {
	return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;
		const methodName = String(propertyKey);

		descriptor.value = function(...args: any[]) {
			const pyroscopeService = (this as any).pyroscopeService as PyroscopeService;

			// PyroscopeService not injected — skip profiling silently
			if (!pyroscopeService) {
				return originalMethod.apply(this, args);
			}

			if (!pyroscopeService.isEnabled()) {
				return originalMethod.apply(this, args);
			}

			const profileName = options?.name ?? `${target.constructor.name}.${methodName}`;
			const context: IProfileContext = {
				functionName: profileName,
				className: target.constructor.name,
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
	return function(target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;
		const methodName = String(propertyKey);

		descriptor.value = async function(...args: any[]) {
			const pyroscopeService = (this as any).pyroscopeService as PyroscopeService;

			// PyroscopeService not injected — skip profiling silently
			if (!pyroscopeService) {
				return await originalMethod.apply(this, args);
			}

			if (!pyroscopeService.isEnabled()) {
				return await originalMethod.apply(this, args);
			}

			const profileName = options?.name ?? `${target.constructor.name}.${methodName}`;
			const context: IProfileContext = {
				functionName: profileName,
				className: target.constructor.name,
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
