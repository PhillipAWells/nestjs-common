import { ObjectType, Field } from '@nestjs/graphql';
import { BaseComment } from './base-comment.type.js';
import { IUser } from './user.type.js';
import { Post } from './post.type.js';

/**
 * IComment GraphQL type with relationships
 * Extends BaseComment to include author (IUser) and post (Post) relationships
 * Avoids circular dependencies by extending base type first
 */
@ObjectType('IComment')
export class IComment extends BaseComment {
	/**
	 * IUser who created this comment
	 */
	@Field(() => IUser)
	public Author!: IUser;

	/**
	 * Post this comment belongs to
	 */
	@Field(() => Post)
	public Post!: Post;
}
