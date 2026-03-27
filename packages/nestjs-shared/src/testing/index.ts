/**
 * @pawells/nestjs-shared/testing
 *
 * Testing utilities for nestjs-shared consumers.
 * Import from '@pawells/nestjs-shared/testing' — never from the main entry point.
 *
 * @example
 * ```typescript
 * import { SharedTestingModule, MockCacheProvider, MockAppLogger } from '@pawells/nestjs-shared/testing';
 * ```
 */
export { MockCacheProvider } from './mocks/cache-provider.mock.js';
export { MockAppLogger } from './mocks/app-logger.mock.js';
export { SharedTestingModule } from './shared-testing.module.js';
