import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { BaseCacheService } from './services/base-cache.service.js';

/**
 * Cache service providing Redis-based caching functionality
 *
 * Extends BaseCacheService to provide HTTP-specific cache key generation
 * and contextual logging. Manages in-memory and Redis-backed caching of
 * application data with configurable TTL and invalidation strategies.
 *
 * @example
 * ```typescript
 * // Inject into service
 * constructor(private CacheService: CacheService) {}
 *
 * // Get or set value
 * const value = await this.CacheService.get('key');
 * await this.CacheService.set('key', { data: 'value' }, 300);
 * ```
 *
 * @see BaseCacheService - Base class with core functionality
 * @see CacheModule - Module that provides this service
 */
@Injectable()
export class CacheService extends BaseCacheService {
	constructor(moduleRef: ModuleRef) {
		super(moduleRef);
		// Initialize contextual logger after lazy dependencies are ready
		this.InitializeContextualLogger();
	}

	protected GenerateCacheKey(args: any): string {
		// HTTP-specific key generation - simple string conversion
		if (typeof args === 'string') {
			return args;
		}
		if (typeof args === 'object' && args !== null) {
			return JSON.stringify(args);
		}
		return String(args);
	}
}
