import { Scalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';
import { ObjectId } from 'mongodb';

/**
 * ObjectId custom scalar for MongoDB ObjectId values
 * Handles serialization between string and ObjectId types
 */
@Scalar('ObjectId', () => ObjectId)
export class ObjectIdScalar {
	public description = 'MongoDB ObjectId custom scalar type';

	/**
   * Parse value from client input
   * @param value Value from client
   * @returns ObjectId instance
   */
	public parseValue(value: any): ObjectId {
		if (typeof value !== 'string') {
			throw new Error('ObjectId must be a string');
		}

		try {
			return new ObjectId(value);
		}
		catch {
			throw new Error('Invalid ObjectId format');
		}
	}

	/**
   * Serialize value to send to client
   * @param value ObjectId instance
   * @returns String representation
   */
	public serialize(value: ObjectId): any {
		if (!(value instanceof ObjectId)) {
			throw new Error('Value must be an ObjectId instance');
		}
		return value.toHexString();
	}

	/**
   * Parse literal value from GraphQL AST
   * @param ast AST node
   * @returns ObjectId instance
   */
	public parseLiteral(ast: ValueNode): ObjectId {
		if (ast.kind === Kind.STRING) {
			try {
				return new ObjectId(ast.value);
			}
			catch {
				throw new Error('Invalid ObjectId format');
			}
		}

		throw new Error('ObjectId must be a string');
	}
}
