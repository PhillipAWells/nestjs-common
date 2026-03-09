
import { Cache } from 'cache-manager';
import { AppLogger } from '@pawells/nestjs-shared/common';
import { jest } from '@jest/globals';
import { of } from 'rxjs';
import {
	BaseCacheInterceptor,
	CacheKeyGenerator,
	CacheMetadataExtractor,
	CacheContextHandler
} from '../interceptors/base-cache.interceptor.js';

// Mock implementations for testing
class MockCacheKeyGenerator implements CacheKeyGenerator {
	public generate = jest.fn<(context: any, options?: any) => string>().mockReturnValue('test-key');
}

class MockCacheMetadataExtractor implements CacheMetadataExtractor {
	public getCacheDisabled = jest.fn<(context: any) => boolean>().mockReturnValue(false);

	public getCacheTtl = jest.fn<(context: any) => number | undefined>().mockReturnValue(300);
}

class MockCacheContextHandler implements CacheContextHandler {
	public setCacheHeaders = jest.fn<(context: any, hit: boolean, ttl?: number) => void>();

	public shouldCacheRequest = jest.fn<(context: any) => boolean>().mockReturnValue(true);
}

class TestBaseCacheInterceptor extends BaseCacheInterceptor {
	public getCacheKeyGenerator(): CacheKeyGenerator {
		return this.keyGenerator;
	}

	public getCacheMetadataExtractor(): CacheMetadataExtractor {
		return this.metadataExtractor;
	}

	public getCacheContextHandler(): CacheContextHandler {
		return this.contextHandler;
	}

	constructor(
		cacheManager: Cache,
		appLogger: AppLogger,
		private readonly keyGenerator: CacheKeyGenerator,
		private readonly metadataExtractor: CacheMetadataExtractor,
		private readonly contextHandler: CacheContextHandler
	) {
		super(cacheManager, appLogger);
	}
}

describe('BaseCacheInterceptor', () => {
	let interceptor: TestBaseCacheInterceptor;
	let mockCacheManager: jest.Mocked<Cache>;
	let mockKeyGenerator: MockCacheKeyGenerator;
	let mockMetadataExtractor: MockCacheMetadataExtractor;
	let mockContextHandler: MockCacheContextHandler;
	let mockExecutionContext: any;
	let mockCallHandler: any;

	beforeEach(async () => {
		mockCacheManager = {
			get: jest.fn(),
			set: jest.fn(),
			del: jest.fn(),
			clear: jest.fn()
		} as any;

		const mockAppLogger = {
			createContextualLogger: jest.fn().mockReturnValue({
				debug: jest.fn(),
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn()
			})
		};

		mockKeyGenerator = new MockCacheKeyGenerator();
		mockMetadataExtractor = new MockCacheMetadataExtractor();
		mockContextHandler = new MockCacheContextHandler();

		interceptor = new TestBaseCacheInterceptor(
			mockCacheManager,
			mockAppLogger as any,
			mockKeyGenerator,
			mockMetadataExtractor,
			mockContextHandler
		);

		mockExecutionContext = {};
		mockCallHandler = {
			handle: jest.fn().mockReturnValue(of('test-data'))
		};
	});

	describe('intercept - cache hit', () => {
		beforeEach(() => {
			mockCacheManager.get.mockResolvedValue('cached-data');
		});

		it('should return cached data and set hit headers', (done) => {
			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
				expect(result).toBe('cached-data');
				expect(mockContextHandler.setCacheHeaders).toHaveBeenCalledWith(
					mockExecutionContext,
					true,
					300
				);
				expect(mockCallHandler.handle).not.toHaveBeenCalled();
				done();
			});
		});
	});

	describe('intercept - cache miss', () => {
		beforeEach(() => {
			mockCacheManager.get.mockResolvedValue(undefined);
			mockCacheManager.set.mockResolvedValue(undefined);
		});

		it('should execute handler, cache result, and set miss headers', (done) => {
			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
				expect(result).toBe('test-data');
				expect(mockContextHandler.setCacheHeaders).toHaveBeenCalledWith(
					mockExecutionContext,
					false
				);
				expect(mockCallHandler.handle).toHaveBeenCalled();
				expect(mockCacheManager.set).toHaveBeenCalledWith('test-key', 'test-data', 300);
				done();
			});
		});
	});

	describe('intercept - caching disabled', () => {
		beforeEach(() => {
			mockMetadataExtractor.getCacheDisabled.mockReturnValue(true);
		});

		it('should skip caching and execute handler directly', (done) => {
			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
				expect(result).toBe('test-data');
				expect(mockCacheManager.get).not.toHaveBeenCalled();
				expect(mockCallHandler.handle).toHaveBeenCalled();
				done();
			});
		});
	});

	describe('intercept - request not cacheable', () => {
		beforeEach(() => {
			mockContextHandler.shouldCacheRequest.mockReturnValue(false);
		});

		it('should skip caching and execute handler directly', (done) => {
			interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
				expect(result).toBe('test-data');
				expect(mockCacheManager.get).not.toHaveBeenCalled();
				expect(mockCallHandler.handle).toHaveBeenCalled();
				done();
			});
		});
	});

	describe('generateETag', () => {
		it('should generate consistent ETags', () => {
			const data = { test: 'data' };
			const etag1 = (interceptor as any).generateETag(data);
			const etag2 = (interceptor as any).generateETag(data);

			expect(etag1).toMatch(/^".*"$/);
			expect(etag2).toMatch(/^".*"$/);
			expect(etag1).toBe(etag2);
		});
	});

	describe('sortObject', () => {
		it('should sort object keys recursively', () => {
			const input = { z: 1, a: { c: 3, b: 2 } };
			const result = (interceptor as any).sortObject(input);

			expect(Object.keys(result)).toEqual(['a', 'z']);
			expect(Object.keys(result.a)).toEqual(['b', 'c']);
		});

		it('should handle arrays', () => {
			const input = [{ z: 1, a: 2 }];
			const result = (interceptor as any).sortObject(input);

			expect(Object.keys(result[0])).toEqual(['a', 'z']);
		});

		it('should return non-objects unchanged', () => {
			expect((interceptor as any).sortObject('string')).toBe('string');
			expect((interceptor as any).sortObject(123)).toBe(123);
			expect((interceptor as any).sortObject(null)).toBe(null);
		});
	});
});
