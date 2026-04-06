import { performance } from 'node:perf_hooks';
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
 *   Labels: (userId: string) => ({ userId }),
 * })
 * async findById(userId: string): Promise<IUser> {
 *   // Implementation
 * }
 * ```
 */
export interface IInstrumentOptions {
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
	 * Static Labels to attach to all recorded metrics, or a function that extracts Labels
	 * from method arguments.
	 *
	 * If a function, it receives the argument array and returns a Record of label values.
	 * Static Labels (object) are always used. Function Labels are computed per invocation.
	 *
	 * @optional
	 */
	Labels?: Record<string, string | number> | ((...args: unknown[]) => Record<string, string | number>);
}

/**
 * Module-level singleton holder for InstrumentationRegistry.
 *
 * The @Instrument() decorator uses this holder to access the Registry
 * without requiring direct DI into every decorated method.
 *
 * Set during application bootstrap by CommonModule.onModuleInit().
 *
 * @example
 * ```typescript
 * // In CommonModule.onModuleInit()
 * InstrumentationRegistryHolder.setInstance(this.Registry);
 * ```
 */
export class InstrumentationRegistryHolder {
	/**
	 * Singleton instance of InstrumentationRegistry
	 * @private
	 */
	private static Instance: InstrumentationRegistry | null = null;

	/**
	 * Set the singleton instance.
	 * Called during application bootstrap.
	 *
	 * @param Registry - The InstrumentationRegistry instance
	 */
	public static SetInstance(registry: InstrumentationRegistry): void {
		InstrumentationRegistryHolder.Instance = registry;
	}

	/**
	 * Get the singleton instance.
	 *
	 * @returns The InstrumentationRegistry instance, or null if not yet set
	 */
	public static GetInstance(): InstrumentationRegistry | null {
		return InstrumentationRegistryHolder.Instance;
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
 * @param options - Instrumentation configuration (timing, counters, errorCounters, Labels)
 * @returns MethodDecorator
 *
 * @throws Error if a metric name is not registered (only if Registry is available)
 * @throws The original error if the decorated method throws/rejects
 *
 * @example
 * ```typescript
 * class UserService {
 *   @Instrument({
 *     timing: 'user_service_create_duration_seconds',
 *     counters: ['user_service_create_total'],
 *     errorCounters: ['user_service_create_errors'],
 *     Labels: { service: 'user' },
 *   })
 *   async create(userData: CreateUserDto): Promise<IUser> {
 *     return this.repository.save(userData);
 *   }
 *
 *   @Instrument({
 *     timing: 'user_service_find_by_id_duration_seconds',
 *     counters: ['user_service_find_by_id_total'],
 *     errorCounters: ['user_service_find_by_id_errors'],
 *     Labels: (id: string) => ({ userId: id }),
 *   })
 *   async findById(id: string): Promise<IUser | null> {
 *     return this.repository.findOne(id);
 *   }
 * }
 * ```
 */
export function Instrument(options: IInstrumentOptions): MethodDecorator {
	return (target: any, propertyKey: string | symbol | undefined, descriptor: PropertyDescriptor): PropertyDescriptor => {
		const OriginalMethod = descriptor.value as (...args: unknown[]) => unknown;

		descriptor.value = function InstrumentMethod(this: any, ...args: unknown[]): unknown {
			// Resolve Labels: static object or computed from arguments
			const Labels =
				typeof options.Labels === 'function'
					? options.Labels(...args)
					: options.Labels ?? {};

			// Get Registry from singleton holder
			const Registry = InstrumentationRegistryHolder.GetInstance();

			// If Registry not available (e.g., during early bootstrap), just call original
			if (!Registry) {
				return OriginalMethod.apply(this, args);
			}

			// Auto-register metric descriptors on first invocation
			if (options.timing) {
				Registry.RegisterDescriptor({
					name: options.timing,
					type: 'histogram',
					help: `Duration of ${String(propertyKey)}`,
					labelNames: Object.keys(Labels),
					unit: 'seconds',
				});
			}

			for (const CounterName of options.counters ?? []) {
				Registry.RegisterDescriptor({
					name: CounterName,
					type: 'counter',
					help: `${String(propertyKey)} invocation count`,
					labelNames: Object.keys(Labels),
				});
			}

			for (const ErrorCounterName of options.errorCounters ?? []) {
				Registry.RegisterDescriptor({
					name: ErrorCounterName,
					type: 'counter',
					help: `${String(propertyKey)} error count`,
					labelNames: Object.keys(Labels),
				});
			}

			// Record start time
			const StartTime = performance.now();

			/**
			 * Handle successful completion.
			 * Records timing and success counters.
			 */
			const HandleSuccess = (): void => {
				// eslint-disable-next-line no-magic-numbers
				const DurationSeconds = (performance.now() - StartTime) / 1000; // Convert to seconds

				if (options.timing) {
					Registry.RecordMetric(options.timing, DurationSeconds, Labels);
				}

				for (const CounterName of options.counters ?? []) {
					Registry.RecordMetric(CounterName, 1, Labels);
				}
			};

			/**
			 * Handle error.
			 * Records error counters and rethrows the error.
			 */
			const HandleError = (err: unknown): never => {
				for (const ErrorCounterName of options.errorCounters ?? []) {
					Registry.RecordMetric(ErrorCounterName, 1, Labels);
				}

				throw err; // Always rethrow original error
			};

			try {
				const Result = OriginalMethod.apply(this, args);

				// Check if Result is a Promise (async method)
				if (Result instanceof Promise) {
					return Result.then(
						(value) => {
							HandleSuccess();
							return value;
						},
						(err) => HandleError(err),
					);
				}

				// Synchronous method
				HandleSuccess();
				return Result;
			} catch (err) {
				return HandleError(err);
			}
		};

		return descriptor;
	};
}
