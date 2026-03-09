import { Test, TestingModule } from '@nestjs/testing';
import { GraphQLService } from '../graphql/graphql.service.js';
import { GraphQLSchema } from 'graphql';

describe('GraphQLService', () => {
	let service: GraphQLService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [GraphQLService]
		}).compile();

		service = module.get<GraphQLService>(GraphQLService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('validateSchema', () => {
		it('should validate a valid schema', () => {
			const schema = new GraphQLSchema({
				query: undefined // Will be set later
			});

			// Mock schema with query type
			Object.defineProperty(schema, 'getQueryType', {
				value: () => ({})
			});

			expect(() => service.validateSchema(schema)).not.toThrow();
			expect(service.getSchema()).toBe(schema);
		});

		it('should throw error for invalid schema', () => {
			const schema = new GraphQLSchema({});

			expect(() => service.validateSchema(schema)).toThrow('GraphQL schema must have a query type');
		});
	});

	describe('formatError', () => {
		it('should format validation error', () => {
			const error = { message: 'validation error' };
			const formatted = service.formatError(error);

			expect(formatted.extensions.code).toBe('VALIDATION_ERROR');
		});

		it('should format authentication error', () => {
			const error = { message: 'authentication failed' };
			const formatted = service.formatError(error);

			expect(formatted.extensions.code).toBe('AUTHENTICATION_ERROR');
		});

		it('should format unknown error as internal error', () => {
			const error = { message: 'some error' };
			const formatted = service.formatError(error);

			expect(formatted.extensions.code).toBe('INTERNAL_ERROR');
		});
	});

	describe('createCursor', () => {
		it('should create base64 encoded cursor', () => {
			const cursor = service.createCursor('123', 1234567890);

			expect(cursor).toBeDefined();
			expect(typeof cursor).toBe('string');

			// Should be valid base64
			expect(() => Buffer.from(cursor, 'base64')).not.toThrow();
		});
	});

	describe('decodeCursor', () => {
		it('should decode valid cursor', () => {
			const original = { id: '123', timestamp: 1234567890 };
			const cursor = Buffer.from(JSON.stringify(original)).toString('base64');

			const decoded = service.decodeCursor(cursor);

			expect(decoded).toEqual(original);
		});

		it('should throw error for invalid cursor', () => {
			expect(() => service.decodeCursor('invalid')).toThrow('Invalid cursor format');
		});
	});

	describe('paginateItems', () => {
		const items = [
			{ id: '1', name: 'Item 1', createdAt: new Date('2023-01-01') },
			{ id: '2', name: 'Item 2', createdAt: new Date('2023-01-02') },
			{ id: '3', name: 'Item 3', createdAt: new Date('2023-01-03') }
		];

		it('should return all items when no pagination', () => {
			const result = service.paginateItems(items);

			expect(result.edges).toHaveLength(3);
			expect(result.pageInfo.hasNextPage).toBe(false);
			expect(result.pageInfo.hasPreviousPage).toBe(false);
		});

		it('should paginate with first parameter', () => {
			const result = service.paginateItems(items, 2);

			expect(result.edges).toHaveLength(2);
			expect(result.pageInfo.hasNextPage).toBe(true);
			expect(result.pageInfo.hasPreviousPage).toBe(false);
		});

		it('should paginate with after cursor', () => {
			const cursor = service.createCursor('1');
			const result = service.paginateItems(items, 2, cursor);

			expect(result.edges).toHaveLength(2);
			expect(result.edges[0].node.id).toBe('2');
			expect(result.pageInfo.hasPreviousPage).toBe(true);
		});
	});
});
