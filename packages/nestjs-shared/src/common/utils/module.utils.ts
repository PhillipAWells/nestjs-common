import type { InjectionToken, OptionalFactoryDependency, Provider, Type } from '@nestjs/common';

/**
 * Generic shape for forRootAsync() options.
 *
 * F is the factory interface (e.g. INatsOptionsFactory, QdrantModuleOptionsFactory).
 * T is the resolved options type.
 */
export interface IAsyncModuleOptions<T, F = unknown> {
	useFactory?: (...args: unknown[]) => T | Promise<T>;
	useClass?: Type<F>;
	useExisting?: Type<F>;
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
}

/**
 * Creates the single async options provider (the injection-token → resolved-options
 * mapping) for a forRootAsync() module.
 *
 * @param options    The async options passed to forRootAsync()
 * @param token      Injection token to provide the resolved options under
 * @param factoryFn  Calls the factory method on the options-factory instance,
 *                   e.g. `(f) => f.createNatsOptions()`
 */
export function CreateAsyncOptionsProvider<T, F>(
	options: IAsyncModuleOptions<T, F>,
	token: InjectionToken,
	factoryFn: (factory: F) => T | Promise<T>,
): Provider<T> {
	if (options.useFactory !== undefined) {
		return {
			provide: token,
			useFactory: options.useFactory,
			inject: (options.inject ?? []) as Array<InjectionToken | OptionalFactoryDependency>,
		};
	}
	const FactoryToken = options.useExisting ?? options.useClass;
	if (FactoryToken === undefined) {
		throw new Error(
			'Invalid async module options: must specify useFactory, useClass, or useExisting.',
		);
	}
	return {
		provide: token,
		useFactory: factoryFn,
		inject: [FactoryToken],
	};
}

/**
 * Creates the full provider array for a forRootAsync() module — the options
 * provider plus an optional self-binding for useClass.
 *
 * @param options    The async options passed to forRootAsync()
 * @param token      Injection token to provide the resolved options under
 * @param factoryFn  Calls the factory method on the options-factory instance
 */
export function CreateAsyncProviders<T, F>(
	options: IAsyncModuleOptions<T, F>,
	token: InjectionToken,
	factoryFn: (factory: F) => T | Promise<T>,
): Provider[] {
	if (options.useExisting !== undefined || options.useFactory !== undefined) {
		return [CreateAsyncOptionsProvider(options, token, factoryFn)];
	}
	if (options.useClass !== undefined) {
		return [
			CreateAsyncOptionsProvider(options, token, factoryFn),
			{ provide: options.useClass, useClass: options.useClass },
		];
	}
	throw new Error(
		'Invalid async module options: must specify useFactory, useClass, or useExisting.',
	);
}
