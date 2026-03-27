/** Internal token for raw (unsanitized) options — includes sensitive auth fields. Not re-exported from the public API. */
export const NATS_MODULE_OPTIONS_RAW = 'NATS_MODULE_OPTIONS_RAW';

/** Public token for sanitized NATS options (credentials stripped). Injectable by consumers. */
export const NATS_MODULE_OPTIONS = 'NATS_MODULE_OPTIONS';

/** Metadata key for the @Subscribe decorator. */
export const NATS_SUBSCRIBE_METADATA: unique symbol = Symbol('NATS_SUBSCRIBE_METADATA');
