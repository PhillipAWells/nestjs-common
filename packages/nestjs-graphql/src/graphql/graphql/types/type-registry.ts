import { Type } from '@nestjs/common';
import { BaseUser } from './base-user.type.js';
import { BasePost } from './base-post.type.js';
import { BaseComment } from './base-comment.type.js';
import { IUser } from './user.type.js';
import { Post } from './post.type.js';
import { IComment } from './comment.type.js';

/**
 * Central registry for GraphQL types to manage circular dependencies
 * Provides ordered list of types to register in correct dependency order
 */

/**
 * Base types without any relationships
 * Register these first to establish foundation
 */
export const BASE_GRAPHQL_TYPES: Type<unknown>[] = [
	BaseUser,
	BasePost,
	BaseComment,
];

/**
 * Extended types with relationships
 * Register after base types to avoid circular dependencies
 */
export const EXTENDED_GRAPHQL_TYPES: Type<unknown>[] = [
	IUser,
	Post,
	IComment,
];

/**
 * All GraphQL types in correct registration order
 * This ensures base types are registered before types that depend on them
 */
export const ALL_GRAPHQL_TYPES: Type<unknown>[] = [
	...BASE_GRAPHQL_TYPES,
	...EXTENDED_GRAPHQL_TYPES,
];

/**
 * Register GraphQL types in the correct order to avoid circular dependencies
 *
 * Example usage in module:
 * ```
 * import { ALL_GRAPHQL_TYPES } from './types/type-registry.ts';
 *
 * @Module({
 *   imports: [
 *     GraphQLModule.forRoot({
 *       types: ALL_GRAPHQL_TYPES
 *     })
 *   ]
 * })
 * export class MyModule {}
 * ```
 *
 * @param types Types to validate are in correct order
 * @returns true if types are properly ordered
 */
export function ValidateTypeRegistrationOrder(types: Type<unknown>[]): boolean {
	// Verify base types appear before extended types
	const BaseTypeNames = new Set(BASE_GRAPHQL_TYPES.map(t => t.name));
	const ExtendedTypeNames = new Set(EXTENDED_GRAPHQL_TYPES.map(t => t.name));

	let LastBaseTypeIndex = -1;
	let FirstExtendedTypeIndex = types.length;

	for (let I = 0; I < types.length; I++) {
		const Type = types[I];
		if (!Type) continue;
		const TypeName = Type.name;
		if (BaseTypeNames.has(TypeName)) {
			LastBaseTypeIndex = I;
		}
		if (ExtendedTypeNames.has(TypeName) && FirstExtendedTypeIndex === types.length) {
			FirstExtendedTypeIndex = I;
		}
	}

	// Base types should come before extended types
	return LastBaseTypeIndex < FirstExtendedTypeIndex;
}

/**
 * Get type names for logging and debugging
 */
export function GetTypeNames(): {
	base: string[];
	extended: string[];
	all: string[];
} {
	return {
		base: BASE_GRAPHQL_TYPES.map(t => t.name),
		extended: EXTENDED_GRAPHQL_TYPES.map(t => t.name),
		all: ALL_GRAPHQL_TYPES.map(t => t.name),
	};
}
