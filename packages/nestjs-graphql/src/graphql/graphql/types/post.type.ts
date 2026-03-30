import { ObjectType, Field } from '@nestjs/graphql';
import { BasePost } from './base-post.type.js';
import { IUser } from './user.type.js';
import { IComment } from './comment.type.js';

/**
 * Post GraphQL type with relationships
 * Extends BasePost to include author (IUser) and comments relationships
 * Avoids circular dependencies by extending base type first
 */
@ObjectType('Post')
export class Post extends BasePost {
	/**
	 * IUser who created this post
	 */
	@Field(() => IUser)
	public Author!: IUser;

	/**
	 * Comments on this post
	 * Nullable to support lazy loading
	 */
	@Field(() => [IComment], { nullable: true })
	public Comments?: IComment[];
}
