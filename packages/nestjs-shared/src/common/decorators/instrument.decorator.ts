import type { InstrumentationRegistry } from '../registry/instrumentation-registry.js';

/**
 * Options for the @Instrument() method decorator
 *
 * Configures automatic timing, counter, and error tracking for decorated methods.
 * Metrics are automatically registered on first invocation.
 *
 * @example
 * ```typescript
 * @Instrument({
 *   timing: 'user_service_find_by_id_seconds',
 *   counters: ['user_service_find_by_id_success'],
 *   errorCounters: ['user_service_find_by_id_error'],
 *   labels: (userId: string) => ({ userId }),
 * })
 * async findById(userId: string): Promise<User> {
 *   // Implementation
 * }
 * ```
 */
export interface InstrumentOptions {
	/**
	 * Name of the histogram metric to record method timing (in seconds).
	 * If provided, timing will be recorded for all invocations.
	 *
	 * @optional
	 */
	timing?: string;

	/**
	 * Counter metric names to increment on successful completion.
	 * Incremented after the method returns (or resolves for async).
	 *
	 * @optional
	 */
	counters?: string[];

	/**
	 * Counter metric names to increment on exception.
	 * Incremented if the method throws or rejects.
	 *
	 * @optional
	 */
	errorCounters?: string[];

	/**
	 * Static labels to attach to all recorded metrics, or a function that extracts labels
	 * from method arguments.
	 *
	 * If a function, it receives the argument array and returns a Record of label values.
	 * Static labels (object) are always used. Function labels are computed per invocation.
	 *
	 * @optional
	 */
	labels?: Record<string, string | number> | ((...args: unknown[]) => Record<string, string | number>);
}

/**
 * Module-level singleton holder for InstrumentationRegistry.
 *
 * The @Instrument() decorator uses this holder to access the registry
 * without requiring direct DI into every decorated method.
 *
 * Set during application bootstrap by CommonModule.onModuleInit().
 *
 * @example
 * ```typescript
 * // In CommonModule.onModuleInit()
 * InstrumentationRegistryHolder.setInstance(this.registry);
 * ```
 */
export class InstrumentationRegistryHolder {
	/**
	 * Singleton instance of InstrumentationRegistry
	 * @private
	 */
	private static instance: InstrumentationRegistry | null = null;

	/**
	 * Set the singleton instance.
	 * Called during application bootstrap.
	 *
	 * @param registry - The InstrumentationRegistry instance
	 */
	public static setInstance(registry: InstrumentationRegistry): void {
		InstrumentationRegistryHolder.instance = registry;
	}

	/**
	 * Get the singleton instance.
	 *
	 * @returns The InstrumentationRegistry instance, or null if not yet set
	 */
	public static getInstance(): InstrumentationRegistry | null {
		return InstrumentationRegistryHolder.instance;
	}
}

/**
 * Method decorator for automatic metrics instrumentation.
 *
 * Automatically records method timing (histogram), success counters, and error counters
 * using the InstrumentationRegistry. Metric descriptors are auto-registered on first use.
 *
 * Supports both synchronous and asynchronous (Promise-returning) methods.
 *
 * @param options - Instrumentation configuration (timing, counters, errorCounters, labels)
 * @returns MethodDecorator
 *
 * @throws Error if a metric name is not registered (only if registry is available)
 * @throws The original error if the decorated method throws/rejects
 *
 * @example
 * ```typescript
 * class UserService {
 *   @Instrument({
 *     timing: 'user_service_create_duration_seconds',
 *     counters: ['user_service_create_total'],
 *     errorCounters: ['user_service_create_errors'],
 *     labels: { service: 'user' },
 *   })
 *   async create(userData: CreateUserDto): Promise<User> {
 *     return this.repository.save(userData);
 *   }
 *
 *   @Instrument({
 *     timing: 'user_service_find_by_id_duration_seconds',
 *     counters: ['user_service_find_by_id_total'],
 *     errorCounters: ['user_service_find_by_id_errors'],
 *     labels: (id: string) => ({ userId: id }),
 *   })
 *   async findById(id: string): Promise<User | null> {
 *     return this.repository.findOne(id);
 *   }
 * }
 * ```
 */
export function Instrument(options: InstrumentOptions): MethodDecorator {
	return (target: any, propertyKey: string | symbol | undefined, descriptor: PropertyDescriptor): PropertyDescriptor => {
		const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

		descriptor.value = function instrumentMethod(this: any, ...args: unknown[]): unknown {
			// Resolve labels: static object or computed from arguments
			const labels =
				typeof options.labels === 'function'
					? options.labels(...args)
					: options.labels ?? {};

			// Get registry from singleton holder
			const registry = InstrumentationRegistryHolder.getInstance();

			// If registry not available (e.g., during early bootstrap), just call original
			if (!registry) {
				return originalMethod.apply(this, args);
			}

			// Auto-register metric descriptors on first invocation
			if (options.timing) {
				registry.registerDescriptor({
					name: options.timing,
					type: 'histogram',
					help: `Duration of ${String(propertyKey)}`,
					labelNames: Object.keys(labels),
					unit: 'seconds',
				});
			}

			for (const counterName of options.counters ?? []) {
				registry.registerDescriptor({
					name: counterName,
					type: 'counter',
					help: `${String(propertyKey)} invocation count`,
					labelNames: Object.keys(labels),
				});
			}

			for (const errorCounterName of options.errorCounters ?? []) {
				registry.registerDescriptor({
					name: errorCounterName,
					type: 'counter',
					help: `${String(propertyKey)} error count`,
					labelNames: Object.keys(labels),
				});
			}

			// Record start time
			const startTime = performance.now();

			/**
			 * Handle successful completion.
			 * Records timing and success counters.
			 */
			const handleSuccess = (): void => {
				// eslint-disable-next-line no-magic-numbers
				const durationSeconds = (performance.now() - startTime) / 1000; // Convert to seconds

				if (options.timing) {
					registry.recordMetric(options.timing, durationSeconds, labels);
				}

				for (const counterName of options.counters ?? []) {
					registry.recordMetric(counterName, 1, labels);
				}
			};

			/**
			 * Handle error.
			 * Records error counters and rethrows the error.
			 */
			const handleError = (err: unknown): never => {
				for (const errorCounterName of options.errorCounters ?? []) {
					registry.recordMetric(errorCounterName, 1, labels);
				}

				throw err; // Always rethrow original error
			};

			try {
				const result = originalMethod.apply(this, args);

				// Check if result is a Promise (async method)
				if (result instanceof Promise) {
					return result.then(
						(value) => {
							handleSuccess();
							return value;
						},
						(err) => handleError(err),
					);
				}

				// Synchronous method
				handleSuccess();
				return result;
			} catch (err) {
				return handleError(err);
			}
		};

		return descriptor;
	};
}
