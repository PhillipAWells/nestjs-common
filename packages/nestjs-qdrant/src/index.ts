/**
 * @pawells/nestjs-qdrant
 * NestJS module for Qdrant vector database integration with type-safe client injection.
 *
 * This module provides:
 * - QdrantModule: DynamicModule for synchronous (forRoot) and asynchronous (forRootAsync) setup
 * - QdrantService: Injectable service for accessing the Qdrant client and managing collections
 * - QdrantCollectionService: Collection-scoped operations (obtained via QdrantService.collection())
 * - @InjectQdrantClient: Decorator for direct client injection
 * - Type-safe configuration with support for multiple named clients
 *
 * Security: API keys are automatically sanitized in async configuration. The apiKey is stripped
 * from the publicly injectable options token and is only available to the internal client factory.
 *
 * @example
 * ```typescript
 * import { Module } from '@nestjs/common';
 * import { QdrantModule } from '@pawells/nestjs-qdrant';
 *
 * // Synchronous setup
 * @Module({
 *   imports: [
 *     QdrantModule.forRoot({
 *       url: 'http://localhost:6333',
 *       apiKey: process.env.QDRANT_API_KEY
 *     })
 *   ]
 * })
 * export class AppModule {}
 *
 * // Or async setup
 * @Module({
 *   imports: [
 *     ConfigModule.forRoot(),
 *     QdrantModule.forRootAsync({
 *       imports: [ConfigModule],
 *       inject: [ConfigService],
 *       useFactory: (config: ConfigService) => ({
 *         url: config.get('QDRANT_URL'),
 *         apiKey: config.get('QDRANT_API_KEY')
 *       })
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 *
 * @packageDocumentation
 */

export { QdrantModule } from './qdrant.module.js';
export { QdrantService } from './qdrant.service.js';
export { QdrantCollectionService } from './qdrant-collection.service.js';
export {
	QDRANT_CLIENT_TOKEN,
	QDRANT_MODULE_OPTIONS,
	DEFAULT_QDRANT_CLIENT_NAME,
	GetQdrantClientToken,
	GetQdrantModuleOptionsToken,
} from './qdrant.constants.js';
export type { TQdrantModuleOptions, IQdrantModuleAsyncOptions, IQdrantOptionsFactory } from './qdrant.interfaces.js';
export { InjectQdrantClient } from './decorators/inject-qdrant-client.decorator.js';
