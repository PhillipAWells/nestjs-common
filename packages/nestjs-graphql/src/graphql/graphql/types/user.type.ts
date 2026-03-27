import { ObjectType, Field } from '@nestjs/graphql';
import { BaseUser } from './base-user.type.js';
import { Post } from './post.type.js';

/**
 * User GraphQL type with relationships
 * Extends BaseUser to include posts relationship
 * Avoids circular dependencies by extending base type first
 */
@ObjectType('User')
export class User extends BaseUser {
	/**
	 * Posts created by this user
	 * Nullable to support lazy loading
	 */
	@Field(() => [Post], { nullable: true })
	public posts?: Post[];
}
