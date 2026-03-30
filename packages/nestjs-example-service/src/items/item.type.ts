import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * IItem — GraphQL ObjectType representing a searchable item in the vector database.
 *
 * Demonstrates:
 *  - @ObjectType decorator for GraphQL schema generation
 *  - @Field decorators for explicit type definitions
 *  - ID scalar for the primary key
 */
@ObjectType()
export class IItem {
	@Field(() => ID)
	public Id: string = '';

	@Field()
	public Name: string = '';

	@Field()
	public Description: string = '';
}
