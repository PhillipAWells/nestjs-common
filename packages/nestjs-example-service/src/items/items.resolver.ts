import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { AppLogger } from '@pawells/nestjs-shared';
import { IItem } from './item.type.js';
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
@Resolver(() => IItem)
export class ItemsResolver {
	private readonly ItemsService: ItemsService;

	private readonly Logger: AppLogger;

	constructor(itemsService: ItemsService, logger: AppLogger) {
		this.ItemsService = itemsService;
		this.Logger = logger;
	}

	/**
	 * GetItems — retrieve all items (or a simulated list for demo purposes).
	 *
	 * The operation name in the GraphQL schema will be "GetItems" (PascalCase).
	 */
	@Query(() => [IItem], { name: 'GetItems' })
	public GetItems(): IItem[] {
		this.Logger.debug('GetItems query executed');
		// Simulated return — in a real resolver, this would query ItemsService
		// or a database. For now, we return a static demo list.
		return [
			{
				Id: '1',
				Name: 'Example IItem 1',
				Description: 'A sample item for demonstration',
			},
			{
				Id: '2',
				Name: 'Example IItem 2',
				Description: 'Another sample item',
			},
		];
	}

	/**
	 * GetItem — retrieve a single item by ID.
	 *
	 * The operation name in the GraphQL schema will be "GetItem" (PascalCase).
	 * Returns null if the item is not found (nullable: true).
	 */
	@Query(() => IItem, { name: 'GetItem', nullable: true })
	public GetItem(@Args('id') id: string): IItem | null {
		this.Logger.debug(`GetItem query executed for id: ${id}`);
		// Simulated logic — check if the ID matches a demo item
		if (id === '1') {
			return {
				Id: '1',
				Name: 'Example IItem 1',
				Description: 'A sample item for demonstration',
			};
		}
		if (id === '2') {
			return {
				Id: '2',
				Name: 'Example IItem 2',
				Description: 'Another sample item',
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
	@Mutation(() => IItem, { name: 'CreateItem' })
	public CreateItem(
		@Args('name') name: string,
		@Args('description') description: string,
	): IItem {
		this.Logger.debug(`CreateItem mutation executed with name: ${name}`);
		// Simulated item creation
		const NewItem: IItem = {
			Id: String(Date.now()),
			Name: name,
			Description: description,
		};
		return NewItem;
	}

	/**
	 * DeleteItem — delete an item by ID (mutation).
	 *
	 * The operation name in the GraphQL schema will be "DeleteItem" (PascalCase).
	 * Returns a boolean indicating success.
	 */
	@Mutation(() => Boolean, { name: 'DeleteItem' })
	public async DeleteItem(@Args('id') id: string): Promise<boolean> {
		this.Logger.debug(`DeleteItem mutation executed for id: ${id}`);
		// Simulated deletion — always returns true for demo purposes
		try {
			await this.ItemsService.DeleteItem(id);
			return true;
		} catch (error) {
			this.Logger.error(`Failed to delete item ${id}: ${String(error)}`);
			return false;
		}
	}
}
