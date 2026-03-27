/**
 * Qdrant Service Tests
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QdrantService } from '../qdrant.service.js';
import { QdrantCollectionService } from '../qdrant-collection.service.js';
import { QDRANT_CLIENT_TOKEN } from '../qdrant.constants.js';

describe('QdrantService', () => {
	let service: QdrantService;
	let mockClient: QdrantClient;
	let mockModuleRef: { get: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		mockClient = {
			getCollections: vi.fn(),
			recreateCollection: vi.fn(),
			upsertPointsBatch: vi.fn(),
			search: vi.fn(),
		} as unknown as QdrantClient;

		mockModuleRef = {
			get: vi.fn().mockReturnValue(mockClient),
		};

		service = new QdrantService(mockModuleRef as any);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getClient', () => {
		it('should return the injected QdrantClient', () => {
			const client = service.getClient();
			expect(client).toBe(mockClient);
			expect(mockModuleRef.get).toHaveBeenCalledWith(QDRANT_CLIENT_TOKEN, { strict: false });
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

		it('should throw BadRequestException for empty collection name', () => {
			expect(() => service.collection('')).toThrow('Invalid collection name');
		});

		it('should throw BadRequestException for collection name longer than 255 characters', () => {
			const longName = 'a'.repeat(256);
			expect(() => service.collection(longName)).toThrow('Invalid collection name');
		});

		it('should throw BadRequestException for collection name with invalid characters', () => {
			expect(() => service.collection('test collection')).toThrow('Invalid collection name');
			expect(() => service.collection('test!collection')).toThrow('Invalid collection name');
			expect(() => service.collection('test@collection')).toThrow('Invalid collection name');
		});

		it('should accept valid single-character collection name', () => {
			const collectionService = service.collection('a');
			expect(collectionService).toBeInstanceOf(QdrantCollectionService);
			expect(collectionService.collectionName).toBe('a');
		});

		it('should accept collection names with alphanumeric, hyphens, and underscores', () => {
			const validNames = ['test_collection', 'test-collection', 'collection123', 'a-b_c', 'TEST123'];
			for (const name of validNames) {
				const collectionService = service.collection(name);
				expect(collectionService).toBeInstanceOf(QdrantCollectionService);
				expect(collectionService.collectionName).toBe(name);
			}
		});
	});
});
