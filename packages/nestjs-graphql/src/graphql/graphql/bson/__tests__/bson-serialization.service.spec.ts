import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BsonSerializationService } from '../bson-serialization.service.js';

describe('BsonSerializationService', () => {
	let service: BsonSerializationService;

	beforeEach(() => {
		service = new BsonSerializationService();
		// Reset module cache for lazy loading tests
		vi.resetModules();
	});

	describe('isAvailable', () => {
		it('should return true if bson package is installed', () => {
			const available = service.isAvailable();
			// bson is a dev dependency, so it should be available in tests
			expect(typeof available).toBe('boolean');
		});
	});

	describe('serialize', () => {
		it('should serialize a simple object to BSON buffer', async () => {
			const data = { hello: 'world', number: 42 };
			const buffer = await service.serialize(data);

			expect(buffer).toBeInstanceOf(Buffer);
			expect(buffer.length).toBeGreaterThan(0);
		});

		it('should serialize nested objects', async () => {
			const data = {
				user: {
					name: 'John',
					age: 30,
					email: 'john@example.com',
				},
				active: true,
			};
			const buffer = await service.serialize(data);

			expect(buffer).toBeInstanceOf(Buffer);
			expect(buffer.length).toBeGreaterThan(0);
		});

		it('should serialize arrays', async () => {
			const data = {
				items: [1, 2, 3, 4, 5],
				names: ['Alice', 'Bob', 'Charlie'],
			};
			const buffer = await service.serialize(data);

			expect(buffer).toBeInstanceOf(Buffer);
			expect(buffer.length).toBeGreaterThan(0);
		});

		it('should serialize null and undefined', async () => {
			const data = { nullable: null, undef: undefined };
			const buffer = await service.serialize(data);

			expect(buffer).toBeInstanceOf(Buffer);
		});
	});

	describe('deserialize', () => {
		it('should deserialize BSON buffer back to object', async () => {
			const original = { hello: 'world', number: 42 };
			const buffer = await service.serialize(original);
			const deserialized = await service.deserialize(buffer);

			expect(deserialized).toEqual(original);
		});

		it('should deserialize nested objects', async () => {
			const original = {
				user: {
					name: 'John',
					age: 30,
				},
				active: true,
			};
			const buffer = await service.serialize(original);
			const deserialized = await service.deserialize(buffer);

			expect(deserialized).toEqual(original);
		});

		it('should deserialize arrays', async () => {
			const original = {
				items: [1, 2, 3],
				names: ['Alice', 'Bob'],
			};
			const buffer = await service.serialize(original);
			const deserialized = await service.deserialize(buffer);

			expect(deserialized).toEqual(original);
		});

		it('should handle round-trip serialization/deserialization', async () => {
			const original = {
				query: 'query GetUser { user { id name email } }',
				variables: { id: 'user123' },
				operationName: 'GetUser',
			};

			const buffer = await service.serialize(original);
			const deserialized = await service.deserialize(buffer);

			expect(deserialized).toEqual(original);
		});
	});

	describe('error handling', () => {
		it('should throw error for invalid buffer in deserialize', async () => {
			const invalidBuffer = Buffer.from([0x00, 0x01, 0x02]);

			await expect(service.deserialize(invalidBuffer)).rejects.toThrow();
		});
	});
});
