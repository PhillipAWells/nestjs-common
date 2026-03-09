/**
 * Qdrant Client Injection Decorator
 * Provides convenient decorator for injecting Qdrant client
 */

import { Inject } from '@nestjs/common';
import { getQdrantClientToken } from '../qdrant.constants.js';

/**
 * Decorator to inject the Qdrant client instance
 * Use this decorator on constructor parameters to receive the Qdrant client
 *
 * @param name Optional client name for named client instances
 * @returns Decorator function for dependency injection
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   constructor(
 *     @InjectQdrantClient() private readonly qdrantClient: QdrantClient,
 *     @InjectQdrantClient('archive') private readonly archiveClient: QdrantClient
 *   ) {}
 * }
 * ```
 */
export const InjectQdrantClient = (name?: string): ReturnType<typeof Inject> =>
	Inject(getQdrantClientToken(name));
