/**
 * Test Module Factory
 *
 * Provides reusable patterns for creating test modules with common providers
 * Simplifies setup of NestJS test modules with mocked dependencies
 */
import { Module } from '@nestjs/common';
import { CACHE_PROVIDER } from '../../interfaces/cache-provider.interface.js';
import { MockCacheProvider } from '../mocks/cache-provider.mock.js';
import { AppLogger } from '../../services/logger.service.js';

/**
 * Configuration for test module setup
 */
export interface TestModuleConfig {
	/**
	 * Whether to include cache provider (default: true)
	 */
	includeCache?: boolean;

	/**
	 * Whether to include app logger (default: true)
	 */
	includeLogger?: boolean;

	/**
	 * Additional providers to include
	 */
	additionalProviders?: any[];

	/**
	 * Additional imports to include
	 */
	additionalImports?: any[];
}

/**
 * Create a test module with common providers
 *
 * @param config Test module configuration
 * @returns Dynamic module for testing
 *
 * @example
 * ```typescript
 * const module = await createTestModule({
 *   includeCache: true,
 *   additionalProviders: [MyService]
 * }).compile();
 * ```
 */
export function createTestModuleConfig(config: TestModuleConfig = {}) {
	const {
		includeCache = true,
		includeLogger = true,
		additionalProviders = [],
		additionalImports = [],
	} = config;

	const providers: any[] = [];
	const imports: any[] = [];

	// Add mock cache provider
	if (includeCache) {
		providers.push(MockCacheProvider);
		providers.push({
			provide: CACHE_PROVIDER,
			useClass: MockCacheProvider,
		});
	}

	// Add logger (can be mocked if needed)
	if (includeLogger) {
		providers.push({
			provide: AppLogger,
			useValue: {
				debug: jest.fn(),
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				createContextualLogger: jest.fn(() => ({
					debug: jest.fn(),
					info: jest.fn(),
					warn: jest.fn(),
					error: jest.fn(),
				})),
			},
		});
	}

	// Add additional providers and imports
	providers.push(...additionalProviders);
	imports.push(...additionalImports);

	return {
		imports,
		providers,
		exports: providers.filter(p => typeof p === 'function' || p.provide),
	};
}

/**
 * Decorator for test modules that includes common providers
 *
 * @example
 * ```typescript
 * @TestModule({
 *   additionalProviders: [MyService]
 * })
 * class TestModuleClass {}
 * ```
 */
export function TestModule(config: TestModuleConfig = {}) {
	return function(target: any) {
		const moduleConfig = createTestModuleConfig(config);
		Module(moduleConfig)(target);
		return target;
	};
}
