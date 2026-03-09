import { Injectable } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { BaseCacheService } from './services/base-cache.service.js';

/**
 * Cache service providing Redis-based caching functionality
 */
@Injectable()
export class CacheService extends BaseCacheService {
	constructor(module: ModuleRef) {
		super(module);
		// Initialize contextual logger after lazy dependencies are ready
		this.initializeContextualLogger();
	}

	protected generateCacheKey(args: any): string {
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
