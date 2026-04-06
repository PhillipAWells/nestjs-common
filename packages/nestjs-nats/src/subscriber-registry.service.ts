import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { Msg } from '@nats-io/transport-node';
import { NATS_SUBSCRIBE_METADATA } from './nats.constants.js';
import type { INatsSubscribeOptions } from './decorators/subscribe.decorator.js';
import { NatsService } from './nats.service.js';
import { NatsLogger } from './logger.js';

/** Minimal interface for provider/controller wrappers returned by DiscoveryService. */
interface IProviderWrapper {
	instance: unknown;
}

/**
 * Auto-discovers NestJS providers and controllers decorated with @Subscribe
 * and registers them as NATS subscription handlers via NatsService.
 *
 * This service runs during module initialization (after NatsService connects).
 * It uses NestJS DiscoveryService and MetadataScanner to find all methods
 * decorated with @Subscribe and registers them.
 *
 * Note: NestJS initializes providers in constructor-dependency order.
 * Because NatsSubscriberRegistry takes NatsService as a constructor argument,
 * NestJS creates and initializes NatsService first — so NatsService.onModuleInit()
 * (which establishes the connection) is guaranteed to complete before
 * NatsSubscriberRegistry.onModuleInit() (which registers handlers) runs.
 */
@Injectable()
export class NatsSubscriberRegistry implements OnModuleInit {
	private readonly Logger: NatsLogger;
	private readonly DiscoveryService: DiscoveryService;
	private readonly MetadataScanner: MetadataScanner;
	private readonly Reflector: Reflector;
	private readonly NatsService: NatsService;

	constructor(
		discoveryService: DiscoveryService,
		metadataScanner: MetadataScanner,
		reflector: Reflector,
		natsService: NatsService,
	) {
		this.Logger = new NatsLogger(NatsSubscriberRegistry.name);
		this.DiscoveryService = discoveryService;
		this.MetadataScanner = metadataScanner;
		this.Reflector = reflector;
		this.NatsService = natsService;
	}

	public onModuleInit(): void {
		const Wrappers: IProviderWrapper[] = [
			...this.DiscoveryService.getProviders(),
			...this.DiscoveryService.getControllers(),
		];

		for (const Wrapper of Wrappers) {
			const { instance } = Wrapper;
			if (instance === null || instance === undefined || typeof instance !== 'object') {
				continue;
			}

			const Prototype = Object.getPrototypeOf(instance) as Record<string, unknown>;
			const MethodNames = this.MetadataScanner.getAllMethodNames(Prototype);

			for (const MethodName of MethodNames) {
				const Handler = Prototype[MethodName];
				if (typeof Handler !== 'function') {
					continue;
				}

				const Meta = this.Reflector.get<INatsSubscribeOptions | undefined>(
					NATS_SUBSCRIBE_METADATA,
					Handler as (...args: unknown[]) => unknown,
				);

				if (Meta !== null && Meta !== undefined) {
					this.RegisterHandler(
						instance as Record<string, (...args: unknown[]) => unknown>,
						MethodName,
						Meta,
					);
				}
			}
		}
	}

	private RegisterHandler(
		instance: Record<string, (...args: unknown[]) => unknown>,
		methodName: string,
		options: INatsSubscribeOptions,
	): void {
		const BoundHandler = instance[methodName].bind(instance) as (msg: Msg) => Promise<void> | void;
		this.NatsService.Subscribe(options.subject, BoundHandler, {
			queue: options.queue,
		});
		this.Logger.Info(
			`Registered handler "${methodName}" for NATS subject "${options.subject}"${options.queue !== undefined ? ` [queue: ${options.queue}]` : ''}`,
		);
	}
}
