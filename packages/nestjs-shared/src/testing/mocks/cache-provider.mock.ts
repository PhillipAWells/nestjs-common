/**
 * Mock Cache Provider for Testing
 *
 * Provides in-memory cache implementation for unit tests
 * Allows testing auth module without Redis setup
 */
import { Injectable } from '@nestjs/common';
import type { ICacheProvider } from '../../common/interfaces/cache-provider.interface.js';

/**
 * In-memory mock cache provider for testing
 */
@Injectable()
export class MockCacheProvider implements ICacheProvider {
	// eslint-disable-next-line no-magic-numbers
	private static readonly MS_PER_SECOND = 1000;

	private readonly Store: Map<string, { value: any; expiresAt?: number }> = new Map();

	/**
	 * Set a cache value with optional TTL
	 */
	// eslint-disable-next-line @typescript-eslint/promise-function-async, @typescript-eslint/naming-convention
	public set(key: string, value: any, ttlSeconds?: number): Promise<void> {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * MockCacheProvider.MS_PER_SECOND) : undefined;
		this.Store.set(key, { value, expiresAt });
		return Promise.resolve();
	}

	/**
	 * Get a cache value
	 */
	// eslint-disable-next-line @typescript-eslint/promise-function-async, @typescript-eslint/naming-convention
	public get(key: string): Promise<any> {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const entry = this.Store.get(key);
		if (!entry) {
			return Promise.resolve(null);
		}

		// Check expiration
		if (entry.expiresAt && Date.now() > entry.expiresAt) {
			this.Store.delete(key);
			return Promise.resolve(null);
		}

		return Promise.resolve(entry.value);
	}

	/**
	 * Check if a key exists in cache
	 */
	// eslint-disable-next-line @typescript-eslint/promise-function-async, @typescript-eslint/naming-convention
	public exists(key: string): Promise<boolean> {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		const entry = this.Store.get(key);
		if (!entry) {
			return Promise.resolve(false);
		}

		// Check expiration
		if (entry.expiresAt && Date.now() > entry.expiresAt) {
			this.Store.delete(key);
			return Promise.resolve(false);
		}

		return Promise.resolve(true);
	}

	/**
	 * Delete a cache value
	 */
	// eslint-disable-next-line @typescript-eslint/promise-function-async, @typescript-eslint/naming-convention
	public del(key: string): Promise<void> {
		this.Store.delete(key);
		return Promise.resolve();
	}

	/**
	 * Clear all cache values
	 */
	// eslint-disable-next-line @typescript-eslint/promise-function-async, @typescript-eslint/naming-convention
	public clear(): Promise<void> {
		this.Store.clear();
		return Promise.resolve();
	}

	/**
	 * Helper: Get cache statistics for testing
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public getStats(): { size: number; keys: string[] } {
		return {
			size: this.Store.size,
			keys: Array.from(this.Store.keys()),
		};
	}

	/**
	 * Helper: Manually expire all entries (for testing)
	 */
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public expireAll(): void {
		this.Store.forEach(entry => {
			entry.expiresAt = Date.now() - 1; // Already expired
		});
	}
}
