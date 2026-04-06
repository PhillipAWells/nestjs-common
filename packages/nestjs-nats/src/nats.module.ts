import type { DynamicModule, InjectionToken, OptionalFactoryDependency, Provider, Type } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { NatsService } from './nats.service.js';
import { NatsSubscriberRegistry } from './subscriber-registry.service.js';
import { NATS_MODULE_OPTIONS, NATS_MODULE_OPTIONS_RAW } from './nats.constants.js';
import type { INatsModuleAsyncOptions, TNatsModuleOptions, INatsOptionsFactory } from './nats.interfaces.js';

/** Sensitive option keys stripped from the publicly injectable options token. */
const SENSITIVE_OPTION_KEYS: ReadonlyArray<keyof TNatsModuleOptions> = [
	'user',
	'pass',
	'token',
	'authenticator',
];

function SanitizeOptions(options: TNatsModuleOptions): Partial<TNatsModuleOptions> {
	return Object.fromEntries(
		Object.entries(options).filter(([key]: [string, unknown]): boolean => !SENSITIVE_OPTION_KEYS.includes(key as keyof TNatsModuleOptions)),
	) as Partial<TNatsModuleOptions>;
}

/** Generic shape for forRootAsync() options. */
interface IAsyncModuleOptions<T, F = unknown> {
	useFactory?: (...args: unknown[]) => T | Promise<T>;
	useClass?: Type<F>;
	useExisting?: Type<F>;
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
}

/** Creates the single async options provider for a forRootAsync() module. */
function CreateAsyncOptionsProvider<T, F>(
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

/** Creates the full provider array for a forRootAsync() module. */
function CreateAsyncProviders<T, F>(
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

/**
 * NestJS module for NATS pub/sub integration.
 *
 * Provides NatsService for publishing messages, subscribing to subjects,
 * and request-reply patterns. Also provides NatsSubscriberRegistry for
 * automatic discovery of @Subscribe-decorated handler methods.
 *
 * Credentials (user, pass, token, authenticator) are sanitized from the
 * publicly injectable NATS_MODULE_OPTIONS token to prevent accidental exposure.
 *
 * @example
 * ```typescript
 * // Synchronous
 * NatsModule.forRoot({ servers: 'nats://localhost:4222' })
 *
 * // Asynchronous
 * NatsModule.forRootAsync({
 *   imports: [ConfigModule],
 *   inject: [ConfigService],
 *   useFactory: (config: ConfigService) => ({
 *     servers: config.get('NATS_SERVERS'),
 *     user: config.get('NATS_USER'),
 *     pass: config.get('NATS_PASS'),
 *   }),
 * })
 * ```
 */
@Module({})
export class NatsModule {
	/**
	 * Register NatsModule synchronously.
	 * @param options - NATS connection options (extends nats ConnectionOptions)
	 * @param isGlobal - Register as a global module (default: false)
	 */
	public static ForRoot(options: TNatsModuleOptions, isGlobal?: boolean): DynamicModule {
		return {
			module: NatsModule,
			global: isGlobal ?? false,
			imports: [DiscoveryModule],
			providers: [
				{ provide: NATS_MODULE_OPTIONS_RAW, useValue: options },
				{ provide: NATS_MODULE_OPTIONS, useValue: SanitizeOptions(options) },
				NatsService,
				NatsSubscriberRegistry,
			],
			exports: [NatsService, NatsSubscriberRegistry, NATS_MODULE_OPTIONS],
		};
	}

	/**
	 * Register NatsModule asynchronously using a factory, class, or existing provider.
	 * @param options - Async configuration strategy (useFactory, useClass, or useExisting)
	 * @param isGlobal - Register as a global module (default: false)
	 */
	public static ForRootAsync(options: INatsModuleAsyncOptions, isGlobal?: boolean): DynamicModule {
		const AsyncProviders = CreateAsyncProviders(
			options,
			NATS_MODULE_OPTIONS_RAW,
			(factory: INatsOptionsFactory): TNatsModuleOptions | Promise<TNatsModuleOptions> =>
				factory.createNatsOptions(),
		);
		return {
			module: NatsModule,
			global: isGlobal ?? false,
			imports: [DiscoveryModule, ...(options.imports ?? [])],
			providers: [
				...AsyncProviders,
				{
					provide: NATS_MODULE_OPTIONS,
					useFactory: (rawOptions: TNatsModuleOptions): Partial<TNatsModuleOptions> =>
						SanitizeOptions(rawOptions),
					inject: [NATS_MODULE_OPTIONS_RAW],
				},
				NatsService,
				NatsSubscriberRegistry,
			],
			exports: [NatsService, NatsSubscriberRegistry, NATS_MODULE_OPTIONS],
		};
	}
}
