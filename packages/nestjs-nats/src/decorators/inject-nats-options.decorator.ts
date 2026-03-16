import { Inject } from '@nestjs/common';
import { NATS_MODULE_OPTIONS } from '../nats.constants.js';

/**
 * Parameter decorator to inject the sanitized NATS module options.
 * The injected options do not contain sensitive fields (user, pass, token, nkey, authenticator).
 */
export const InjectNatsOptions = (): ReturnType<typeof Inject> => Inject(NATS_MODULE_OPTIONS);
