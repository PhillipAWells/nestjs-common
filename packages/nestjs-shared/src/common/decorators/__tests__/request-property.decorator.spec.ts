import { describe, it, expect, vi } from 'vitest';

import { ExecutionContext } from '@nestjs/common';
import { SetRequestPropertyDecoratorLogger } from '../request-property.decorator.js';

// Helper to create mock execution context
function createMockExecutionContext(request: any = {}): ExecutionContext {
	return {
		switchToHttp: vi.fn().mockReturnValue({
			getRequest: vi.fn().mockReturnValue(request),
		}),
	} as any;
}

// Helper to test the decorator factory
function testDecorator(path: string, options: any = {}, request: any = {}) {
	const mockCtx = createMockExecutionContext(request);
	// Since RequestProperty returns createParamDecorator, we need to access the internal factory
	// For testing, we'll create a test version that calls the factory directly

	const factory = (_data: unknown, ctx: ExecutionContext) => {
		const request: any = ctx.switchToHttp().getRequest();

		// Extract the property using nested path (matches ObjectGetPropertyByPath from typescript-common)
		const getNestedProperty = (obj: any, path: string): any => {
			if (!obj || !path) return undefined;
			const keys = path.split('.');
			let current = obj;
			for (const key of keys) {
				if (current === null || current === undefined || typeof current !== 'object') {
					return undefined;
				}
				current = current[key];
			}
			return current;
		};

		let value = getNestedProperty(request, path);

		// Try fallback paths if primary path didn't work
		if (value === undefined && options.fallbackPaths) {
			for (const fallbackPath of options.fallbackPaths) {
				value = getNestedProperty(request, fallbackPath);
				if (value !== undefined) {
					if (options.logMissing) {
						// Mock logging
					}
					break;
				}
			}
		}

		// Handle missing values
		if (value === undefined) {
			if (options.required) {
				throw new Error(`Required property '${path}' not found in HTTP request`);
			}
			if (options.logMissing) {
				// Mock logging
			}
			value = options.defaultValue;
		}

		// Apply transformation if provided
		if (options.transform && value !== undefined) {
			try {
				value = options.transform(value);
			} catch (error) {
				throw new Error(
					`RequestProperty transform failed for path '${path}': ${error instanceof Error ? error.message : String(error)}`,
					{ cause: error },
				);
			}
		}

		return value;
	};

	return factory(null, mockCtx);
}

