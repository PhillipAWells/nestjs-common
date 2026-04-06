export { NatsModule } from './nats.module.js';
export { NatsService } from './nats.service.js';
export { NatsSubscriberRegistry } from './subscriber-registry.service.js';
export { NATS_MODULE_OPTIONS, NATS_SUBSCRIBE_METADATA } from './nats.constants.js';
export type {
	TNatsModuleOptions,
	INatsModuleAsyncOptions,
	INatsOptionsFactory,
} from './nats.interfaces.js';
export { Subscribe } from './decorators/subscribe.decorator.js';
export type { INatsSubscribeOptions } from './decorators/subscribe.decorator.js';
export { InjectNatsOptions } from './decorators/inject-nats-options.decorator.js';
