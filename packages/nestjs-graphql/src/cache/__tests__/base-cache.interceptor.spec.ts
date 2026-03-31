
import { vi } from 'vitest';
import { of } from 'rxjs';
import {
	BaseCacheInterceptor,
	ICacheKeyGenerator,
	ICacheMetadataExtractor,
	ICacheContextHandler,
} from '../interceptors/base-cache.interceptor.js';

// Mock implementations for testing
class MockCacheKeyGenerator implements ICacheKeyGenerator {
	public Generate = vi.fn<(context: any, options?: any) => string>().mockReturnValue('test-key');
}

class MockCacheMetadataExtractor implements ICacheMetadataExtractor {
	public GetCacheDisabled = vi.fn<(context: any) => boolean>().mockReturnValue(false);

	public GetCacheTtl = vi.fn<(context: any) => number | undefined>().mockReturnValue(300);
}

class MockCacheContextHandler implements ICacheContextHandler {
	public SetCacheHeaders = vi.fn<(context: any, hit: boolean, ttl?: number) => void>();

	public ShouldCacheRequest = vi.fn<(context: any) => boolean>().mockReturnValue(true);
}

class TestBaseCacheInterceptor extends BaseCacheInterceptor {
	public GetCacheKeyGenerator(): ICacheKeyGenerator {
		return this.keyGenerator;
	}

	public GetCacheMetadataExtractor(): ICacheMetadataExtractor {
		return this.metadataExtractor;
	}

	public GetCacheContextHandler(): ICacheContextHandler {
		return this.contextHandler;
	}

	constructor(
		moduleRef: any,
		private readonly keyGenerator: ICacheKeyGenerator,
		private readonly metadataExtractor: ICacheMetadataExtractor,
		private readonly contextHandler: ICacheContextHandler,
	) {
		super(moduleRef);
	}
}

describe('BaseCacheInterceptor', () => {
	let interceptor: TestBaseCacheInterceptor;
	let mockCacheManager: any;
	let mockKeyGenerator: MockCacheKeyGenerator;
	let mockMetadataExtractor: MockCacheMetadataExtractor;
	let mockContextHandler: MockCacheContextHandler;
	let mockExecutionContext: any;
	let mockCallHandler: any;

	beforeEach(async () => {
		mockCacheManager = {
			get: vi.fn(),
			set: vi.fn(),
			del: vi.fn(),
			clear: vi.fn(),
		} as any;

		const mockAppLogger = {
			createContextualLogger: vi.fn().mockReturnValue({
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			}),
		};

		const mockModuleRef = {
			get: vi.fn((token: any) => {
				if (token === 'CACHE_MANAGER' || (typeof token === 'symbol')) {
					return mockCacheManager;
				}
				return mockAppLogger;
			}),
		} as any;

		mockKeyGenerator = new MockCacheKeyGenerator();
		mockMetadataExtractor = new MockCacheMetadataExtractor();
		mockContextHandler = new MockCacheContextHandler();

		interceptor = new TestBaseCacheInterceptor(
			mockModuleRef,
			mockKeyGenerator,
			mockMetadataExtractor,
			mockContextHandler,
		);

		mockExecutionContext = {};
		mockCallHandler = {
			handle: vi.fn().mockReturnValue(of('test-data')),
		};
	});

	describe('intercept - cache hit', () => {
		beforeEach(() => {
			mockCacheManager.get.mockResolvedValue('cached-data');
		});

		it('should return cached data and set hit headers', () => {
			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
					expect(result).toBe('cached-data');
					expect(mockContextHandler.SetCacheHeaders).toHaveBeenCalledWith(
						mockExecutionContext,
						true,
						300,
					);
					expect(mockCallHandler.handle).not.toHaveBeenCalled();
					resolve();
				});
			});
		});
	});

	describe('intercept - cache miss', () => {
		beforeEach(() => {
			mockCacheManager.get.mockResolvedValue(undefined);
			mockCacheManager.set.mockResolvedValue(undefined);
		});

		it('should execute handler, cache result, and set miss headers', () => {
			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
					expect(result).toBe('test-data');
					expect(mockContextHandler.SetCacheHeaders).toHaveBeenCalledWith(
						mockExecutionContext,
						false,
					);
					expect(mockCallHandler.handle).toHaveBeenCalled();
					expect(mockCacheManager.set).toHaveBeenCalledWith('test-key', 'test-data', 300);
					resolve();
				});
			});
		});
	});

	describe('intercept - caching disabled', () => {
		beforeEach(() => {
			mockMetadataExtractor.GetCacheDisabled.mockReturnValue(true);
		});

		it('should skip caching and execute handler directly', () => {
			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
					expect(result).toBe('test-data');
					expect(mockCacheManager.get).not.toHaveBeenCalled();
					expect(mockCallHandler.handle).toHaveBeenCalled();
					resolve();
				});
			});
		});
	});

	describe('intercept - request not cacheable', () => {
		beforeEach(() => {
			mockContextHandler.ShouldCacheRequest.mockReturnValue(false);
		});

		it('should skip caching and execute handler directly', () => {
			return new Promise<void>((resolve) => {
				interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe((result) => {
					expect(result).toBe('test-data');
					expect(mockCacheManager.get).not.toHaveBeenCalled();
					expect(mockCallHandler.handle).toHaveBeenCalled();
					resolve();
				});
			});
		});
	});

	describe('generateETag', () => {
		it('should generate consistent ETags', () => {
			const data = { test: 'data' };
			const etag1 = (interceptor as any).GenerateETag(data);
			const etag2 = (interceptor as any).GenerateETag(data);

			expect(etag1).toMatch(/^".*"$/);
			expect(etag2).toMatch(/^".*"$/);
			expect(etag1).toBe(etag2);
		});
	});

	describe('sortObject', () => {
		it('should sort object keys recursively', () => {
			const input = { z: 1, a: { c: 3, b: 2 } };
			const result = (interceptor as any).SortObject(input);

			expect(Object.keys(result)).toEqual(['a', 'z']);
			expect(Object.keys(result.a)).toEqual(['b', 'c']);
		});

		it('should handle arrays', () => {
			const input = [{ z: 1, a: 2 }];
			const result = (interceptor as any).SortObject(input);

			expect(Object.keys(result[0])).toEqual(['a', 'z']);
		});

		it('should return non-objects unchanged', () => {
			expect((interceptor as any).SortObject('string')).toBe('string');
			expect((interceptor as any).SortObject(123)).toBe(123);
			expect((interceptor as any).SortObject(null)).toBe(null);
		});
	});
});
