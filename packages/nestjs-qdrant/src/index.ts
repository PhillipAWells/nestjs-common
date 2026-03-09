/**
 * @pawells/nestjs-qdrant
 * NestJS module for Qdrant vector database integration
 *
 * @example
 * ```typescript
 * import { QdrantModule } from '@pawells/nestjs-qdrant';
 *
 * @Module({
 *   imports: [
 *     QdrantModule.forRoot({
 *       url: 'http://localhost:6333',
 *       apiKey: 'your-api-key'
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 */

export { QdrantModule } from './qdrant.module.js';
export { QdrantService } from './qdrant.service.js';
export { QdrantCollectionService } from './qdrant-collection.service.js';
export {
	QDRANT_CLIENT_TOKEN,
	QDRANT_MODULE_OPTIONS,
	DEFAULT_QDRANT_CLIENT_NAME,
	getQdrantClientToken,
	getQdrantModuleOptionsToken
} from './qdrant.constants.js';
export type { QdrantModuleOptions, QdrantModuleAsyncOptions, QdrantOptionsFactory } from './qdrant.interfaces.js';
export { InjectQdrantClient } from './decorators/inject-qdrant-client.decorator.js';
