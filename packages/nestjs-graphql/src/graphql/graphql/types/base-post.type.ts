import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Base Post GraphQL type without relationships
 * Contains only core post fields to avoid circular dependencies
 * Extended by Post type to include relationships with IUser and IComment
 */
@ObjectType('BasePost')
export class BasePost {
	/**
	 * Post unique identifier
	 */
	@Field(() => ID)
	public Id!: string;

	/**
	 * Post title
	 */
	@Field()
	public Title!: string;

	/**
	 * Post content/body
	 */
	@Field()
	public Content!: string;

	/**
	 * Post creation timestamp
	 */
	@Field()
	public CreatedAt!: Date;

	/**
	 * Post last update timestamp
	 */
	@Field()
	public UpdatedAt!: Date;
}
