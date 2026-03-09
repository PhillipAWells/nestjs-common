import { ObjectType, Field } from '@nestjs/graphql';
import { BasePost } from './base-post.type.js';
import { User } from './user.type.js';
import { Comment } from './comment.type.js';

/**
 * Post GraphQL type with relationships
 * Extends BasePost to include author (User) and comments relationships
 * Avoids circular dependencies by extending base type first
 */
@ObjectType('Post')
export class Post extends BasePost {
	/**
	 * User who created this post
	 */
	@Field(() => User)
	public author!: User;

	/**
	 * Comments on this post
	 * Nullable to support lazy loading
	 */
	@Field(() => [Comment], { nullable: true })
	public comments?: Comment[];
}
