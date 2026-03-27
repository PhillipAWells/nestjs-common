import { Scalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

/**
 * DateTime custom scalar for ISO 8601 date-time strings
 * Handles serialization between Date objects and ISO strings
 */
@Scalar('DateTime')
export class DateTimeScalar {
	public description = 'ISO 8601 date-time string custom scalar type';

	/**
   * Parse value from client input
   * @param value Value from client
   * @returns Date instance
   */
	public parseValue(value: any): Date {
		if (typeof value !== 'string') {
			throw new Error('DateTime must be a string');
		}

		const date = new Date(value);
		if (isNaN(date.getTime())) {
			throw new Error('Invalid DateTime format');
		}

		return date;
	}

	/**
   * Serialize value to send to client
   * @param value Date instance
   * @returns ISO string representation
   */
	public serialize(value: any): string {
		if (!(value instanceof Date)) {
			throw new Error('Value must be a Date instance');
		}

		return value.toISOString();
	}

	/**
   * Parse literal value from GraphQL AST
   * @param ast AST node
   * @returns Date instance
   */
	public parseLiteral(ast: ValueNode): Date {
		if (ast.kind === Kind.STRING) {
			const date = new Date(ast.value);
			if (isNaN(date.getTime())) {
				throw new Error('Invalid DateTime format');
			}

			return date;
		}

		throw new Error('DateTime must be a string');
	}
}
