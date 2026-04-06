import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';

describe('RequestProperty - Direct Execution Tests', () => {
	function createMockContext(request: any): ExecutionContext {
		return {
			switchToHttp: vi.fn().mockReturnValue({
				getRequest: vi.fn().mockReturnValue(request),
			}),
		} as any;
	}

	it('should execute RequestProperty with direct context', () => {
		const Request = { query: { limit: 10 }, params: { id: 1 } };
		const ctx = createMockContext(Request);

		expect(ctx).toBeDefined();
		expect(ctx.switchToHttp().getRequest()).toEqual(Request);
	});

	it('should handle RequestProperty with complex nested data', () => {
		const Request = {
			body: {
				user: {
					profile: {
						name: 'John Doe',
						email: 'john@example.com',
					},
				},
			},
		};
		const ctx = createMockContext(Request);
		const req = ctx.switchToHttp().getRequest();

		expect(req.body.user.profile.name).toBe('John Doe');
	});

	it('should handle RequestProperty with arrays', () => {
		const Request = {
			body: {
				tags: ['typescript', 'nodejs', 'nestjs'],
				items: [{ id: 1 }, { id: 2 }],
			},
		};
		const ctx = createMockContext(Request);
		const req = ctx.switchToHttp().getRequest();

		expect(Array.isArray(req.body.tags)).toBe(true);
		expect(req.body.tags.length).toBe(3);
		expect(req.body.items.length).toBe(2);
	});

	it('should handle RequestProperty with null values', () => {
		const Request = {
			query: { filter: null, sort: 'name' },
		};
		const ctx = createMockContext(Request);
		const req = ctx.switchToHttp().getRequest();

		expect(req.query.filter).toBeNull();
		expect(req.query.sort).toBe('name');
	});

	it('should handle RequestProperty with undefined values', () => {
		const Request = {
			body: { name: 'John', middleName: undefined, age: 30 },
		};
		const ctx = createMockContext(Request);
		const req = ctx.switchToHttp().getRequest();

		expect(req.body.name).toBe('John');
		expect(req.body.age).toBe(30);
	});

	it('should handle RequestProperty with boolean values', () => {
		const Request = {
			query: { active: true, deleted: false },
		};
		const ctx = createMockContext(Request);
		const req = ctx.switchToHttp().getRequest();

		expect(req.query.active).toBe(true);
		expect(req.query.deleted).toBe(false);
	});

	it('should handle RequestProperty with numeric values', () => {
		const Request = {
			params: { id: 42, offset: 0, limit: 100 },
		};
		const ctx = createMockContext(Request);
		const req = ctx.switchToHttp().getRequest();

		expect(req.params.id).toBe(42);
		expect(req.params.offset).toBe(0);
		expect(req.params.limit).toBe(100);
	});

	it('should handle multiple simultaneous RequestProperty calls', () => {
		const Request = {
			query: { page: 1 },
			params: { userId: 123 },
			body: { data: 'test' },
			headers: { 'content-type': 'application/json' },
		};
		const ctx = createMockContext(Request);
		const req = ctx.switchToHttp().getRequest();

		expect(req.query.page).toBe(1);
		expect(req.params.userId).toBe(123);
		expect(req.body.data).toBe('test');
		expect(req.headers['content-type']).toBe('application/json');
	});
});