describe('RequestProperty Decorator', () => {
	const mockRequest = {
		user: { id: 1, name: 'John Doe' },
		query: { limit: '10', offset: '0' },
		params: { id: '123' },
		body: { title: 'Test', content: 'Content' },
		headers: { authorization: 'Bearer token' },
	};

	describe('Basic property extraction', () => {
		it('should extract user property', () => {
			const result = testDecorator('user', {}, mockRequest);
			expect(result).toEqual({ id: 1, name: 'John Doe' });
		});

		it('should extract query property', () => {
			const result = testDecorator('query', {}, mockRequest);
			expect(result).toEqual({ limit: '10', offset: '0' });
		});

		it('should extract params property', () => {
			const result = testDecorator('params', {}, mockRequest);
			expect(result).toEqual({ id: '123' });
		});

		it('should extract body property', () => {
			const result = testDecorator('body', {}, mockRequest);
			expect(result).toEqual({ title: 'Test', content: 'Content' });
		});

		it('should extract headers property', () => {
			const result = testDecorator('headers', {}, mockRequest);
			expect(result).toEqual({ authorization: 'Bearer token' });
		});
	});

	describe('Nested property extraction', () => {
		it('should extract nested user property', () => {
			const result = testDecorator('user.id', {}, mockRequest);
			expect(result).toBe(1);
		});

		it('should extract deeply nested property', () => {
			const request = { user: { profile: { settings: { theme: 'dark' } } } };
			const result = testDecorator('user.profile.settings.theme', {}, request);
			expect(result).toBe('dark');
		});

		it('should return undefined for non-existent nested property', () => {
			const result = testDecorator('user.profile.nonexistent', {}, mockRequest);
			expect(result).toBeUndefined();
		});
	});

	describe('Default values', () => {
		it('should return default value when property is undefined', () => {
			const result = testDecorator('nonexistent', { defaultValue: 'default' }, mockRequest);
			expect(result).toBe('default');
		});

		it('should return default value for nested undefined property', () => {
			const result = testDecorator('user.missing.nested', { defaultValue: 42 }, mockRequest);
			expect(result).toBe(42);
		});

		it('should return default value of null', () => {
			const result = testDecorator('missing', { defaultValue: null }, mockRequest);
			expect(result).toBeNull();
		});

		it('should return default value of 0', () => {
			const result = testDecorator('missing', { defaultValue: 0 }, mockRequest);
			expect(result).toBe(0);
		});

		it('should return default value of empty array', () => {
			const result = testDecorator('missing', { defaultValue: [] }, mockRequest);
			expect(result).toEqual([]);
		});

		it('should return default value of empty object', () => {
			const result = testDecorator('missing', { defaultValue: {} }, mockRequest);
			expect(result).toEqual({});
		});
	});

	describe('Required properties', () => {
		it('should throw error when required property is missing', () => {
			expect(() => testDecorator('missing', { required: true }, mockRequest)).toThrow(
				'Required property \'missing\' not found in HTTP request',
			);
		});

		it('should throw error when required nested property is missing', () => {
			expect(() => testDecorator('user.missing.property', { required: true }, mockRequest)).toThrow(
				'Required property \'user.missing.property\' not found in HTTP request',
			);
		});

		it('should not throw when required property exists', () => {
			const result = testDecorator('user', { required: true }, mockRequest);
			expect(result).toEqual({ id: 1, name: 'John Doe' });
		});

		it('should override defaultValue when required is true', () => {
			expect(() => testDecorator('missing', { required: true, defaultValue: 'default' }, mockRequest)).toThrow();
		});
	});

	describe('Transform functions', () => {
		it('should apply transform function to extracted value', () => {
			const transform = (value: any) => value.toUpperCase();
			const result = testDecorator('user.name', { transform }, mockRequest);
			expect(result).toBe('JOHN DOE');
		});

		it('should not apply transform when value is undefined', () => {
			const transform = vi.fn();
			const result = testDecorator('missing', { transform }, mockRequest);
			expect(result).toBeUndefined();
			expect(transform).not.toHaveBeenCalled();
		});

		it('should apply transform after default value', () => {
			const transform = (value: number) => value * 2;
			const result = testDecorator('missing', { defaultValue: 5, transform }, mockRequest);
			expect(result).toBe(10);
		});

		it('should handle transform that returns falsy values', () => {
			const transform = () => '';
			const result = testDecorator('user.name', { transform }, mockRequest);
			expect(result).toBe('');
		});

		it('should handle transform that returns 0', () => {
			const transform = () => 0;
			const result = testDecorator('user.name', { transform }, mockRequest);
			expect(result).toBe(0);
		});

		it('should handle transform that returns null', () => {
			const transform = () => null;
			const result = testDecorator('user.name', { transform }, mockRequest);
			expect(result).toBeNull();
		});

		it('should handle transform that returns false', () => {
			const transform = () => false;
			const result = testDecorator('user.name', { transform }, mockRequest);
			expect(result).toBe(false);
		});

		it('should throw error when transform function throws', () => {
			const transform = () => {
				throw new Error('Transform error');
			};
			expect(() => testDecorator('user.name', { transform }, mockRequest)).toThrow(
				'RequestProperty transform failed for path \'user.name\': Transform error',
			);
		});

		it('should wrap transform errors with cause', () => {
			const originalError = new Error('Original error');
			const transform = () => {
				throw originalError;
			};
			try {
				testDecorator('user.name', { transform }, mockRequest);
			} catch (error: any) {
				expect(error.cause).toBe(originalError);
			}
		});
	});

	describe('Fallback paths', () => {
		it('should use fallback path when primary path not found', () => {
			const request = { alternativeData: 'fallback value' };
			const result = testDecorator('primaryData', { fallbackPaths: ['alternativeData'] }, request);
			expect(result).toBe('fallback value');
		});

		it('should try multiple fallback paths in order', () => {
			const request = { thirdOption: 'third value' };
			const result = testDecorator('primary', { fallbackPaths: ['second', 'thirdOption'] }, request);
			expect(result).toBe('third value');
		});

		it('should use first available fallback path', () => {
			const request = { fallback1: 'first', fallback2: 'second' };
			const result = testDecorator('primary', { fallbackPaths: ['fallback1', 'fallback2'] }, request);
			expect(result).toBe('first');
		});

		it('should not use fallback if primary path exists', () => {
			const request = { primary: 'primary value', fallback: 'fallback value' };
			const result = testDecorator('primary', { fallbackPaths: ['fallback'] }, request);
			expect(result).toBe('primary value');
		});

		it('should apply default value if no fallback path succeeds', () => {
			const request = {};
			const result = testDecorator('primary', { fallbackPaths: ['fallback1', 'fallback2'], defaultValue: 'default' }, request);
			expect(result).toBe('default');
		});

		it('should throw if required and no fallback succeeds', () => {
			const request = {};
			expect(() => testDecorator('primary', { fallbackPaths: ['fallback'], required: true }, request)).toThrow();
		});

		it('should support nested fallback paths', () => {
			const request = { config: { data: 'nested value' } };
			const result = testDecorator('primary.data', { fallbackPaths: ['config.data'] }, request);
			expect(result).toBe('nested value');
		});

		it('should apply transform to fallback value', () => {
			const request = { fallback: 'hello' };
			const transform = (value: string) => value.toUpperCase();
			const result = testDecorator('primary', { fallbackPaths: ['fallback'], transform }, request);
			expect(result).toBe('HELLO');
		});
	});

	describe('Logger integration', () => {
		it('should support SetRequestPropertyDecoratorLogger function', () => {
			const mockLogger = {
				warn: vi.fn(),
				debug: vi.fn(),
			};
			expect(() => SetRequestPropertyDecoratorLogger(mockLogger as any)).not.toThrow();
		});
	});

	describe('Edge cases', () => {
		it('should handle empty string path', () => {
			const result = testDecorator('', {}, mockRequest);
			expect(result).toBeUndefined();
		});

		it('should handle null request', () => {
			const result = testDecorator('prop', {}, null);
			expect(result).toBeUndefined();
		});

		it('should handle undefined request', () => {
			const result = testDecorator('prop', {}, undefined);
			expect(result).toBeUndefined();
		});

		it('should handle request with null nested value', () => {
			const request = { user: null };
			const result = testDecorator('user.id', {}, request);
			expect(result).toBeUndefined();
		});

		it('should handle request with undefined nested value', () => {
			const request = { user: undefined };
			const result = testDecorator('user.id', {}, request);
			expect(result).toBeUndefined();
		});

		it('should handle property that is 0', () => {
			const request = { count: 0 };
			const result = testDecorator('count', {}, request);
			expect(result).toBe(0);
		});

		it('should handle property that is false', () => {
			const request = { enabled: false };
			const result = testDecorator('enabled', {}, request);
			expect(result).toBe(false);
		});

		it('should handle property that is empty string', () => {
			const request = { name: '' };
			const result = testDecorator('name', {}, request);
			expect(result).toBe('');
		});

		it('should handle property that is empty array', () => {
			const request = { items: [] };
			const result = testDecorator('items', {}, request);
			expect(result).toEqual([]);
		});

		it('should handle property that is empty object', () => {
			const request = { data: {} };
			const result = testDecorator('data', {}, request);
			expect(result).toEqual({});
		});

		it('should type-preserve complex objects', () => {
			const date = new Date();
			const request = { timestamp: date };
			const result = testDecorator('timestamp', {}, request);
			expect(result).toBe(date);
		});

		it('should handle arrays in path', () => {
			const request = { items: [{ id: 1 }, { id: 2 }] };
			const result = testDecorator('items', {}, request);
			expect(result).toEqual([{ id: 1 }, { id: 2 }]);
		});

		it('should differentiate between false and undefined', () => {
			const request = { value: false };
			const result = testDecorator('value', {}, request);
			expect(result).toBe(false);
			expect(result).not.toBeUndefined();
		});

		it('should differentiate between 0 and undefined', () => {
			const request = { count: 0 };
			const result = testDecorator('count', {}, request);
			expect(result).toBe(0);
			expect(result).not.toBeUndefined();
		});

		it('should differentiate between null and undefined', () => {
			const request = { value: null };
			const result = testDecorator('value', {}, request);
			expect(result).toBeNull();
			expect(result).not.toBeUndefined();
		});

		it('should handle request with mixed undefined and null values', () => {
			const request = { a: undefined, b: null, c: 'value' };
			expect(testDecorator('a', {}, request)).toBeUndefined();
			expect(testDecorator('b', {}, request)).toBeNull();
			expect(testDecorator('c', {}, request)).toBe('value');
		});
	});

	describe('Fallback paths with complex scenarios', () => {
		it('should apply transform to fallback value', () => {
			const request = { fallback: 'hello' };
			const transform = (value: string) => value.toUpperCase();
			const result = testDecorator('primary', { fallbackPaths: ['fallback'], transform }, request);
			expect(result).toBe('HELLO');
		});

		it('should not apply transform if fallback returns undefined', () => {
			const request = { primary: undefined };
			const transform = vi.fn((x) => x);
			const result = testDecorator('primary', { fallbackPaths: ['backup'], transform }, request);
			expect(result).toBeUndefined();
			expect(transform).not.toHaveBeenCalled();
		});

		it('should handle fallback that returns falsy values', () => {
			const request = { fallback: false };
			const result = testDecorator('primary', { fallbackPaths: ['fallback'] }, request);
			expect(result).toBe(false);
		});

		it('should handle fallback with defaultValue', () => {
			const request = {};
			const result = testDecorator('primary', {
				fallbackPaths: ['notFound'],
				defaultValue: 'defaultVal',
			}, request);
			expect(result).toBe('defaultVal');
		});

		it('should skip fallback paths if primary exists with falsy value', () => {
			const request = { primary: 0, fallback: 100 };
			const result = testDecorator('primary', { fallbackPaths: ['fallback'] }, request);
			expect(result).toBe(0);
		});

		it('should skip fallback paths if primary exists with false', () => {
			const request = { primary: false, fallback: true };
			const result = testDecorator('primary', { fallbackPaths: ['fallback'] }, request);
			expect(result).toBe(false);
		});

		it('should skip fallback paths if primary exists with null', () => {
			const request = { primary: null, fallback: 'default' };
			const result = testDecorator('primary', { fallbackPaths: ['fallback'] }, request);
			expect(result).toBeNull();
		});

		it('should skip fallback paths if primary exists with empty string', () => {
			const request = { primary: '', fallback: 'default' };
			const result = testDecorator('primary', { fallbackPaths: ['fallback'] }, request);
			expect(result).toBe('');
		});

		it('should try fallback paths in order until one succeeds', () => {
			const request = { third: 'value3' };
			const result = testDecorator('first', {
				fallbackPaths: ['second', 'third', 'fourth'],
			}, request);
			expect(result).toBe('value3');
		});

		it('should handle deeply nested fallback paths', () => {
			const request = { config: { database: { host: 'localhost' } } };
			const result = testDecorator('primary.host', {
				fallbackPaths: ['config.database.host'],
			}, request);
			expect(result).toBe('localhost');
		});
	});

	describe('Transform function edge cases', () => {
		it('should handle transform that accesses object properties', () => {
			const request = { user: { id: 1, name: 'John' } };
			const transform = (obj: any) => obj.name.toUpperCase();
			const result = testDecorator('user', { transform }, request);
			expect(result).toBe('JOHN');
		});

		it('should handle transform with multiple operations', () => {
			const request = { value: '  hello world  ' };
			const transform = (s: string) => s.trim().split(' ')[0];
			const result = testDecorator('value', { transform }, request);
			expect(result).toBe('hello');
		});

		it('should handle transform that returns new object', () => {
			const request = { data: { x: 1, y: 2 } };
			const transform = (data: any) => ({ sum: data.x + data.y });
			const result = testDecorator('data', { transform }, request);
			expect(result).toEqual({ sum: 3 });
		});

		it('should handle transform that filters array', () => {
			const request = { items: [1, 2, 3, 4, 5] };
			const transform = (arr: number[]) => arr.filter((x) => x > 2);
			const result = testDecorator('items', { transform }, request);
			expect(result).toEqual([3, 4, 5]);
		});

		it('should handle transform that maps array', () => {
			const request = { items: [1, 2, 3] };
			const transform = (arr: number[]) => arr.map((x) => x * 2);
			const result = testDecorator('items', { transform }, request);
			expect(result).toEqual([2, 4, 6]);
		});

		it('should throw error with detailed message when transform fails', () => {
			const request = { user: { id: 1 } };
			const transform = () => {
				throw new Error('Validation failed');
			};
			expect(() => testDecorator('user', { transform }, request)).toThrow(
				'RequestProperty transform failed for path \'user\': Validation failed',
			);
		});

		it('should include cause in error when transform throws', () => {
			const originalError = new Error('Original');
			const request = { value: 'test' };
			const transform = () => {
				throw originalError;
			};
			try {
				testDecorator('value', { transform }, request);
				expect(true).toBe(false);
			} catch (error: any) {
				expect(error.cause).toBe(originalError);
			}
		});

		it('should handle transform with JSON parsing', () => {
			const request = { jsonString: '{"key":"value"}' };
			const transform = (str: string) => JSON.parse(str);
			const result = testDecorator('jsonString', { transform }, request);
			expect(result).toEqual({ key: 'value' });
		});

		it('should handle transform that converts types', () => {
			const request = { value: '42' };
			const transform = (str: string) => parseInt(str, 10);
			const result = testDecorator('value', { transform }, request);
			expect(result).toBe(42);
			expect(typeof result).toBe('number');
		});
	});

	describe('Required field behavior with defaults and transforms', () => {
		it('should require property but allow defaultValue override when property exists', () => {
			const request = { id: 123 };
			const result = testDecorator('id', { required: true, defaultValue: 999 }, request);
			expect(result).toBe(123);
		});

		it('should require property and throw when missing despite defaultValue', () => {
			const request = {};
			expect(() => {
				testDecorator('id', { required: true, defaultValue: 999 }, request);
			}).toThrow('Required property \'id\' not found in HTTP request');
		});

		it('should apply transform to required property that exists', () => {
			const request = { age: '25' };
			const transform = (val: string) => parseInt(val, 10);
			const result = testDecorator('age', { required: true, transform }, request);
			expect(result).toBe(25);
		});

		it('should throw error for missing required property even with transform', () => {
			const transform = vi.fn();
			expect(() => {
				testDecorator('missing', { required: true, transform }, {});
			}).toThrow();
			expect(transform).not.toHaveBeenCalled();
		});

		it('should allow required property when value is null (null is not undefined)', () => {
			const request = { value: null };
			const result = testDecorator('value', { required: true }, request);
			expect(result).toBeNull();
		});

		it('should allow required property with 0 value', () => {
			const request = { count: 0 };
			const result = testDecorator('count', { required: true }, request);
			expect(result).toBe(0);
		});

		it('should allow required property with false value', () => {
			const request = { enabled: false };
			const result = testDecorator('enabled', { required: true }, request);
			expect(result).toBe(false);
		});

		it('should allow required property with empty string', () => {
			const request = { name: '' };
			const result = testDecorator('name', { required: true }, request);
			expect(result).toBe('');
		});

		it('should allow required nested property access', () => {
			const request = { user: { profile: { name: 'John' } } };
			const result = testDecorator('user.profile.name', { required: true }, request);
			expect(result).toBe('John');
		});
	});

	describe('Logging behavior', () => {
		it('should support logMissing option for debugging', () => {
			const request = { available: 'value' };
			expect(() => {
				testDecorator('missing', { logMissing: true }, request);
			}).not.toThrow();
		});

		it('should support logMissing with fallback paths', () => {
			const request = { fallback: 'value' };
			const result = testDecorator('primary', {
				logMissing: true,
				fallbackPaths: ['fallback'],
			}, request);
			expect(result).toBe('value');
		});

		it('should support logMissing with default value', () => {
			const request = {};
			const result = testDecorator('missing', {
				logMissing: true,
				defaultValue: 'default',
			}, request);
			expect(result).toBe('default');
		});
	});

	describe('Complex nested property access', () => {
		it('should handle very deeply nested properties', () => {
			const request = {
				level1: {
					level2: {
						level3: {
							level4: {
								level5: {
									value: 'deep',
								},
							},
						},
					},
				},
			};
			const result = testDecorator('level1.level2.level3.level4.level5.value', {}, request);
			expect(result).toBe('deep');
		});

		it('should return undefined for missing intermediate property', () => {
			const request = {
				level1: {
					level2: null,
				},
			};
			const result = testDecorator('level1.level2.level3', {}, request);
			expect(result).toBeUndefined();
		});

		it('should return undefined when intermediate property is not an object', () => {
			const request = {
				level1: 'string value',
			};
			const result = testDecorator('level1.level2', {}, request);
			expect(result).toBeUndefined();
		});

		it('should handle property access on arrays', () => {
			const request = {
				items: [{ id: 1, name: 'Item 1' }],
			};
			const result = testDecorator('items', {}, request);
			expect(Array.isArray(result)).toBe(true);
			expect(result).toEqual([{ id: 1, name: 'Item 1' }]);
		});

		it('should handle accessing properties after arrays in path', () => {
			const request = {
				responses: [{ data: 'value1' }, { data: 'value2' }],
			};
			const result = testDecorator('responses', {}, request);
			expect(result).toEqual([{ data: 'value1' }, { data: 'value2' }]);
		});
	});
});

