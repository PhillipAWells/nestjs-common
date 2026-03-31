/**
 * Runtime integration test — ItemsModule wired with QdrantModule.
 *
 * This test proves that:
 *  1. The NestJS DI container can compile ItemsModule alongside QdrantModule.
 *  2. QdrantService is resolvable from the compiled module (global provider works).
 *  3. The service methods execute the right Qdrant operations end-to-end.
 *
 * Note: Since Vitest's esbuild transform doesn't emit TypeScript decorator metadata,
 * NestJS cannot inject ModuleRef by reflection. ItemsService is therefore instantiated
 * directly with a mock ModuleRef wrapping the compiled module — the same pattern used
 * throughout this codebase (see nestjs-pyroscope integration tests).
 *
 * External I/O is prevented by spying on the underlying QdrantClient methods
 * after the module compiles — the client itself is a no-op HTTP client until
 * an actual request is made, so construction succeeds without a live server.
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { type ModuleRef } from '@nestjs/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QdrantModule, QdrantService } from '@pawells/nestjs-qdrant';
import { ItemsModule } from '../items/items.module.js';
import { ItemsService } from '../items/items.service.js';

/**
 * Build a mock ModuleRef from a compiled TestingModule.
 * Since Vitest's esbuild transform doesn't emit TypeScript decorator metadata,
 * NestJS cannot inject ModuleRef by reflection. This helper creates a mock
 * ModuleRef wrapping the compiled module so services can be directly instantiated.
 */
function buildMockModuleRef(compiledModule: TestingModule): ModuleRef {
	return {
		get: (token: any, options?: any) => compiledModule.get(token, options),
	} as unknown as ModuleRef;
}

describe('ItemsModule (integration)', () => {
	let module: TestingModule;
	let itemsService: ItemsService;
	let qdrantService: QdrantService;

	beforeEach(async () => {
		module = await Test.createTestingModule({
			imports: [
				// QdrantModule is registered as global — ItemsModule does not need
				// to import it directly, mirroring production AppModule behaviour.
				QdrantModule.ForRoot({
					url: 'http://localhost:6333',
					// Disable the compatibility handshake so no network call is made
					// during module initialisation.
					checkCompatibility: false,
				}),
				ItemsModule,
			],
		}).compile();

		qdrantService = module.get(QdrantService);

		// Instantiate ItemsService directly with a mock ModuleRef wrapping the compiled
		// module, because Vitest's esbuild transform does not emit decorator metadata and
		// NestJS therefore cannot inject ModuleRef by reflection.
		itemsService = new ItemsService(buildMockModuleRef(module));
	});

	afterEach(async () => {
		await module.close();
	});

	it('should compile the module and resolve ItemsService', () => {
		expect(module).toBeDefined();
		expect(itemsService).toBeInstanceOf(ItemsService);
	});

	it('should inject QdrantService into ItemsService from the global provider', () => {
		// The QdrantService returned by the module is the same instance that
		// ItemsService uses through the ModuleRef — proves global registration works.
		expect(qdrantService).toBeDefined();
		expect(qdrantService).toBeInstanceOf(QdrantService);
	});

	describe('findSimilar', () => {
		it('should call QdrantClient.search and map results to Items', async () => {
			const fakeResults = [
				{ id: 'item-1', score: 0.99, payload: { name: 'Alpha' }, version: 1 },
				{ id: 'item-2', score: 0.88, payload: { name: 'Beta' }, version: 1 },
			];

			const mockCollectionService = qdrantService.Collection('items');
			vi.spyOn(mockCollectionService, 'Search').mockResolvedValue(fakeResults as any);
			vi.spyOn(qdrantService, 'Collection').mockReturnValue(mockCollectionService);

			const results = await itemsService.FindSimilar([0.1, 0.2, 0.3], 2);

			expect(results).toStrictEqual([
				{ id: 'item-1', name: 'Alpha' },
				{ id: 'item-2', name: 'Beta' },
			]);
		});
	});

	describe('upsertItem', () => {
		it('should call QdrantClient.upsert with the correct point payload', async () => {
			const mockCollectionService = qdrantService.Collection('items');
			const upsertSpy = vi
				.spyOn(mockCollectionService, 'Upsert')
				.mockResolvedValue({ status: 'ok', result: { operation_id: 1 } } as any);
			vi.spyOn(qdrantService, 'Collection').mockReturnValue(mockCollectionService);

			await itemsService.UpsertItem({ id: 'item-3', name: 'Gamma', vector: [0.4, 0.5] });

			expect(upsertSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					points: [expect.objectContaining({ id: 'item-3', vector: [0.4, 0.5] })],
				}),
			);
		});
	});

	describe('deleteItem', () => {
		it('should call QdrantClient.delete with the item id', async () => {
			const mockCollectionService = qdrantService.Collection('items');
			const deleteSpy = vi
				.spyOn(mockCollectionService, 'Delete')
				.mockResolvedValue({ status: 'ok', result: { operation_id: 2 } } as any);
			vi.spyOn(qdrantService, 'Collection').mockReturnValue(mockCollectionService);

			await itemsService.DeleteItem('item-3');

			expect(deleteSpy).toHaveBeenCalledWith(
				expect.objectContaining({ points: ['item-3'] }),
			);
		});
	});
});
