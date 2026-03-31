
import { GraphQLService } from '../../graphql/graphql.service.js';
import { GraphQLSchema, GraphQLObjectType, GraphQLString } from 'graphql';
import { GraphQLErrorCode } from '../../graphql/types/graphql-safety.types.js';

describe('GraphQL Service - Advanced Schema & Error Handling', () => {
	let service: GraphQLService;
	let validSchema: GraphQLSchema;

	beforeEach(() => {
		service = new GraphQLService();

		// Create valid GraphQL schema for testing
		validSchema = new GraphQLSchema({
			query: new GraphQLObjectType({
				name: 'Query',
				fields: {
					hello: {
						type: GraphQLString,
						resolve: () => 'world',
					},
				},
			}),
		});
	});

	describe('validateSchema() - Schema Validation', () => {
		it('should validate schema with query type', () => {
			expect(() => {
				service.ValidateSchema(validSchema);
			}).not.toThrow();

			expect(service.GetSchema()).toBe(validSchema);
		});

		it('should throw error for null schema', () => {
			expect(() => {
				service.ValidateSchema(null as any);
			}).toThrow('GraphQL schema is required');
		});

		it('should throw error for schema without query type', () => {
			const invalidSchema = new GraphQLSchema({});

			expect(() => {
				service.ValidateSchema(invalidSchema);
			}).toThrow('GraphQL schema must have a query type');
		});

		it('should update schema when validating new schema', () => {
			service.ValidateSchema(validSchema);
			expect(service.GetSchema()).toBe(validSchema);

			const newSchema = new GraphQLSchema({
				query: new GraphQLObjectType({
					name: 'Query',
					fields: {
						test: {
							type: GraphQLString,
							resolve: () => 'test',
						},
					},
				}),
			});

			service.ValidateSchema(newSchema);
			expect(service.GetSchema()).toBe(newSchema);
		});
	});

	describe('formatError() - Error Formatting', () => {
		it('should format Error instance with default code', () => {
			const error = new Error('Test error message');
			const formatted = service.FormatError(error);

			expect(formatted.message).toBe('Test error message');
			expect((formatted.extensions as any).code).toBe(GraphQLErrorCode.INTERNAL_ERROR);
		});

		it('should format error with validation code', () => {
			const error = new Error('Validation failed for input');
			const formatted = service.FormatError(error);

			expect((formatted.extensions as any).code).toBe(GraphQLErrorCode.VALIDATION_ERROR);
		});

		it('should format error with authentication code', () => {
			const error = new Error('Authentication required');
			const formatted = service.FormatError(error);

			expect((formatted.extensions as any).code).toBe(GraphQLErrorCode.UNAUTHENTICATED);
		});

		it('should format error with authorization code', () => {
			const error = new Error('Authorization denied');
			const formatted = service.FormatError(error);

			expect((formatted.extensions as any).code).toBe(GraphQLErrorCode.FORBIDDEN);
		});

		it('should format error with not found code', () => {
			const error = new Error('Resource not found');
			const formatted = service.FormatError(error);

			expect((formatted.extensions as any).code).toBe(GraphQLErrorCode.NOT_FOUND);
		});

		it('should include stack trace when configured', () => {
			const error = new Error('Test error');
			const config = {
				errorHandling: {
					includeStackTrace: true,
				},
			};

			const formatted = service.FormatError(error, config);

			expect((formatted.extensions as any).stack).toBeDefined();
		});

		it('should not include stack trace by default', () => {
			const error = new Error('Test error');
			const formatted = service.FormatError(error);

			expect((formatted.extensions as any).stack).toBeUndefined();
		});

		it('should format error record objects', () => {
			const errorRecord = {
				message: 'Custom error',
				extensions: {
					customField: 'value',
				},
			};

			const formatted = service.FormatError(errorRecord);

			expect(formatted.message).toBe('Custom error');
			expect((formatted.extensions as any).customField).toBe('value');
			expect((formatted.extensions as any).code).toBe(GraphQLErrorCode.INTERNAL_ERROR);
		});
	});

	describe('createCursor() & decodeCursor() - Cursor Management', () => {
		it('should create cursor from id and timestamp', () => {
			const cursor = service.CreateCursor('user-123', 1234567890);

			expect(cursor).toBeDefined();
			expect(typeof cursor).toBe('string');
		});

		it('should create cursor with current timestamp if not provided', () => {
			const cursor = service.CreateCursor('user-123');

			const decoded = service.DecodeCursor(cursor);
			expect(decoded.id).toBe('user-123');
			expect(decoded.timestamp).toBeDefined();
		});

		it('should decode cursor back to original data', () => {
			const cursor = service.CreateCursor('user-456', 9876543210);
			const decoded = service.DecodeCursor(cursor);

			expect(decoded.id).toBe('user-456');
			expect(decoded.timestamp).toBe(9876543210);
		});

		it('should throw error for invalid cursor format', () => {
			expect(() => {
				service.DecodeCursor('invalid-cursor-data');
			}).toThrow('Invalid cursor format');
		});

		it('should handle base64 encoded but non-JSON cursor', () => {
			const invalidCursor = Buffer.from('not json data').toString('base64');

			expect(() => {
				service.DecodeCursor(invalidCursor);
			}).toThrow('Invalid cursor format');
		});
	});

	describe('paginateItems() - Pagination Logic', () => {
		const items = [
			{ id: '1', createdAt: new Date('2024-01-01') },
			{ id: '2', createdAt: new Date('2024-01-02') },
			{ id: '3', createdAt: new Date('2024-01-03') },
			{ id: '4', createdAt: new Date('2024-01-04') },
			{ id: '5', createdAt: new Date('2024-01-05') },
		];

		it('should paginate items with first parameter', () => {
			const result = service.PaginateItems(items, 3);

			expect(result.edges.length).toBe(3);
			expect(result.edges[0]?.node.id).toBe('1');
			expect(result.edges[2]?.node.id).toBe('3');
			expect(result.pageInfo.hasNextPage).toBe(true);
			expect(result.pageInfo.hasPreviousPage).toBe(false);
		});

		it('should paginate items with after cursor', () => {
			const cursor = service.CreateCursor('2', items[1]!.createdAt!.getTime());
			const result = service.PaginateItems(items, 2, cursor);

			expect(result.edges.length).toBe(2);
			expect(result.edges[0]?.node.id).toBe('3');
			expect(result.edges[1]?.node.id).toBe('4');
		});

		it('should return all items when first is not provided', () => {
			const result = service.PaginateItems(items);

			expect(result.edges.length).toBe(5);
			expect(result.pageInfo.hasNextPage).toBe(false);
		});

		it('should set hasNextPage to false on last page', () => {
			const result = service.PaginateItems(items, 10);

			expect(result.pageInfo.hasNextPage).toBe(false);
		});

		it('should handle empty items array', () => {
			const result = service.PaginateItems([]);

			expect(result.edges.length).toBe(0);
			expect(result.pageInfo.startCursor).toBeUndefined();
			expect(result.pageInfo.endCursor).toBeUndefined();
		});

		it('should set startCursor and endCursor correctly', () => {
			const result = service.PaginateItems(items, 3);

			expect(result.pageInfo.startCursor).toBeDefined();
			expect(result.pageInfo.endCursor).toBeDefined();

			const startDecoded = service.DecodeCursor(result.pageInfo.startCursor!);
			const endDecoded = service.DecodeCursor(result.pageInfo.endCursor!);

			expect(startDecoded.id).toBe('1');
			expect(endDecoded.id).toBe('3');
		});

		it('should handle invalid after cursor gracefully', () => {
			const invalidCursor = service.CreateCursor('non-existent-id');
			const result = service.PaginateItems(items, 3, invalidCursor);

			// Should start from beginning when cursor ID not found
			expect(result.edges.length).toBe(3);
			expect(result.edges[0]?.node.id).toBe('1');
		});
	});
});
