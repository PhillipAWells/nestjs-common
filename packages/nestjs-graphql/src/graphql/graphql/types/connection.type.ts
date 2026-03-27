import { Type } from '@nestjs/common';
import { ObjectType, Field, Int } from '@nestjs/graphql';
import { PageInfo } from './page-info.type.js';

/**
 * Generic Edge type factory for Relay-style connections
 * @param T The node type
 * @returns Edge type class
 */
export function Edge<T>(classRef: Type<T>): any {
	@ObjectType(`${classRef.name}Edge`)
	class EdgeClass {
		/**
     * Cursor for this edge
     */
		@Field(() => String)
		public cursor!: string;

		/**
     * The node for this edge
     */
		@Field(() => classRef)
		public node!: T;
	}

	return EdgeClass;
}

/**
 * Generic Connection type factory for Relay-style connections
 * @param T The node type
 * @returns Connection type class
 */
export function Connection<T>(classRef: Type<T>): any {
	const EdgeClass = Edge(classRef);

	@ObjectType(`${classRef.name}Connection`)
	class ConnectionClass {
		/**
     * Edges in this connection
     */
		@Field(() => [EdgeClass])
		public edges!: InstanceType<typeof EdgeClass>[];

		/**
     * Page information for this connection
     */
		@Field(() => PageInfo)
		public pageInfo!: PageInfo;

		/**
     * Total count of items
     */
		@Field(() => Int)
		public totalCount!: number;
	}

	return ConnectionClass;
}

/**
 * Utility functions for cursor-based pagination
 */
export class CursorUtils {
	/**
   * Encode cursor data to base64 string
   * @param id Entity ID
   * @param timestamp Timestamp
   * @returns Base64 encoded cursor
   */
	public static encodeCursor(id: string, timestamp: number): string {
		const data = JSON.stringify({ id, timestamp });
		return Buffer.from(data).toString('base64');
	}

	/**
   * Decode cursor from base64 string
   * @param cursor Base64 encoded cursor
   * @returns Decoded cursor data
   */
	public static decodeCursor(cursor: string): { id: string; timestamp: number } {
		try {
			const data = Buffer.from(cursor, 'base64').toString('utf-8');
			return JSON.parse(data);
		} catch {
			throw new Error('Invalid cursor format');
		}
	}

	/**
   * Create cursor from entity with ID and optional timestamp
   * @param entity Entity with id and optional createdAt
   * @returns Base64 encoded cursor
   */
	public static createCursor(entity: { id: string; createdAt?: Date }): string {
		const timestamp = entity.createdAt ? entity.createdAt.getTime() : Date.now();
		return this.encodeCursor(entity.id, timestamp);
	}
}
