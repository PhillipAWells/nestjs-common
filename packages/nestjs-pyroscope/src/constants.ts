/**
 * Dependency injection token for accessing the Pyroscope configuration.
 *
 * Used internally by PyroscopeService and other services to retrieve the configuration
 * from the NestJS module container.
 *
 * @internal
 */
export const PYROSCOPE_CONFIG_TOKEN = 'PYROSCOPE_CONFIG_TOKEN';
