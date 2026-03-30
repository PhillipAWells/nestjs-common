import { ObjectType, Field } from '@nestjs/graphql';

/**
 * PageInfo type for Relay-style cursor-based pagination
 * Provides information about pagination state
 */
@ObjectType()
export class PageInfo {
	/**
   * Whether there is a next page of results
   */
	@Field(() => Boolean)
	public HasNextPage!: boolean;

	/**
   * Whether there is a previous page of results
   */
	@Field(() => Boolean)
	public HasPreviousPage!: boolean;

	/**
   * Cursor for the first item in the current page
   */
	@Field(() => String, { nullable: true })
	public StartCursor?: string;

	/**
   * Cursor for the last item in the current page
   */
	@Field(() => String, { nullable: true })
	public EndCursor?: string;
}
