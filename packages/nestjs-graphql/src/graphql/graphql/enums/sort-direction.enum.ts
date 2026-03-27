import { registerEnumType } from '@nestjs/graphql';

/**
 * Sort direction enum for ordering queries
 */
export enum SortDirection {
	/**
   * Ascending order
   */
	ASC = 'ASC',

	/**
   * Descending order
   */
	DESC = 'DESC',
}

/**
 * Register the enum with GraphQL
 */
registerEnumType(SortDirection, {
	name: 'SortDirection',
	description: 'Sort direction for ordering queries',
});
