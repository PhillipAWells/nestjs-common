/**
 * Testing utilities and mocks for nestjs-shared
 *
 * Provides reusable test fixtures, mocks, and helpers
 */

// Mocks
export { MockCacheProvider } from './mocks/cache-provider.mock.js';

// Helpers
export { CreateTestModuleConfig as createTestModuleConfig, TestModule, type TestModuleConfig } from './helpers/test-module.factory.js';
