import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { QdrantService } from '@pawells/nestjs-qdrant';
import { Traced } from '@pawells/nestjs-open-telemetry';
import { ProfileMethod } from '@pawells/nestjs-pyroscope';

export interface IItem {
	id: string;
	name: string;
}

export interface IStoredItem extends IItem {
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

	private readonly ModuleRef: ModuleRef;

	constructor(moduleRef: ModuleRef) {
		this.ModuleRef = moduleRef;
	}

	private get Qdrant(): QdrantService {
		return this.ModuleRef.get(QdrantService, { strict: false }) as QdrantService;
	}

	/**
	 * Search for items whose stored vectors are closest to the given query vector.
	 */
	@Traced()
	@ProfileMethod({ tags: { operation: 'findSimilar' } })
	public async FindSimilar(vector: number[], limit = DEFAULT_SEARCH_LIMIT): Promise<IItem[]> {
		const Results = await this.Qdrant
			.Collection(ItemsService.COLLECTION)
			.Search({ vector, limit, with_payload: true });

		return Results.map((r) => ({
			id: String(r.id),
			name: String(r.payload?.['name'] ?? ''),
		}));
	}

	/**
	 * Insert or update an item (upsert by id).
	 */
	@Traced()
	@ProfileMethod({ tags: { operation: 'upsertItem' } })
	public async UpsertItem(item: IStoredItem): Promise<void> {
		await this.Qdrant
			.Collection(ItemsService.COLLECTION)
			.Upsert({
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
	public async DeleteItem(id: string): Promise<void> {
		await this.Qdrant
			.Collection(ItemsService.COLLECTION)
			.Delete({ points: [id] });
	}
}