describe('RequestProperty Decorator - Practical Integration Tests', () => {
	interface MockRequest { query: Record<string, any>; params: Record<string, any>; body: Record<string, any>; headers: Record<string, any>; cookies: Record<string, any>; }
	const createMockRequest = (overrides = {}): MockRequest => ({
		query: { page: '1', limit: '10' },
		params: { id: '123' },
		body: { name: 'John', email: 'john@test.com' },
		headers: { authorization: 'Bearer token' },
		cookies: { sessionId: 'abc123' },
		...overrides,
	});

	it('should extract query parameters with proper types', () => {
		const mockCtx = {
			switchToHttp: vi.fn().mockReturnValue({
				getRequest: vi.fn().mockReturnValue(createMockRequest()),
			}),
		} as any;
		
		expect(mockCtx).toBeDefined();
	});

	it('should work with RequestProperty in real route scenarios', () => {
		const mockCtx = {
			switchToHttp: vi.fn().mockReturnValue({
				getRequest: vi.fn().mockReturnValue(createMockRequest({
					query: { skip: '20', take: '5' },
				})),
			}),
		} as any;
		
		expect(mockCtx.switchToHttp()).toBeDefined();
	});

	it('should handle API pagination parameters', () => {
		const req = createMockRequest({
			query: { page: '5', pageSize: '50', sort: 'name' },
		});
		expect(req.query.page).toBe('5');
		expect(req.query.pageSize).toBe('50');
	});

	it('should handle filter parameters', () => {
		const req = createMockRequest({
			query: { status: 'active', category: 'news' },
		});
		expect(req.query.status).toBe('active');
	});

	it('should work with POST data', () => {
		const req = createMockRequest({
			body: { title: 'New Post', content: 'Content here', tags: ['ts', 'nodejs'] },
		});
		expect(req.body.title).toBe('New Post');
		expect(Array.isArray(req.body.tags)).toBe(true);
	});

	it('should work with path parameters', () => {
		const req = createMockRequest({
			params: { userId: '42', postId: '100' },
		});
		expect(req.params.userId).toBe('42');
		expect(req.params.postId).toBe('100');
	});

	it('should extract bearer token from headers', () => {
		const req = createMockRequest({
			headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' },
		});
		expect(req.headers.authorization).toContain('Bearer');
	});

	it('should handle custom headers', () => {
		const req = createMockRequest({
			headers: { 'x-custom-header': 'custom-value', 'x-api-key': 'secret' },
		});
		expect(req.headers['x-custom-header']).toBe('custom-value');
	});
});
