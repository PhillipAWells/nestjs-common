
import { Connection, Edge, CursorUtils } from '../../graphql/types/connection.type.js';

describe('Connection Types', () => {
	describe('CursorUtils', () => {
		describe('encodeCursor', () => {
			it('should encode cursor data to base64', () => {
				const cursor = CursorUtils.encodeCursor('123', 1234567890);

				expect(cursor).toBeDefined();
				expect(typeof cursor).toBe('string');

				const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
				const data = JSON.parse(decoded);

				expect(data).toEqual({ id: '123', timestamp: 1234567890 });
			});
		});

		describe('decodeCursor', () => {
			it('should decode valid cursor', () => {
				const original = { id: '123', timestamp: 1234567890 };
				const encoded = Buffer.from(JSON.stringify(original)).toString('base64');

				const decoded = CursorUtils.decodeCursor(encoded);

				expect(decoded).toEqual(original);
			});

			it('should throw error for invalid base64', () => {
				expect(() => CursorUtils.decodeCursor('invalid')).toThrow('Invalid cursor format');
			});

			it('should throw error for invalid JSON', () => {
				const invalidJson = Buffer.from('not json').toString('base64');
				expect(() => CursorUtils.decodeCursor(invalidJson)).toThrow('Invalid cursor format');
			});
		});

		describe('createCursor', () => {
			it('should create cursor from entity with createdAt', () => {
				const entity = { id: '123', createdAt: new Date('2023-01-01') };
				const cursor = CursorUtils.createCursor(entity);

				const decoded = CursorUtils.decodeCursor(cursor);

				expect(decoded.id).toBe('123');
				expect(decoded.timestamp).toBe(entity.createdAt.getTime());
			});

			it('should create cursor from entity without createdAt', () => {
				const entity = { id: '123' };
				const cursor = CursorUtils.createCursor(entity);

				const decoded = CursorUtils.decodeCursor(cursor);

				expect(decoded.id).toBe('123');
				expect(decoded.timestamp).toBeDefined();
			});
		});
	});

	describe('Connection and Edge factories', () => {
		class TestEntity {
			public Id!: string;

			public Name!: string;
		}

		it('should create Edge type', () => {
			const EdgeType = Edge(TestEntity);

			expect(EdgeType).toBeDefined();
			expect(EdgeType.name).toBe('EdgeClass');
		});

		it('should create Connection type', () => {
			const ConnectionType = Connection(TestEntity);

			expect(ConnectionType).toBeDefined();
			expect(ConnectionType.name).toBe('ConnectionClass');
		});
	});
});
