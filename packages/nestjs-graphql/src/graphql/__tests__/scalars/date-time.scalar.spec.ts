import { DateTimeScalar } from '../../graphql/scalars/date-time.scalar.js';
import { Kind } from 'graphql';

describe('DateTimeScalar', () => {
	let scalar: DateTimeScalar;

	beforeEach(() => {
		scalar = new DateTimeScalar();
	});

	describe('parseValue', () => {
		it('should parse valid ISO string', () => {
			const isoString = '2023-01-01T12:00:00.000Z';
			const result = scalar.parseValue(isoString);

			expect(result).toBeInstanceOf(Date);
			expect(result.toISOString()).toBe(isoString);
		});

		it('should throw error for invalid string', () => {
			expect(() => scalar.parseValue('invalid')).toThrow('Invalid DateTime format');
		});

		it('should throw error for non-string', () => {
			expect(() => scalar.parseValue(123)).toThrow('DateTime must be a string');
		});
	});

	describe('serialize', () => {
		it('should serialize Date to ISO string', () => {
			const date = new Date('2023-01-01T12:00:00.000Z');
			const result = scalar.serialize(date);

			expect(result).toBe('2023-01-01T12:00:00.000Z');
		});

		it('should throw error for non-Date', () => {
			expect(() => scalar.serialize('not a date')).toThrow('Value must be a Date instance');
		});
	});

	describe('parseLiteral', () => {
		it('should parse valid ISO string literal', () => {
			const isoString = '2023-01-01T12:00:00.000Z';
			const ast = { kind: Kind.STRING, value: isoString } as any;
			const result = scalar.parseLiteral(ast);

			expect(result).toBeInstanceOf(Date);
			expect(result!.toISOString()).toBe(isoString);
		});

		it('should throw error for invalid string literal', () => {
			const ast = { kind: Kind.STRING, value: 'invalid' } as any;
			expect(() => scalar.parseLiteral(ast)).toThrow('Invalid DateTime format');
		});

		it('should throw error for non-string literal', () => {
			const ast = { kind: Kind.INT, value: '123' } as any;
			expect(() => scalar.parseLiteral(ast)).toThrow('DateTime must be a string');
		});
	});
});
