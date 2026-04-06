/**
 * Qdrant Client Injection Decorator
 * Provides convenient decorator for injecting Qdrant client instances
 */

import { Inject } from '@nestjs/common';
import { GetQdrantClientToken } from '../qdrant.constants.js';

/**
 * Decorator for injecting a Qdrant client instance.
 * Use this decorator on constructor parameters to receive the QdrantClient via dependency injection.
 *
 * Supports both default and named client instances for multi-tenant scenarios.
 * The client is resolved using `GetQdrantClientToken()` which maps the name to the appropriate token.
 *
 * @param name - Optional client name for named client instances. If not provided, uses the default client.
 * @returns NestJS Inject decorator configured with the appropriate client token
 *
 * @example
 * ```typescript
 * // Single (default) client
 * @Injectable()
 * export class SearchService {
 *   constructor(
 *     @InjectQdrantClient() private readonly Client: QdrantClient
 *   ) {}
 * }
 *
 * // Multiple named clients
 * @Injectable()
 * export class MultiTenantService {
 *   constructor(
 *     @InjectQdrantClient() private readonly defaultClient: QdrantClient,
 *     @InjectQdrantClient('archive') private readonly archiveClient: QdrantClient,
 *     @InjectQdrantClient('backup') private readonly backupClient: QdrantClient
 *   ) {}
 * }
 * ```
 *
 * @throws Error - If the Qdrant client is not registered or the named client does not exist
 */
export const InjectQdrantClient = (name?: string): ReturnType<typeof Inject> =>
	Inject(GetQdrantClientToken(name));
