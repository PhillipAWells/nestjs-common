/**
 * Qdrant Service Tests
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { jest } from '@jest/globals';
import { QdrantService } from '../qdrant.service.js';
import { QdrantCollectionService } from '../qdrant-collection.service.js';

describe('QdrantService', () => {
	let service: QdrantService;
	let mockClient: QdrantClient;

	beforeEach(() => {
		mockClient = {
			getCollections: jest.fn(),
			recreateCollection: jest.fn(),
			upsertPointsBatch: jest.fn(),
			search: jest.fn(),
		} as unknown as QdrantClient;

		service = new QdrantService(mockClient);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getClient', () => {
		it('should return the injected QdrantClient', () => {
			const client = service.getClient();
			expect(client).toBe(mockClient);
		});

		it('should always return the same client instance', () => {
			const client1 = service.getClient();
			const client2 = service.getClient();
			expect(client1).toBe(client2);
		});
	});

	describe('dependency injection', () => {
		it('should be injectable with QDRANT_CLIENT_TOKEN', () => {
			expect(service).toBeInstanceOf(QdrantService);
		});
	});

	describe('collection', () => {
		it('should return QdrantCollectionService for a collection name', () => {
			const collectionService = service.collection('test-collection');
			expect(collectionService).toBeInstanceOf(QdrantCollectionService);
			expect(collectionService.collectionName).toBe('test-collection');
		});

		it('should return different instances for different collection names', () => {
			const collection1 = service.collection('collection-1');
			const collection2 = service.collection('collection-2');
			expect(collection1).not.toBe(collection2);
			expect(collection1.collectionName).toBe('collection-1');
			expect(collection2.collectionName).toBe('collection-2');
		});

		it('should wrap the same client instance', () => {
			const collection1 = service.collection('collection-1');
			const collection2 = service.collection('collection-2');
			// Both should delegate to the same underlying client
			expect(collection1).toBeInstanceOf(QdrantCollectionService);
			expect(collection2).toBeInstanceOf(QdrantCollectionService);
		});
	});
});
