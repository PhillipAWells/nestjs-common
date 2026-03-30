import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { AppLogger } from '@pawells/nestjs-shared';
import { Item } from './item.type.js';
import { ItemsService } from './items.service.js';

/**
 * ItemsResolver — GraphQL resolver demonstrating PascalCase operation names.
 *
 * Demonstrates:
 *  - @Resolver decorator with explicit ObjectType reference
 *  - @Query, @Mutation decorators with explicit { name: 'PascalCaseName' } options
 *  - Explicit return types on all methods
 *  - AppLogger from @pawells/nestjs-shared for logging
 *  - Dependency injection without constructor shorthand
 *
 * Note: The GraphQL module must be enabled in app.module.ts (currently commented out).
 * Uncomment the GraphQLModule.forRoot() section to activate this resolver.
 */
@Resolver(() => Item)
export class ItemsResolver {
	private readonly itemsService: ItemsService;

	private readonly logger: AppLogger;

	constructor(itemsService: ItemsService, logger: AppLogger) {
		this.itemsService = itemsService;
		this.logger = logger;
	}

	/**
	 * GetItems — retrieve all items (or a simulated list for demo purposes).
	 *
	 * The operation name in the GraphQL schema will be "GetItems" (PascalCase).
	 */
	@Query(() => [Item], { name: 'GetItems' })
	public getItems(): Item[] {
		this.logger.debug('GetItems query executed');
		// Simulated return — in a real resolver, this would query ItemsService
		// or a database. For now, we return a static demo list.
		return [
			{
				id: '1',
				name: 'Example Item 1',
				description: 'A sample item for demonstration',
			},
			{
				id: '2',
				name: 'Example Item 2',
				description: 'Another sample item',
			},
		];
	}

	/**
	 * GetItem — retrieve a single item by ID.
	 *
	 * The operation name in the GraphQL schema will be "GetItem" (PascalCase).
	 * Returns null if the item is not found (nullable: true).
	 */
	@Query(() => Item, { name: 'GetItem', nullable: true })
	public getItem(@Args('id') id: string): Item | null {
		this.logger.debug(`GetItem query executed for id: ${id}`);
		// Simulated logic — check if the ID matches a demo item
		if (id === '1') {
			return {
				id: '1',
				name: 'Example Item 1',
				description: 'A sample item for demonstration',
			};
		}
		if (id === '2') {
			return {
				id: '2',
				name: 'Example Item 2',
				description: 'Another sample item',
			};
		}
		return null;
	}

	/**
	 * CreateItem — create a new item (mutation).
	 *
	 * The operation name in the GraphQL schema will be "CreateItem" (PascalCase).
	 * Returns the created item.
	 */
	@Mutation(() => Item, { name: 'CreateItem' })
	public createItem(
		@Args('name') name: string,
		@Args('description') description: string,
	): Item {
		this.logger.debug(`CreateItem mutation executed with name: ${name}`);
		// Simulated item creation
		const newItem: Item = {
			id: String(Date.now()),
			name,
			description,
		};
		return newItem;
	}

	/**
	 * DeleteItem — delete an item by ID (mutation).
	 *
	 * The operation name in the GraphQL schema will be "DeleteItem" (PascalCase).
	 * Returns a boolean indicating success.
	 */
	@Mutation(() => Boolean, { name: 'DeleteItem' })
	public async deleteItem(@Args('id') id: string): Promise<boolean> {
		this.logger.debug(`DeleteItem mutation executed for id: ${id}`);
		// Simulated deletion — always returns true for demo purposes
		try {
			await this.itemsService.deleteItem(id);
			return true;
		} catch (error) {
			this.logger.error(`Failed to delete item ${id}: ${String(error)}`);
			return false;
		}
	}
}
