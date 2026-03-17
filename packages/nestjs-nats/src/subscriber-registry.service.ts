import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { Msg } from '@nats-io/transport-node';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { NATS_SUBSCRIBE_METADATA } from './nats.constants.js';
import type { NatsSubscribeOptions } from './decorators/subscribe.decorator.js';
import { NatsService } from './nats.service.js';

/** Minimal interface for provider/controller wrappers returned by DiscoveryService. */
interface ProviderWrapper {
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
	private readonly logger: AppLogger;

	constructor(
		private readonly discoveryService: DiscoveryService,
		private readonly metadataScanner: MetadataScanner,
		private readonly reflector: Reflector,
		private readonly natsService: NatsService,
	) {
		this.logger = new AppLogger(undefined, NatsSubscriberRegistry.name);
	}

	public onModuleInit(): void {
		const wrappers: ProviderWrapper[] = [
			...this.discoveryService.getProviders(),
			...this.discoveryService.getControllers(),
		];

		for (const wrapper of wrappers) {
			const { instance } = wrapper;
			if (instance === null || instance === undefined || typeof instance !== 'object') {
				continue;
			}

			const prototype = Object.getPrototypeOf(instance) as Record<string, unknown>;
			const methodNames = this.metadataScanner.getAllMethodNames(prototype);

			for (const methodName of methodNames) {
				const handler = prototype[methodName];
				if (typeof handler !== 'function') {
					continue;
				}

				const meta = this.reflector.get<NatsSubscribeOptions | undefined>(
					NATS_SUBSCRIBE_METADATA,
					handler as (...args: unknown[]) => unknown,
				);

				if (meta !== null && meta !== undefined) {
					this.registerHandler(
						instance as Record<string, (...args: unknown[]) => unknown>,
						methodName,
						meta,
					);
				}
			}
		}
	}

	private registerHandler(
		instance: Record<string, (...args: unknown[]) => unknown>,
		methodName: string,
		options: NatsSubscribeOptions,
	): void {
		const boundHandler = instance[methodName].bind(instance) as (msg: Msg) => Promise<void> | void;
		this.natsService.subscribe(options.subject, boundHandler, {
			queue: options.queue,
		});
		this.logger.info(
			`Registered handler "${methodName}" for NATS subject "${options.subject}"${options.queue !== undefined ? ` [queue: ${options.queue}]` : ''}`,
		);
	}
}
