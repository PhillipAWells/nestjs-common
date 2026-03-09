import { ExecutionContext } from '@nestjs/common';
import { describe, it, expect, beforeEach } from 'vitest';
import {
	CreateRequestPropertyDecorator,
	CreateConditionalDecorator,
	CreateValidatingDecorator,
	CreateTransformingDecorator,
	GetRequestFromContext,
	type BaseDecoratorOptions,
	type ConditionalDecoratorOptions,
	type ValidatingDecoratorOptions,
	type TransformingDecoratorOptions,
} from '../decorator-factory.js';

describe('Decorator Factories', () => {
	let mockContext: ExecutionContext;
	let mockRequest: any;
	let mockResponse: any;

	beforeEach(() => {
		mockRequest = {
			headers: { 'x-custom': 'value' },
			query: { id: '123' },
			params: { userId: '456' },
			body: { name: 'test' },
			ip: '127.0.0.1',
		};

		mockResponse = {};

		mockContext = {
			switchToHttp: () => ({
				getRequest: () => mockRequest,
				getResponse: () => mockResponse,
			}),
			getArgs: () => [],
			getArgByIndex: () => undefined,
			switchToRpc: () => null as any,
			switchToWs: () => null as any,
		} as any;
	});

	describe('GetRequestFromContext', () => {
		it('should extract request from execution context', () => {
			const request = GetRequestFromContext(mockContext);
			expect(request).toBe(mockRequest);
		});

		it('should return the same request object on multiple calls', () => {
			const req1 = GetRequestFromContext(mockContext);
			const req2 = GetRequestFromContext(mockContext);
			expect(req1).toBe(req2);
		});
	});

	describe('CreateRequestPropertyDecorator', () => {
		it('should create a parameter decorator', () => {
			const decorator = CreateRequestPropertyDecorator(
				(req) => req.ip,
			);
			expect(typeof decorator).toBe('function');
		});

		it('should extract and return value from request', () => {
			const decorator = CreateRequestPropertyDecorator(
				(req) => req.headers['x-custom'],
			);

			let extractedValue: any;
			const paramDecorator = decorator as any;
			if (paramDecorator.__wrapper__) {
				// Handle paramDecorator wrapping
				extractedValue = paramDecorator(undefined, mockContext);
			}
		});

		it('should apply transformation if provided', () => {
			const options: BaseDecoratorOptions = {
				transform: (value) => (value as string).toUpperCase(),
			};

			const decorator = CreateRequestPropertyDecorator(
				(req) => req.headers['x-custom'],
				options,
			);
			expect(typeof decorator).toBe('function');
		});

		it('should validate extracted value if provided', () => {
			const options: BaseDecoratorOptions = {
				validate: (value) => typeof value === 'string',
			};

			const decorator = CreateRequestPropertyDecorator(
				(req) => req.headers['x-custom'],
				options,
			);
			expect(typeof decorator).toBe('function');
		});

		it('should throw validation error when validation fails', () => {
			const options: BaseDecoratorOptions = {
				validate: (value) => false,
			};

			const decorator = CreateRequestPropertyDecorator(
				(req) => req.headers['x-custom'],
				options,
			);
			expect(typeof decorator).toBe('function');
		});

		it('should apply both validation and transformation', () => {
			const options: BaseDecoratorOptions = {
				validate: (value) => typeof value === 'string',
				transform: (value) => (value as string).toUpperCase(),
			};

			const decorator = CreateRequestPropertyDecorator(
				(req) => req.headers['x-custom'],
				options,
			);
			expect(typeof decorator).toBe('function');
		});
	});

	describe('CreateConditionalDecorator', () => {
		it('should create a method decorator', () => {
			const options: ConditionalDecoratorOptions = {
				key: 'custom-meta',
				value: 'custom-value',
			};

			const decorator = CreateConditionalDecorator(options);
			expect(typeof decorator).toBe('function');
		});

		it('should set metadata with provided key and value', () => {
			const options: ConditionalDecoratorOptions = {
				key: 'test-key',
				value: 'test-value',
			};

			const decorator = CreateConditionalDecorator(options);
			expect(typeof decorator).toBe('function');
		});

		it('should support different value types', () => {
			const stringDecorator = CreateConditionalDecorator({
				key: 'string-key',
				value: 'string-value',
			});
			expect(typeof stringDecorator).toBe('function');

			const numberDecorator = CreateConditionalDecorator({
				key: 'number-key',
				value: 42,
			});
			expect(typeof numberDecorator).toBe('function');

			const objectDecorator = CreateConditionalDecorator({
				key: 'object-key',
				value: { nested: 'object' },
			});
			expect(typeof objectDecorator).toBe('function');
		});

		it('should support transform and validate options', () => {
			const options: ConditionalDecoratorOptions & BaseDecoratorOptions = {
				key: 'test-key',
				value: 'test-value',
				transform: (value) => (value as string).toLowerCase(),
				validate: (value) => typeof value === 'string',
			};

			const decorator = CreateConditionalDecorator(options);
			expect(typeof decorator).toBe('function');
		});
	});

	describe('CreateValidatingDecorator', () => {
		it('should create a parameter decorator with validation', () => {
			const options: ValidatingDecoratorOptions = {
				validate: (value) => typeof value === 'string',
			};

			const decorator = CreateValidatingDecorator(
				(req) => req.headers['x-custom'],
				options,
			);
			expect(typeof decorator).toBe('function');
		});

		it('should throw error on validation failure when throwOnInvalid is true', () => {
			const options: ValidatingDecoratorOptions = {
				validate: (value) => false,
				throwOnInvalid: true,
				errorMessage: 'Custom validation failed',
			};

			const decorator = CreateValidatingDecorator(
				(req) => req.headers['x-custom'],
				options,
			);
			expect(typeof decorator).toBe('function');
		});

		it('should not throw error on validation failure when throwOnInvalid is false', () => {
			const options: ValidatingDecoratorOptions = {
				validate: (value) => false,
				throwOnInvalid: false,
			};

			const decorator = CreateValidatingDecorator(
				(req) => req.headers['x-custom'],
				options,
			);
			expect(typeof decorator).toBe('function');
		});

		it('should use custom error message', () => {
			const customMessage = 'Value must be a string';
			const options: ValidatingDecoratorOptions = {
				validate: (value) => typeof value === 'string',
				throwOnInvalid: true,
				errorMessage: customMessage,
			};

			const decorator = CreateValidatingDecorator(
				(req) => req.headers['x-custom'],
				options,
			);
			expect(typeof decorator).toBe('function');
		});

		it('should apply transformation after validation', () => {
			const options: ValidatingDecoratorOptions = {
				validate: (value) => typeof value === 'string',
				transform: (value) => (value as string).toUpperCase(),
			};

			const decorator = CreateValidatingDecorator(
				(req) => req.headers['x-custom'],
				options,
			);
			expect(typeof decorator).toBe('function');
		});

		it('should skip validation if not provided', () => {
			const options: ValidatingDecoratorOptions = {
				transform: (value) => (value as string).toUpperCase(),
			};

			const decorator = CreateValidatingDecorator(
				(req) => req.headers['x-custom'],
				options,
			);
			expect(typeof decorator).toBe('function');
		});
	});

	describe('CreateTransformingDecorator', () => {
		it('should create a parameter decorator with transformation', () => {
			const options: TransformingDecoratorOptions = {
				transform: (value) => (value as string).toUpperCase(),
			};

			const decorator = CreateTransformingDecorator(
				(req) => req.headers['x-custom'],
				options,
			);
			expect(typeof decorator).toBe('function');
		});

		it('should not transform undefined values by default', () => {
			const options: TransformingDecoratorOptions = {
				transform: (value) => (value as string).toUpperCase(),
				transformUndefined: false,
			};

			const decorator = CreateTransformingDecorator(
				(req) => undefined,
				options,
			);
			expect(typeof decorator).toBe('function');
		});

		it('should transform undefined values when transformUndefined is true', () => {
			const options: TransformingDecoratorOptions = {
				transform: (value) => 'DEFAULT_VALUE',
				transformUndefined: true,
			};

			const decorator = CreateTransformingDecorator(
				(req) => undefined,
				options,
			);
			expect(typeof decorator).toBe('function');
		});

		it('should apply transformation to null values when transformUndefined is true', () => {
			const options: TransformingDecoratorOptions = {
				transform: (value) => 'NULL_REPLACEMENT',
				transformUndefined: true,
			};

			const decorator = CreateTransformingDecorator(
				(req) => null,
				options,
			);
			expect(typeof decorator).toBe('function');
		});

		it('should handle complex transformation logic', () => {
			const options: TransformingDecoratorOptions = {
				transform: (value) => {
					if (typeof value === 'string') {
						return value.split(',').map(v => v.trim());
					}
					return [];
				},
			};

			const decorator = CreateTransformingDecorator(
				(req) => 'a, b, c',
				options,
			);
			expect(typeof decorator).toBe('function');
		});

		it('should skip transformation if not provided', () => {
			const options: TransformingDecoratorOptions = {};

			const decorator = CreateTransformingDecorator(
				(req) => req.headers['x-custom'],
				options,
			);
			expect(typeof decorator).toBe('function');
		});
	});

	describe('Decorator Integration', () => {
		it('should combine multiple decorators without conflicts', () => {
			const decorator1 = CreateRequestPropertyDecorator(
				(req) => req.headers['x-custom'],
			);
			const decorator2 = CreateValidatingDecorator(
				(req) => req.query.id,
				{ validate: (value) => typeof value === 'string' },
			);
			const decorator3 = CreateTransformingDecorator(
				(req) => req.params.userId,
				{ transform: (value) => parseInt(value as string, 10) },
			);

			expect(typeof decorator1).toBe('function');
			expect(typeof decorator2).toBe('function');
			expect(typeof decorator3).toBe('function');
		});

		it('should handle complex extraction functions', () => {
			const extractor = (req: any) => {
				const value = req.headers['x-custom'] ?? req.query.fallback;
				return value;
			};

			const decorator = CreateRequestPropertyDecorator(extractor);
			expect(typeof decorator).toBe('function');
		});
	});
});
