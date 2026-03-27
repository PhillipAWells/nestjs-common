/**
 * Mock Cache Provider for Testing
 *
 * Provides in-memory cache implementation for unit tests
 * Allows testing auth module without Redis setup
 */
import { Injectable } from '@nestjs/common';
import type { ICacheProvider } from '../../interfaces/cache-provider.interface.js';

/**
 * In-memory mock cache provider for testing
 */
@Injectable()
export class MockCacheProvider implements ICacheProvider {
	private readonly store: Map<string, { value: any; expiresAt?: number }> = new Map();

	/**
	 * Set a cache value with optional TTL
	 */
	// eslint-disable-next-line @typescript-eslint/promise-function-async
	set(key: string, value: any, ttlSeconds?: number): Promise<void> {
		const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;
		this.store.set(key, { value, expiresAt });
		return Promise.resolve();
	}

	/**
	 * Get a cache value
	 */
	// eslint-disable-next-line @typescript-eslint/promise-function-async
	get(key: string): Promise<any> {
		const entry = this.store.get(key);
		if (!entry) {
			return Promise.resolve(null);
		}

		// Check expiration
		if (entry.expiresAt && Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return Promise.resolve(null);
		}

		return Promise.resolve(entry.value);
	}

	/**
	 * Check if a key exists in cache
	 */
	// eslint-disable-next-line @typescript-eslint/promise-function-async
	exists(key: string): Promise<boolean> {
		const entry = this.store.get(key);
		if (!entry) {
			return Promise.resolve(false);
		}

		// Check expiration
		if (entry.expiresAt && Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return Promise.resolve(false);
		}

		return Promise.resolve(true);
	}

	/**
	 * Delete a cache value
	 */
	// eslint-disable-next-line @typescript-eslint/promise-function-async
	del(key: string): Promise<void> {
		this.store.delete(key);
		return Promise.resolve();
	}

	/**
	 * Clear all cache values
	 */
	// eslint-disable-next-line @typescript-eslint/promise-function-async
	clear(): Promise<void> {
		this.store.clear();
		return Promise.resolve();
	}

	/**
	 * Helper: Get cache statistics for testing
	 */
	getStats(): { size: number; keys: string[] } {
		return {
			size: this.store.size,
			keys: Array.from(this.store.keys()),
		};
	}

	/**
	 * Helper: Manually expire all entries (for testing)
	 */
	expireAll(): void {
		this.store.forEach(entry => {
			entry.expiresAt = Date.now() - 1; // Already expired
		});
	}
}
