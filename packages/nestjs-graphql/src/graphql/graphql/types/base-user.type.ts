import { ObjectType, Field, ID } from '@nestjs/graphql';

/**
 * Base IUser GraphQL type without relationships
 * Contains only core user fields to avoid circular dependencies
 * Extended by IUser type to include relationships
 */
@ObjectType('BaseUser')
export class BaseUser {
	/**
	 * IUser unique identifier
	 */
	@Field(() => ID)
	public Id!: string;

	/**
	 * IUser email address
	 */
	@Field()
	public Email!: string;

	/**
	 * IUser full name
	 */
	@Field()
	public Name!: string;

	/**
	 * IUser creation timestamp
	 */
	@Field()
	public CreatedAt!: Date;

	/**
	 * IUser last update timestamp
	 */
	@Field()
	public UpdatedAt!: Date;
}
