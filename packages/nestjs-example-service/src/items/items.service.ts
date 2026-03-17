import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { QdrantService } from '@pawells/nestjs-qdrant';
import { Traced } from '@pawells/nestjs-open-telemetry';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';

export interface Item {
	id: string;
	name: string;
}

export interface StoredItem extends Item {
	vector: number[];
}

/**
 * ItemsService — stores and retrieves items from Qdrant using vector search.
 *
 * Demonstrates:
 *  - Injecting QdrantService from @pawells/nestjs-qdrant
 *  - @Traced   from @pawells/nestjs-open-telemetry — wraps each method in an OTel span
 *  - @ProfileMethod from @pawells/nestjs-pyroscope — Pyroscope CPU/heap profiling per method
 *    (use @Profile at the class level to profile all methods at once)
 */
const DEFAULT_SEARCH_LIMIT = 10;

@Injectable()
export class ItemsService {
	private static readonly COLLECTION = 'items';

	constructor(public readonly moduleRef: ModuleRef) {}

	private get qdrant(): QdrantService {
		return this.moduleRef.get(QdrantService, { strict: false });
	}

	/**
	 * Search for items whose stored vectors are closest to the given query vector.
	 */
	@Traced()
	@ProfileMethod({ tags: { operation: 'findSimilar' } })
	public async findSimilar(vector: number[], limit = DEFAULT_SEARCH_LIMIT): Promise<Item[]> {
		const results = await this.qdrant
			.collection(ItemsService.COLLECTION)
			.search({ vector, limit, with_payload: true });

		return results.map((r) => ({
			id: String(r.id),
			name: String(r.payload?.['name'] ?? ''),
		}));
	}

	/**
	 * Insert or update an item (upsert by id).
	 */
	@Traced()
	@ProfileMethod({ tags: { operation: 'upsertItem' } })
	public async upsertItem(item: StoredItem): Promise<void> {
		await this.qdrant
			.collection(ItemsService.COLLECTION)
			.upsert({
				points: [{
					id: item.id,
					vector: item.vector,
					payload: { name: item.name },
				}],
			});
	}

	/**
	 * Delete an item by id.
	 */
	@Traced()
	@ProfileMethod({ tags: { operation: 'deleteItem' } })
	public async deleteItem(id: string): Promise<void> {
		await this.qdrant
			.collection(ItemsService.COLLECTION)
			.delete({ points: [id] });
	}
}
