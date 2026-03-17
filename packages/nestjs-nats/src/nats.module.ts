import { DynamicModule, Module, Provider } from '@nestjs/common';
import type { InjectionToken, OptionalFactoryDependency } from '@nestjs/common';
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
	public static forRoot(options: NatsModuleOptions, isGlobal: boolean = false): DynamicModule {
		return {
			module: NatsModule,
			global: isGlobal,
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
	public static forRootAsync(options: NatsModuleAsyncOptions, isGlobal: boolean = false): DynamicModule {
		const asyncProviders = NatsModule.createAsyncProviders(options);
		return {
			module: NatsModule,
			global: isGlobal,
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

	private static createAsyncProviders(options: NatsModuleAsyncOptions): Provider[] {
		if (options.useExisting !== undefined || options.useFactory !== undefined) {
			return [NatsModule.createAsyncOptionsProvider(options)];
		}
		if (options.useClass !== undefined) {
			return [
				NatsModule.createAsyncOptionsProvider(options),
				{ provide: options.useClass, useClass: options.useClass },
			];
		}
		throw new Error(
			'Invalid NatsModuleAsyncOptions: must provide useFactory, useClass, or useExisting.',
		);
	}

	private static createAsyncOptionsProvider(options: NatsModuleAsyncOptions): Provider {
		if (options.useFactory !== undefined) {
			return {
				provide: NATS_MODULE_OPTIONS_RAW,
				useFactory: options.useFactory,
				inject: (options.inject ?? []) as Array<InjectionToken | OptionalFactoryDependency>,
			};
		}
		const factoryToken = options.useExisting ?? options.useClass;
		if (factoryToken === undefined) {
			throw new Error(
				'Invalid NatsModuleAsyncOptions: must provide useFactory, useClass, or useExisting.',
			);
		}
		return {
			provide: NATS_MODULE_OPTIONS_RAW,
			useFactory: async (factory: NatsOptionsFactory): Promise<NatsModuleOptions> => {
				const opts = await factory.createNatsOptions();
				return opts;
			},
			inject: [factoryToken],
		};
	}
}
