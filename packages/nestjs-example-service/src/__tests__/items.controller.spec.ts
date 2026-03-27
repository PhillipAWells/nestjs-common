import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ModuleRef } from '@nestjs/core';
import { ItemsController } from '../items/items.controller.js';
import { ItemsService, type Item, type StoredItem } from '../items/items.service.js';

describe('ItemsController', () => {
	let controller: ItemsController;

	let mockFindSimilar: ReturnType<typeof vi.fn>;
	let mockUpsertItem: ReturnType<typeof vi.fn>;
	let mockDeleteItem: ReturnType<typeof vi.fn>;
	let mockModuleRef: { get: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		mockFindSimilar = vi.fn();
		mockUpsertItem = vi.fn();
		mockDeleteItem = vi.fn();

		const mockItemsService = {
			findSimilar: mockFindSimilar,
			upsertItem: mockUpsertItem,
			deleteItem: mockDeleteItem,
		};

		mockModuleRef = { get: vi.fn() };
		mockModuleRef.get.mockImplementation((token) => {
			if (token === ItemsService) return mockItemsService;
			return undefined;
		});

		controller = new ItemsController(mockModuleRef as unknown as ModuleRef);
	});

	describe('findSimilar', () => {
		it('should parse a comma-separated vector string and return items', async () => {
			const items: Item[] = [{ id: 'a', name: 'Alpha' }];
			mockFindSimilar.mockResolvedValue(items);

			const result = await controller.findSimilar('0.1,0.2,0.3');

			expect(mockFindSimilar).toHaveBeenCalledWith([0.1, 0.2, 0.3], 10);
			expect(result).toStrictEqual(items);
		});

		it('should use provided limit when specified', async () => {
			mockFindSimilar.mockResolvedValue([]);

			await controller.findSimilar('0.5,0.6', '3');

			expect(mockFindSimilar).toHaveBeenCalledWith([0.5, 0.6], 3);
		});

		it('should default limit to 10 when not specified', async () => {
			mockFindSimilar.mockResolvedValue([]);

			await controller.findSimilar('0.1');

			expect(mockFindSimilar).toHaveBeenCalledWith([0.1], 10);
		});
	});

	describe('upsertItem', () => {
		it('should delegate to ItemsService and return void', async () => {
			const body: StoredItem = { id: 'x', name: 'Xenon', vector: [0.9] };
			const fakeUser = { id: 'user-1', email: 'u@test.com', roles: [] };
			mockUpsertItem.mockResolvedValue(undefined);

			const result = await controller.upsertItem(body, fakeUser as any);

			expect(mockUpsertItem).toHaveBeenCalledWith(body);
			expect(result).toBeUndefined();
		});
	});

	describe('deleteItem', () => {
		it('should delegate to ItemsService with the given id', async () => {
			const fakeUser = { id: 'user-1', email: 'u@test.com', roles: [] };
			mockDeleteItem.mockResolvedValue(undefined);

			await controller.deleteItem('item-99', fakeUser as any);

			expect(mockDeleteItem).toHaveBeenCalledWith('item-99');
		});
	});
});
