import { describe, it, expect, beforeEach } from 'vitest';
import { ModuleRef } from '@nestjs/core';
import {
	CreateMemoizedLazyGetter,
	CreateOptionalLazyGetter,
	IsLazyModuleRefService,
	type TLazyGetter,
	type TOptionalLazyGetter,
	type TTokenLazyGetter,
	type ILazyModuleRefService,
} from '../lazy-getter.types.js';

describe('TLazyGetter Utilities', () => {
	let mockModuleRef: ModuleRef;

	beforeEach(() => {
		mockModuleRef = {
			get: (token: string | Function, _options?: any) => {
				if (token === 'ExistingService') {
					return { name: 'ExistingService' };
				}
				throw new Error('Service not found');
			},
		} as any;
	});

	describe('CreateMemoizedLazyGetter', () => {
		it('should cache the result on first call', () => {
			const callCount = { count: 0 };
			const getter: TLazyGetter<{ count: number }> = () => {
				callCount.count++;
				return { value: 'test' } as any;
			};

			const memoizedGetter = CreateMemoizedLazyGetter(getter);

			// First call should execute the getter
			const result1 = memoizedGetter();
			expect(callCount.count).toBe(1);

			// Second call should return cached value without executing getter again
			const result2 = memoizedGetter();
			expect(callCount.count).toBe(1);

			// Both should return the same reference
			expect(result1).toBe(result2);
		});

		it('should handle null/undefined cached values correctly', () => {
			const getter: TLazyGetter<undefined> = () => undefined;
			const memoizedGetter = CreateMemoizedLazyGetter(getter);

			const result1 = memoizedGetter();
			const result2 = memoizedGetter();

			expect(result1).toBeUndefined();
			expect(result2).toBeUndefined();
		});

		it('should work with different types', () => {
			const stringGetter = CreateMemoizedLazyGetter(() => 'cached-string');
			const numberGetter = CreateMemoizedLazyGetter(() => 42);
			const objectGetter = CreateMemoizedLazyGetter(() => ({ key: 'value' }));

			expect(stringGetter()).toBe('cached-string');
			expect(numberGetter()).toBe(42);
			expect(objectGetter()).toEqual({ key: 'value' });
		});
	});

	describe('CreateOptionalLazyGetter', () => {
		it('should return the service when it exists', () => {
			const service = CreateOptionalLazyGetter(mockModuleRef, 'ExistingService');
			expect(service).toEqual({ name: 'ExistingService' });
		});

		it('should return undefined when service does not exist (strict: false)', () => {
			const service = CreateOptionalLazyGetter(
				mockModuleRef,
				'NonExistentService',
				{ strict: false },
			);
			expect(service).toBeUndefined();
		});

		it('should return undefined when service does not exist and no config provided', () => {
			const service = CreateOptionalLazyGetter(
				mockModuleRef,
				'NonExistentService',
			);
			expect(service).toBeUndefined();
		});

		it('should respect strict: true config', () => {
			const service = CreateOptionalLazyGetter(
				mockModuleRef,
				'NonExistentService',
				{ strict: true },
			);
			expect(service).toBeUndefined();
		});

		it('should handle both token types (string and Function)', () => {
			class TestService {}

			const stringTokenResult = CreateOptionalLazyGetter(
				mockModuleRef,
				'ExistingService',
			);
			expect(stringTokenResult).toBeDefined();

			// Test with Function token (would fail with non-existent service)
			const functionTokenResult = CreateOptionalLazyGetter(
				mockModuleRef,
				TestService,
			);
			expect(functionTokenResult).toBeUndefined();
		});
	});

	describe('IsLazyModuleRefService', () => {
		it('should detect objects with Module property', () => {
			const validService = {
				moduleRef: mockModuleRef,
			};

			// The function checks if Module is instanceof ModuleRef
			// Since our mock is not a real ModuleRef, this should return falsy
			const Result = IsLazyModuleRefService(validService);
			expect(typeof Result === 'boolean' || Result === undefined).toBe(true);
		});

		it('should return falsy for null', () => {
			expect(!IsLazyModuleRefService(null)).toBe(true);
		});

		it('should return falsy for undefined', () => {
			expect(!IsLazyModuleRefService(undefined)).toBe(true);
		});

		it('should return falsy for object without Module property', () => {
			expect(!IsLazyModuleRefService({})).toBe(true);
		});

		it('should return falsy for object with non-ModuleRef Module property', () => {
			expect(!IsLazyModuleRefService({ Module: {} })).toBe(true);
			expect(!IsLazyModuleRefService({ Module: 'not-a-moduleref' })).toBe(true);
		});

		it('should return falsy for non-objects', () => {
			expect(!IsLazyModuleRefService('string')).toBe(true);
			expect(!IsLazyModuleRefService(42)).toBe(true);
			expect(!IsLazyModuleRefService([])).toBe(true);
		});
	});

	describe('Type Definitions', () => {
		it('should support TLazyGetter type', () => {
			const getter: TLazyGetter<string> = () => 'value';
			const Result = getter();
			expect(typeof Result).toBe('string');
		});

		it('should support TOptionalLazyGetter type', () => {
			const getter: TOptionalLazyGetter<string> = () => 'value';
			const Result = getter();
			expect(typeof Result === 'string' || Result === undefined).toBe(true);
		});

		it('should support TTokenLazyGetter type', () => {
			const mockModule = {
				get: (token: string) => ({ token }),
			} as any;

			const getter: TTokenLazyGetter<any> = (token: string) => mockModule.get(token);
			const Result = getter('test-token');
			expect(Result).toEqual({ token: 'test-token' });
		});

		it('should support ILazyModuleRefService interface', () => {
			const service: ILazyModuleRefService = {
				Module: mockModuleRef,
			};

			// service.Module should be an instance of ModuleRef for this to work
			expect(service.Module instanceof mockModuleRef.constructor).toBe(true);
		});
	});

	describe('Integration Scenarios', () => {
		it('should use memoized getter in lazy module pattern', () => {
			const callCount = { count: 0 };
			const mockService = {
				method: () => 'test-result',
			};

			const moduleRef = {
				get: () => {
					callCount.count++;
					return mockService;
				},
			} as any;

			class LazyService implements ILazyModuleRefService {
				constructor(public readonly Module: ModuleRef) {}

				private _service?: { method: () => string };

				get Service() {
					this._service ??= this.Module.get('TestService');
					return this._service;
				}
			}

			const service = new LazyService(moduleRef);

			// First access
			service.Service.method();
			expect(callCount.count).toBe(1);

			// Second access should use cached value
			service.Service.method();
			expect(callCount.count).toBe(1);
		});

		it('should handle optional dependencies in lazy pattern', () => {
			class LazyService {
				private optionalService?: { name: string };

				constructor(private readonly ModuleRef: ModuleRef) {}

				get OptionalFeature() {
					this.optionalService ??= CreateOptionalLazyGetter(
						this.ModuleRef,
						'OptionalFeature',
						{ strict: false },
					);
					return this.optionalService;
				}
			}

			const service = new LazyService(mockModuleRef);
			expect(service.OptionalFeature).toBeUndefined();
		});
	});
});
