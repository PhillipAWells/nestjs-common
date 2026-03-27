import { ObjectType, Field } from '@nestjs/graphql';
import { BaseComment } from './base-comment.type.js';
import { User } from './user.type.js';
import { Post } from './post.type.js';

/**
 * Comment GraphQL type with relationships
 * Extends BaseComment to include author (User) and post (Post) relationships
 * Avoids circular dependencies by extending base type first
 */
@ObjectType('Comment')
export class Comment extends BaseComment {
	/**
	 * User who created this comment
	 */
	@Field(() => User)
	public author!: User;

	/**
	 * Post this comment belongs to
	 */
	@Field(() => Post)
	public post!: Post;
}
