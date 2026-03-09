import { BadRequestException } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { GraphQLErrorFormatter } from './error-formatter.js';

describe('GraphQLErrorFormatter', () => {
	describe('formatError', () => {
		it('should format a basic GraphQL error', () => {
			const error = new GraphQLError('Test error');

			const formatted = GraphQLErrorFormatter.formatError(error);

			expect(formatted.message).toBeDefined();
			expect((formatted.extensions as any)).toBeDefined();
			expect((formatted.extensions as any).code).toBeDefined();
			expect((formatted.extensions as any).timestamp).toBeDefined();
		});

		it('should include user context in error object', () => {
			const error = new GraphQLError('Test error');
			const request = {
				user: { id: 'user_123', email: 'test@example.com' },
				operationName: 'GetUser',
			} as any;

			const formatted = GraphQLErrorFormatter.formatError(error, request);

			expect((formatted.extensions as any)).toBeDefined();
			expect((formatted.extensions as any).userId).toBe('user_123');
			expect((formatted.extensions as any).operationName).toBe('GetUser');
			expect((formatted.extensions as any).timestamp).toBeDefined();
		});

		it('should include error code in extensions', () => {
			const error = new GraphQLError('Invalid input');
			(error as any).originalError = new BadRequestException('Invalid input');
			const request = {} as any;

			const formatted = GraphQLErrorFormatter.formatError(error, request);

			expect((formatted.extensions as any).code).toBeDefined();
			expect((formatted.extensions as any).statusCode).toBeDefined();
		});

		it('should handle missing user context gracefully', () => {
			const error = new GraphQLError('Test error');
			const request = {
				operationName: 'GetUser',
			} as any;

			const formatted = GraphQLErrorFormatter.formatError(error, request);

			expect((formatted.extensions as any)).toBeDefined();
			expect((formatted.extensions as any).userId).toBeUndefined();
			expect((formatted.extensions as any).operationName).toBe('GetUser');
		});

		it('should handle missing operationName gracefully', () => {
			const error = new GraphQLError('Test error');
			const request = {
				user: { id: 'user_456' },
			} as any;

			const formatted = GraphQLErrorFormatter.formatError(error, request);

			expect((formatted.extensions as any)).toBeDefined();
			expect((formatted.extensions as any).userId).toBe('user_456');
			expect((formatted.extensions as any).operationName).toBeUndefined();
		});

		it('should include timestamp in all errors', () => {
			const error = new GraphQLError('Test error');
			const request = {} as any;

			const formatted = GraphQLErrorFormatter.formatError(error, request);

			expect((formatted.extensions as any).timestamp).toBeDefined();
			expect(typeof (formatted.extensions as any).timestamp).toBe('string');
		});

		it('should handle null/undefined context', () => {
			const error = new GraphQLError('Test error');

			const formatted = GraphQLErrorFormatter.formatError(error, undefined);

			expect((formatted.extensions as any)).toBeDefined();
			expect((formatted.extensions as any).timestamp).toBeDefined();
		});

		it('should extract user id from nested user object', () => {
			const error = new GraphQLError('Test error');
			const request = {
				user: { id: 'nested_user_id', name: 'John' },
			} as any;

			const formatted = GraphQLErrorFormatter.formatError(error, request);

			expect((formatted.extensions as any).userId).toBe('nested_user_id');
		});

		it('should preserve other extensions when adding context', () => {
			const error = new GraphQLError('Test error');
			(error as any).originalError = new BadRequestException('Bad request');
			const request = {
				user: { id: 'user_789' },
				operationName: 'CreateUser',
			} as any;

			const formatted = GraphQLErrorFormatter.formatError(error, request);

			expect((formatted.extensions as any).userId).toBe('user_789');
			expect((formatted.extensions as any).operationName).toBe('CreateUser');
			expect((formatted.extensions as any).timestamp).toBeDefined();
		});
	});
});
