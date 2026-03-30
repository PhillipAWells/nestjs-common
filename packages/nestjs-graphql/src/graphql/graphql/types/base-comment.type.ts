import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Base IComment GraphQL type without relationships
 * Contains only core comment fields to avoid circular dependencies
 * Extended by IComment type to include relationships with IUser and Post
 */
@ObjectType('BaseComment')
export class BaseComment {
	/**
	 * IComment unique identifier
	 */
	@Field(() => ID)
	public Id!: string;

	/**
	 * IComment text content
	 */
	@Field()
	public Text!: string;

	/**
	 * IComment creation timestamp
	 */
	@Field()
	public CreatedAt!: Date;

	/**
	 * IComment last update timestamp
	 */
	@Field()
	public UpdatedAt!: Date;
}
