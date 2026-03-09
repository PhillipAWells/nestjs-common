import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Base User GraphQL type without relationships
 * Contains only core user fields to avoid circular dependencies
 * Extended by User type to include relationships
 */
@ObjectType('BaseUser')
export class BaseUser {
	/**
	 * User unique identifier
	 */
	@Field(() => ID)
	public id!: string;

	/**
	 * User email address
	 */
	@Field()
	public email!: string;

	/**
	 * User full name
	 */
	@Field()
	public name!: string;

	/**
	 * User creation timestamp
	 */
	@Field()
	public createdAt!: Date;

	/**
	 * User last update timestamp
	 */
	@Field()
	public updatedAt!: Date;
}
