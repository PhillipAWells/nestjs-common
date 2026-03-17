import type { DynamicModule, InjectionToken, OptionalFactoryDependency, Provider, Type } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { NatsService } from './nats.service.js';
import { NatsSubscriberRegistry } from './subscriber-registry.service.js';
import { NATS_MODULE_OPTIONS, NATS_MODULE_OPTIONS_RAW } from './nats.constants.js';
import type { NatsModuleAsyncOptions, NatsModuleOptions, NatsOptionsFactory } from './nats.interfaces.js';

/** Sensitive option keys stripped from the publicly injectable options token. */
const SENSITIVE_OPTION_KEYS: ReadonlyArray<keyof NatsModuleOptions> = [
	'user',
	'pass',
	'token',
	'authenticator',
];

function sanitizeOptions(options: NatsModuleOptions): Partial<NatsModuleOptions> {
	return Object.fromEntries(
		Object.entries(options).filter(([key]) => !SENSITIVE_OPTION_KEYS.includes(key as keyof NatsModuleOptions)),
	) as Partial<NatsModuleOptions>;
}

/** Generic shape for forRootAsync() options. */
interface AsyncModuleOptions<T, F = unknown> {
	useFactory?: (...args: unknown[]) => T | Promise<T>;
	useClass?: Type<F>;
	useExisting?: Type<F>;
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
}

/** Creates the single async options provider for a forRootAsync() module. */
function createAsyncOptionsProvider<T, F>(
	options: AsyncModuleOptions<T, F>,
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
	const factoryToken = options.useExisting ?? options.useClass;
	if (factoryToken === undefined) {
		throw new Error(
			'Invalid async module options: must specify useFactory, useClass, or useExisting.',
		);
	}
	return {
		provide: token,
		useFactory: factoryFn,
		inject: [factoryToken],
	};
}

/** Creates the full provider array for a forRootAsync() module. */
function createAsyncProviders<T, F>(
	options: AsyncModuleOptions<T, F>,
	token: InjectionToken,
	factoryFn: (factory: F) => T | Promise<T>,
): Provider[] {
	if (options.useExisting !== undefined || options.useFactory !== undefined) {
		return [createAsyncOptionsProvider(options, token, factoryFn)];
	}
	if (options.useClass !== undefined) {
		return [
			createAsyncOptionsProvider(options, token, factoryFn),
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
	public static forRoot(options: NatsModuleOptions, isGlobal?: boolean): DynamicModule {
		return {
			module: NatsModule,
			global: isGlobal ?? false,
			imports: [DiscoveryModule],
			providers: [
				{ provide: NATS_MODULE_OPTIONS_RAW, useValue: options },
				{ provide: NATS_MODULE_OPTIONS, useValue: sanitizeOptions(options) },
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
	public static forRootAsync(options: NatsModuleAsyncOptions, isGlobal?: boolean): DynamicModule {
		const asyncProviders = createAsyncProviders(
			options,
			NATS_MODULE_OPTIONS_RAW,
			(factory: NatsOptionsFactory): NatsModuleOptions | Promise<NatsModuleOptions> =>
				factory.createNatsOptions(),
		);
		return {
			module: NatsModule,
			global: isGlobal ?? false,
			imports: [DiscoveryModule, ...(options.imports ?? [])],
			providers: [
				...asyncProviders,
				{
					provide: NATS_MODULE_OPTIONS,
					useFactory: (rawOptions: NatsModuleOptions): Partial<NatsModuleOptions> =>
						sanitizeOptions(rawOptions),
					inject: [NATS_MODULE_OPTIONS_RAW],
				},
				NatsService,
				NatsSubscriberRegistry,
			],
			exports: [NatsService, NatsSubscriberRegistry, NATS_MODULE_OPTIONS],
		};
	}
}
