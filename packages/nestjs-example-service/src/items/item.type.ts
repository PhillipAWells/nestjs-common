import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Item — GraphQL ObjectType representing a searchable item in the vector database.
 *
 * Demonstrates:
 *  - @ObjectType decorator for GraphQL schema generation
 *  - @Field decorators for explicit type definitions
 *  - ID scalar for the primary key
 */
@ObjectType()
export class Item {
	@Field(() => ID)
	public id: string = '';

	@Field()
	public name: string = '';

	@Field()
	public description: string = '';
}
