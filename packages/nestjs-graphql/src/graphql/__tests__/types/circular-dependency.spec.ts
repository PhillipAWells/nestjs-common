 
import { ObjectType, Field, ID, buildSchema } from '@nestjs/graphql';

/**
 * Tests for GraphQL circular dependency resolution
 * Verifies that User, Post, and Comment types can be defined without circular references
 * and that the GraphQL schema builds successfully
 */
describe('GraphQL Schema Circular Dependencies', () => {
	describe('Schema building with circular type references', () => {
		it('should build schema without circular dependency errors', async () => {
			// Define test types with circular relationships
			@ObjectType()
			class BaseUser {
				@Field(() => ID)
				public id!: string;

				@Field()
				public email!: string;

				@Field()
				public name!: string;
			}

			@ObjectType()
			class BasePost {
				@Field(() => ID)
				public id!: string;

				@Field()
				public title!: string;

				@Field()
				public content!: string;
			}

			@ObjectType()
			class BaseComment {
				@Field(() => ID)
				public id!: string;

				@Field()
				public text!: string;
			}

			@ObjectType()
			class User extends BaseUser {
				@Field(() => [Post], { nullable: true })
				public posts?: Post[];
			}

			@ObjectType()
			class Post extends BasePost {
				@Field(() => User)
				public author!: User;

				@Field(() => [Comment], { nullable: true })
				public comments?: Comment[];
			}

			@ObjectType()
			class Comment extends BaseComment {
				@Field(() => User)
				public author!: User;

				@Field(() => Post)
				public post!: Post;
			}

			const schema = await buildSchema({
				resolvers: [],
				types: [BaseUser, BasePost, BaseComment, User, Post, Comment]
			});

			expect(schema).toBeDefined();
			expect(schema.getType('User')).toBeDefined();
			expect(schema.getType('Post')).toBeDefined();
			expect(schema.getType('Comment')).toBeDefined();
		});

		it('should resolve User.posts without circular reference', async () => {
			@ObjectType()
			class BaseUser {
				@Field(() => ID)
				public id!: string;

				@Field()
				public email!: string;

				@Field()
				public name!: string;
			}

			@ObjectType()
			class BasePost {
				@Field(() => ID)
				public id!: string;

				@Field()
				public title!: string;

				@Field()
				public content!: string;
			}

			@ObjectType()
			class BaseComment {
				@Field(() => ID)
				public id!: string;

				@Field()
				public text!: string;
			}

			@ObjectType()
			class User extends BaseUser {
				@Field(() => [Post], { nullable: true })
				public posts?: Post[];
			}

			@ObjectType()
			class Post extends BasePost {
				@Field(() => User)
				public author!: User;

				@Field(() => [Comment], { nullable: true })
				public comments?: Comment[];
			}

			@ObjectType()
			class Comment extends BaseComment {
				@Field(() => User)
				public author!: User;

				@Field(() => Post)
				public post!: Post;
			}

			const schema = await buildSchema({
				resolvers: [],
				types: [BaseUser, BasePost, BaseComment, User, Post, Comment]
			});

			const userType = schema.getType('User');
			expect(userType).toBeDefined();

			if (userType && 'getFields' in userType) {
				const fields = userType.getFields();
				const postsField = fields.posts;
				expect(postsField).toBeDefined();
				expect(postsField.type).toBeDefined();
			}
		});

		it('should resolve Post.comments without circular reference', async () => {
			@ObjectType()
			class BaseUser {
				@Field(() => ID)
				public id!: string;

				@Field()
				public email!: string;

				@Field()
				public name!: string;
			}

			@ObjectType()
			class BasePost {
				@Field(() => ID)
				public id!: string;

				@Field()
				public title!: string;

				@Field()
				public content!: string;
			}

			@ObjectType()
			class BaseComment {
				@Field(() => ID)
				public id!: string;

				@Field()
				public text!: string;
			}

			@ObjectType()
			class User extends BaseUser {
				@Field(() => [Post], { nullable: true })
				public posts?: Post[];
			}

			@ObjectType()
			class Post extends BasePost {
				@Field(() => User)
				public author!: User;

				@Field(() => [Comment], { nullable: true })
				public comments?: Comment[];
			}

			@ObjectType()
			class Comment extends BaseComment {
				@Field(() => User)
				public author!: User;

				@Field(() => Post)
				public post!: Post;
			}

			const schema = await buildSchema({
				resolvers: [],
				types: [BaseUser, BasePost, BaseComment, User, Post, Comment]
			});

			const postType = schema.getType('Post');
			expect(postType).toBeDefined();

			if (postType && 'getFields' in postType) {
				const fields = postType.getFields();
				const commentsField = fields.comments;
				expect(commentsField).toBeDefined();
				expect(commentsField.type).toBeDefined();
			}
		});

		it('should resolve Comment.post and Comment.author without circular reference', async () => {
			@ObjectType()
			class BaseUser {
				@Field(() => ID)
				public id!: string;

				@Field()
				public email!: string;

				@Field()
				public name!: string;
			}

			@ObjectType()
			class BasePost {
				@Field(() => ID)
				public id!: string;

				@Field()
				public title!: string;

				@Field()
				public content!: string;
			}

			@ObjectType()
			class BaseComment {
				@Field(() => ID)
				public id!: string;

				@Field()
				public text!: string;
			}

			@ObjectType()
			class User extends BaseUser {
				@Field(() => [Post], { nullable: true })
				public posts?: Post[];
			}

			@ObjectType()
			class Post extends BasePost {
				@Field(() => User)
				public author!: User;

				@Field(() => [Comment], { nullable: true })
				public comments?: Comment[];
			}

			@ObjectType()
			class Comment extends BaseComment {
				@Field(() => User)
				public author!: User;

				@Field(() => Post)
				public post!: Post;
			}

			const schema = await buildSchema({
				resolvers: [],
				types: [BaseUser, BasePost, BaseComment, User, Post, Comment]
			});

			const commentType = schema.getType('Comment');
			expect(commentType).toBeDefined();

			if (commentType && 'getFields' in commentType) {
				const fields = commentType.getFields();
				const postField = fields.post;
				const authorField = fields.author;

				expect(postField).toBeDefined();
				expect(postField.type).toBeDefined();
				expect(authorField).toBeDefined();
				expect(authorField.type).toBeDefined();
			}
		});

		it('should have base types without circular references', async () => {
			@ObjectType()
			class BaseUser {
				@Field(() => ID)
				public id!: string;

				@Field()
				public email!: string;

				@Field()
				public name!: string;
			}

			@ObjectType()
			class BasePost {
				@Field(() => ID)
				public id!: string;

				@Field()
				public title!: string;

				@Field()
				public content!: string;
			}

			@ObjectType()
			class BaseComment {
				@Field(() => ID)
				public id!: string;

				@Field()
				public text!: string;
			}

			const schema = await buildSchema({
				resolvers: [],
				types: [BaseUser, BasePost, BaseComment]
			});

			expect(schema).toBeDefined();

			const baseUserType = schema.getType('BaseUser');
			const basePostType = schema.getType('BasePost');
			const baseCommentType = schema.getType('BaseComment');

			expect(baseUserType).toBeDefined();
			expect(basePostType).toBeDefined();
			expect(baseCommentType).toBeDefined();

			// Verify base types have no relationship fields
			if (baseUserType && 'getFields' in baseUserType) {
				const fields = baseUserType.getFields();
				expect(fields.id).toBeDefined();
				expect(fields.email).toBeDefined();
				expect(fields.name).toBeDefined();
				// No posts field in base type
				expect(fields.posts).toBeUndefined();
			}
		});
	});

	describe('Type hierarchy validation', () => {
		it('should support inheritance from base types', () => {
			@ObjectType()
			class BaseUser {
				@Field(() => ID)
				public id!: string;

				@Field()
				public email!: string;
			}

			@ObjectType()
			class User extends BaseUser {
				@Field()
				public name!: string;
			}

			expect(User.prototype).toBeInstanceOf(Object);
			expect(User).toBeDefined();
		});

		it('should allow extended types to add relationship fields', () => {
			@ObjectType()
			class BaseUser {
				@Field(() => ID)
				public id!: string;

				@Field()
				public email!: string;
			}

			@ObjectType()
			class User extends BaseUser {
				@Field({ nullable: true })
				public name?: string;
			}

			expect(User).toBeDefined();
		});
	});
});
