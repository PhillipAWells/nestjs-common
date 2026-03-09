
import { Test, TestingModule } from '@nestjs/testing';
import { GraphQLService } from '../../graphql/graphql.service.js';
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from 'graphql';
import { ICursorData, GraphQLErrorCode } from '../../graphql/types/graphql-safety.types.js';

describe('GraphQLService - Type Safety', () => {
	let service: GraphQLService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [GraphQLService],
		}).compile();

		service = module.get<GraphQLService>(GraphQLService);
	});

	describe('Schema validation with typed returns', () => {
		it('should validate schema and return typed schema', () => {
			const queryType = new GraphQLObjectType({
				name: 'Query',
				fields: {
					hello: {
						type: GraphQLString,
					},
				},
			});

			const schema = new GraphQLSchema({
				query: queryType,
			});

			// Type-safe validation
			expect(() => service.validateSchema(schema)).not.toThrow();

			const retrievedSchema = service.getSchema();

			expect(retrievedSchema).toEqual(schema);
			expect(retrievedSchema).toBeInstanceOf(GraphQLSchema);
		});

		it('should throw error for invalid schema with typed error', () => {
			const invalidSchema = new GraphQLSchema({});

			expect(() => service.validateSchema(invalidSchema)).toThrow(
				'GraphQL schema must have a query type',
			);
		});
	});

	describe('Cursor creation with typed data', () => {
		it('should create properly typed cursor from ID and timestamp', () => {
			const cursor = service.createCursor('item-123', 1_635_700_000);

			expect(typeof cursor).toBe('string');
			expect(cursor.length).toBeGreaterThan(0);

			// Should be valid base64
			expect(() => Buffer.from(cursor, 'base64')).not.toThrow();
		});

		it('should create cursor with auto-generated timestamp', () => {
			const beforeTime = Date.now();
			const cursor = service.createCursor('item-456');
			const afterTime = Date.now();

			expect(typeof cursor).toBe('string');

			// Verify it can be decoded
			const decoded = service.decodeCursor(cursor);

			expect(decoded.id).toBe('item-456');
			expect(decoded.timestamp).toBeGreaterThanOrEqual(beforeTime);
			expect(decoded.timestamp).toBeLessThanOrEqual(afterTime);
		});
	});

	describe('Cursor decoding with typed returns', () => {
		it('should decode cursor and return typed data', () => {
			const originalData: ICursorData = {
				id: 'test-id-789',
				timestamp: 1_609_459_200_000,
			};

			const cursor = Buffer.from(JSON.stringify(originalData)).toString('base64');
			const decoded = service.decodeCursor(cursor);

			// Type-safe access to decoded data
			const { id } = decoded;
			const { timestamp } = decoded;

			expect(id).toBe('test-id-789');
			expect(timestamp).toBe(1_609_459_200_000);
		});

		it('should throw error for invalid cursor', () => {
			expect(() => service.decodeCursor('invalid-base64!')).toThrow(
				'Invalid cursor format',
			);
		});
	});

	describe('Pagination with typed results', () => {
		const createTestItems = (
			count: number,
		): Array<{ id: string; name: string; createdAt: Date }> => {
			return Array.from({ length: count }, (_, i) => ({
				id: `item-${i + 1}`,
				name: `Item ${i + 1}`,
				createdAt: new Date(`2023-01-${String(i + 1).padStart(2, '0')}`),
			}));
		};

		it('should paginate items and return typed result', () => {
			const items = createTestItems(5);

			const result = service.paginateItems(items, 2);

			// Type-safe access to pagination result
			const { edges } = result;

			expect(edges).toHaveLength(2);
			expect(edges[0].node.id).toBe('item-1');
			expect(edges[1].node.id).toBe('item-2');
			expect(result.pageInfo.hasNextPage).toBe(true);
			expect(result.pageInfo.hasPreviousPage).toBe(false);
		});

		it('should handle pagination without items', () => {
			const items: Array<{ id: string; createdAt?: Date }> = [];

			const result = service.paginateItems(items);

			expect(result.edges).toHaveLength(0);
			expect(result.pageInfo.hasNextPage).toBe(false);
			expect(result.pageInfo.hasPreviousPage).toBe(false);
			expect(result.pageInfo.startCursor).toBeUndefined();
		});

		it('should paginate with cursor and return typed result', () => {
			const items = createTestItems(5);
			const cursor = service.createCursor('item-2', 1_672_531_200_000);

			const result = service.paginateItems(items, 2, cursor);

			expect(result.edges).toHaveLength(2);
			expect(result.edges[0].node.id).toBe('item-3');
			expect(result.pageInfo.hasPreviousPage).toBe(true);
		});

		it('should include proper cursors in edges', () => {
			const items = createTestItems(3);

			const result = service.paginateItems(items, 2);

			result.edges.forEach((edge) => {
				expect(typeof edge.cursor).toBe('string');
				expect(edge.cursor.length).toBeGreaterThan(0);

				// Verify cursor can be decoded
				const decoded = service.decodeCursor(edge.cursor);

				expect(typeof decoded.id).toBe('string');
				expect(typeof decoded.timestamp).toBe('number');
			});
		});

		it('should set page info cursors correctly', () => {
			const items = createTestItems(4);

			const result = service.paginateItems(items, 2);

			expect(result.pageInfo.startCursor).toBeDefined();
			expect(result.pageInfo.endCursor).toBeDefined();
			expect(result.pageInfo.startCursor).not.toBe(result.pageInfo.endCursor);
		});
	});

	describe('Error formatting with typed returns', () => {
		it('should format error with typed return value', () => {
			const error = new Error('Validation failed');

			const formatted = service.formatError(error);

			expect(formatted).toBeDefined();
			expect(formatted.message).toBe('Validation failed');
			expect((formatted.extensions as any)).toBeDefined();
			expect(typeof formatted.extensions.code).toBe('string');
		});

		it('should map validation errors correctly', () => {
			const error = new Error('validation failed');

			const formatted = service.formatError(error);

			expect((formatted.extensions as any).code).toBe(GraphQLErrorCode.VALIDATION_ERROR);
		});

		it('should map authentication errors correctly', () => {
			const error = new Error('authentication failed');

			const formatted = service.formatError(error);

			expect((formatted.extensions as any).code).toBe(GraphQLErrorCode.AUTHENTICATION_ERROR);
		});

		it('should map authorization errors correctly', () => {
			const error = new Error('authorization failed');

			const formatted = service.formatError(error);

			expect((formatted.extensions as any).code).toBe(GraphQLErrorCode.AUTHORIZATION_ERROR);
		});

		it('should map not found errors correctly', () => {
			const error = new Error('Resource not found');

			const formatted = service.formatError(error);

			expect((formatted.extensions as any).code).toBe(GraphQLErrorCode.NOT_FOUND_ERROR);
		});

		it('should default to internal error', () => {
			const error = new Error('Something unexpected happened');

			const formatted = service.formatError(error);

			expect((formatted.extensions as any).code).toBe(GraphQLErrorCode.INTERNAL_ERROR);
		});

		it('should include stack trace in development', () => {
			const originalEnv = process.env['NODE_ENV'];

			try {
				process.env['NODE_ENV'] = 'development';

				const error = new Error('Test error');
				const formatted = service.formatError(error);

				expect((formatted.extensions as any).stack).toBeDefined();
			} finally {
				process.env['NODE_ENV'] = originalEnv;
			}
		});

		it('should exclude stack trace in production', () => {
			const originalEnv = process.env['NODE_ENV'];

			try {
				process.env['NODE_ENV'] = 'production';

				const error = new Error('Test error');
				const formatted = service.formatError(error);

				expect((formatted.extensions as any).stack).toBeUndefined();
			} finally {
				process.env['NODE_ENV'] = originalEnv;
			}
		});
	});

	describe('Type safety at compile time', () => {
		it('should provide typed pagination result interface', () => {
			interface TestItem {
				id: string;
				name: string;
				createdAt?: Date;
			}

			const items: TestItem[] = [
				{ id: 'test-1', name: 'Test 1', createdAt: new Date() },
			];

			const result = service.paginateItems(items, 1);

			// Type-safe access
			const firstEdge = result.edges[0];

			expect(firstEdge).toBeDefined();
			expect(firstEdge.node.id).toBe('test-1');
			expect(firstEdge.node.name).toBe('Test 1');
		});

		it('should properly type cursor data', () => {
			const cursorData: ICursorData = {
				id: 'test-cursor-id',
				timestamp: Date.now(),
			};

			expect(typeof cursorData.id).toBe('string');
			expect(typeof cursorData.timestamp).toBe('number');
		});

		it('should type error code enum correctly', () => {
			const errorCode: GraphQLErrorCode = GraphQLErrorCode.INTERNAL_ERROR;

			expect(errorCode).toBe('INTERNAL_ERROR');
		});
	});
});
