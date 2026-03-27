/**
 * Shared Testing Module
 *
 * A drop-in NestJS testing module that provides mock implementations of
 * nestjs-shared's core providers. Import in Test.createTestingModule() to
 * satisfy SharedModule dependencies without any real infrastructure.
 *
 * @example
 * ```typescript
 * const moduleRef = await Test.createTestingModule({
 *   imports: [SharedTestingModule],
 *   providers: [MyService],
 * }).compile();
 * ```
 */
import { Module } from '@nestjs/common';
import { AppLogger } from '../common/services/logger.service.js';
import { CACHE_PROVIDER } from '../common/interfaces/cache-provider.interface.js';
import { MockAppLogger } from './mocks/app-logger.mock.js';
import { MockCacheProvider } from './mocks/cache-provider.mock.js';

@Module({
	providers: [
		MockCacheProvider,
		{
			provide: CACHE_PROVIDER,
			useExisting: MockCacheProvider,
		},
		MockAppLogger,
		{
			provide: AppLogger,
			useExisting: MockAppLogger,
		},
	],
	exports: [
		MockCacheProvider,
		CACHE_PROVIDER,
		MockAppLogger,
		AppLogger,
	],
})
export class SharedTestingModule {}
