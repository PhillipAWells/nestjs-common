import { ObjectIdScalar } from '../../graphql/scalars/object-id.scalar.js';
import { ObjectId } from 'mongodb';
import { Kind } from 'graphql';

describe('ObjectIdScalar', () => {
	let scalar: ObjectIdScalar;

	beforeEach(() => {
		scalar = new ObjectIdScalar();
	});

	describe('parseValue', () => {
		it('should parse valid ObjectId string', () => {
			const validId = new ObjectId().toHexString();
			const result = scalar.parseValue(validId);

			expect(result).toBeInstanceOf(ObjectId);
			expect(result.toHexString()).toBe(validId);
		});

		it('should throw error for invalid string', () => {
			expect(() => scalar.parseValue('invalid')).toThrow('Invalid ObjectId format');
		});

		it('should throw error for non-string', () => {
			expect(() => scalar.parseValue(123)).toThrow('ObjectId must be a string');
		});
	});

	describe('serialize', () => {
		it('should serialize ObjectId to string', () => {
			const objectId = new ObjectId();
			const result = scalar.serialize(objectId);

			expect(result).toBe(objectId.toHexString());
		});

		it('should throw error for non-ObjectId', () => {
			expect(() => scalar.serialize('not an objectid' as any)).toThrow('Value must be an ObjectId instance');
		});
	});

	describe('parseLiteral', () => {
		it('should parse valid ObjectId string literal', () => {
			const validId = new ObjectId().toHexString();
			const ast = { kind: Kind.STRING, value: validId } as any;
			const result = scalar.parseLiteral(ast);

			expect(result).toBeInstanceOf(ObjectId);
			expect(result!.toHexString()).toBe(validId);
		});

		it('should throw error for invalid string literal', () => {
			const ast = { kind: Kind.STRING, value: 'invalid' } as any;
			expect(() => scalar.parseLiteral(ast)).toThrow('Invalid ObjectId format');
		});

		it('should throw error for non-string literal', () => {
			const ast = { kind: Kind.INT, value: '123' } as any;
			expect(() => scalar.parseLiteral(ast)).toThrow('ObjectId must be a string');
		});
	});
});
