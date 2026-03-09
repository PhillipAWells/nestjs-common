import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Base Post GraphQL type without relationships
 * Contains only core post fields to avoid circular dependencies
 * Extended by Post type to include relationships with User and Comment
 */
@ObjectType('BasePost')
export class BasePost {
	/**
	 * Post unique identifier
	 */
	@Field(() => ID)
	public id!: string;

	/**
	 * Post title
	 */
	@Field()
	public title!: string;

	/**
	 * Post content/body
	 */
	@Field()
	public content!: string;

	/**
	 * Post creation timestamp
	 */
	@Field()
	public createdAt!: Date;

	/**
	 * Post last update timestamp
	 */
	@Field()
	public updatedAt!: Date;
}
