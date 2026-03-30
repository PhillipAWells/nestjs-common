import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ModuleRef } from '@nestjs/core';
import { QdrantService } from '@pawells/nestjs-qdrant';
import { ItemsService, type IStoredItem } from '../items/items.service.js';

describe('ItemsService', () => {
	let service: ItemsService;

	// Declare mocks at describe scope so individual tests can reference them for assertions.
	let mockSearch: ReturnType<typeof vi.fn>;
	let mockUpsert: ReturnType<typeof vi.fn>;
	let mockDelete: ReturnType<typeof vi.fn>;
	let mockCollection: ReturnType<typeof vi.fn>;
	let mockModuleRef: { get: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		// Create fresh spies for each test so no state leaks between tests.
		mockSearch = vi.fn();
		mockUpsert = vi.fn();
		mockDelete = vi.fn();
		mockCollection = vi.fn().mockReturnValue({ search: mockSearch, upsert: mockUpsert, delete: mockDelete });

		const mockQdrantService = { collection: mockCollection };

		mockModuleRef = { get: vi.fn() };
		mockModuleRef.get.mockImplementation((token) => {
			if (token === QdrantService) return mockQdrantService;
			return undefined;
		});

		service = new ItemsService(mockModuleRef as unknown as ModuleRef);
	});

	describe('findSimilar', () => {
		it('should return mapped items from Qdrant search results', async () => {
			mockSearch.mockResolvedValue([
				{ id: 'abc', score: 0.97, payload: { name: 'Widget A' } },
				{ id: 'def', score: 0.85, payload: { name: 'Widget B' } },
			]);

			const results = await service.findSimilar([0.1, 0.2, 0.3, 0.4]);

			expect(results).toStrictEqual([
				{ id: 'abc', name: 'Widget A' },
				{ id: 'def', name: 'Widget B' },
			]);
		});

		it('should pass vector and limit to the collection search', async () => {
			mockSearch.mockResolvedValue([]);

			await service.findSimilar([0.5, 0.6], 5);

			expect(mockCollection).toHaveBeenCalledWith('items');
			expect(mockSearch).toHaveBeenCalledWith({
				vector: [0.5, 0.6],
				limit: 5,
				with_payload: true,
			});
		});

		it('should default limit to 10', async () => {
			mockSearch.mockResolvedValue([]);

			await service.findSimilar([0.1, 0.2]);

			expect(mockSearch).toHaveBeenCalledWith(
				expect.objectContaining({ limit: 10 }),
			);
		});

		it('should return an empty array when Qdrant returns no results', async () => {
			mockSearch.mockResolvedValue([]);

			const results = await service.findSimilar([0.1]);

			expect(results).toStrictEqual([]);
		});

		it('should handle missing payload gracefully', async () => {
			mockSearch.mockResolvedValue([
				{ id: 42, score: 0.5, payload: null },
			]);

			const results = await service.findSimilar([0.1]);

			expect(results[0]).toStrictEqual({ id: '42', name: '' });
		});

		it('should propagate errors from Qdrant', async () => {
			const qdrantError = new Error('Qdrant search failed on collection "items": timeout');
			mockSearch.mockRejectedValue(qdrantError);

			await expect(service.findSimilar([0.1])).rejects.toThrow('timeout');
		});
	});

	describe('upsertItem', () => {
		const item: IStoredItem = { id: 'item-1', name: 'Test IItem', vector: [0.1, 0.2, 0.3] };

		it('should call upsert on the correct collection', async () => {
			mockUpsert.mockResolvedValue({ status: 'ok', result: { operation_id: 1 } });

			await service.upsertItem(item);

			expect(mockCollection).toHaveBeenCalledWith('items');
			expect(mockUpsert).toHaveBeenCalledWith({
				points: [{
					id: 'item-1',
					vector: [0.1, 0.2, 0.3],
					payload: { name: 'Test IItem' },
				}],
			});
		});

		it('should propagate errors from Qdrant', async () => {
			mockUpsert.mockRejectedValue(new Error('connection refused'));

			await expect(service.upsertItem(item)).rejects.toThrow('connection refused');
		});
	});

	describe('deleteItem', () => {
		it('should call delete on the correct collection', async () => {
			mockDelete.mockResolvedValue({ status: 'ok', result: { operation_id: 2 } });

			await service.deleteItem('item-1');

			expect(mockCollection).toHaveBeenCalledWith('items');
			expect(mockDelete).toHaveBeenCalledWith({ points: ['item-1'] });
		});

		it('should propagate errors from Qdrant', async () => {
			mockDelete.mockRejectedValue(new Error('not found'));

			await expect(service.deleteItem('missing')).rejects.toThrow('not found');
		});
	});
});
