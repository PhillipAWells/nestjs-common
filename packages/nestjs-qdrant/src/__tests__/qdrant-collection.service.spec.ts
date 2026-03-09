/**
 * Qdrant Collection Service Tests
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { jest } from '@jest/globals';
import { QdrantCollectionService } from '../qdrant-collection.service.js';

describe('QdrantCollectionService', () => {
	let service: QdrantCollectionService;
	let mockClient: QdrantClient;
	const collectionName = 'test-products';

	beforeEach(() => {
		mockClient = {
			search: jest.fn(),
			upsert: jest.fn(),
			delete: jest.fn(),
			getCollection: jest.fn(),
		} as unknown as QdrantClient;

		service = new QdrantCollectionService(mockClient, collectionName);
	});

	describe('initialization', () => {
		it('should be instantiated with client and collection name', () => {
			expect(service).toBeDefined();
			expect(service.collectionName).toBe(collectionName);
		});
	});

	describe('search', () => {
		it('should call client.search with collection name and params', async () => {
			const params = { query: [0.1, 0.2, 0.3], limit: 10 };
			const expectedResult = { results: [] };

			(mockClient.search as any).mockResolvedValue(expectedResult as any);

			const result = await service.search(params as any);

			expect(mockClient.search).toHaveBeenCalledWith(collectionName, params);
			expect(result).toEqual(expectedResult);
		});

		it('should pass through client errors', async () => {
			const params = { query: [0.1, 0.2, 0.3], limit: 10 };
			const error = new Error('Search failed');

			(mockClient.search as any).mockRejectedValue(error);

			await expect(service.search(params as any)).rejects.toThrow('Search failed');
		});
	});

	describe('upsert', () => {
		it('should call client.upsert with collection name and params', async () => {
			const params = { points: [{ id: 1, vector: [0.1, 0.2], payload: {} }] };
			const expectedResult = { status: 'ok' };

			(mockClient.upsert as any).mockResolvedValue(expectedResult as any);

			const result = await service.upsert(params as any);

			expect(mockClient.upsert).toHaveBeenCalledWith(collectionName, params);
			expect(result).toEqual(expectedResult);
		});

		it('should pass through client errors', async () => {
			const params = { points: [] };
			const error = new Error('Upsert failed');

			(mockClient.upsert as any).mockRejectedValue(error);

			await expect(service.upsert(params as any)).rejects.toThrow('Upsert failed');
		});
	});

	describe('delete', () => {
		it('should call client.delete with collection name and params', async () => {
			const params = { points_selector: { points: [1, 2, 3] } };
			const expectedResult = { status: 'ok' };

			(mockClient.delete as any).mockResolvedValue(expectedResult as any);

			const result = await service.delete(params as any);

			expect(mockClient.delete).toHaveBeenCalledWith(collectionName, params);
			expect(result).toEqual(expectedResult);
		});

		it('should pass through client errors', async () => {
			const params = { points_selector: { points: [] } };
			const error = new Error('Delete failed');

			(mockClient.delete as any).mockRejectedValue(error);

			await expect(service.delete(params as any)).rejects.toThrow('Delete failed');
		});
	});

	describe('getInfo', () => {
		it('should call client.getCollection with collection name', async () => {
			const expectedInfo = {
				name: collectionName,
				vectors_count: 100,
				points_count: 50,
			};

			(mockClient.getCollection as any).mockResolvedValue(expectedInfo as any);

			const result = await service.getInfo();

			expect(mockClient.getCollection).toHaveBeenCalledWith(collectionName);
			expect(result).toEqual(expectedInfo);
		});

		it('should pass through client errors', async () => {
			const error = new Error('Collection not found');

			(mockClient.getCollection as any).mockRejectedValue(error);

			await expect(service.getInfo()).rejects.toThrow('Collection not found');
		});
	});

	describe('multiple collection instances', () => {
		it('should support multiple collection names with same client', () => {
			const productsService = new QdrantCollectionService(mockClient, 'products');
			const usersService = new QdrantCollectionService(mockClient, 'users');

			expect(productsService.collectionName).toBe('products');
			expect(usersService.collectionName).toBe('users');
			expect(productsService).not.toBe(usersService);
		});

		it('should call correct collection for each service', async () => {
			const productsService = new QdrantCollectionService(mockClient, 'products');
			const usersService = new QdrantCollectionService(mockClient, 'users');

			const searchParams = { query: [0.1], limit: 10 };

			(mockClient.search as any).mockResolvedValue({ results: [] } as any);

			await productsService.search(searchParams as any);
			expect(mockClient.search).toHaveBeenCalledWith('products', searchParams);

			await usersService.search(searchParams as any);
			expect(mockClient.search).toHaveBeenCalledWith('users', searchParams);
		});
	});
});
