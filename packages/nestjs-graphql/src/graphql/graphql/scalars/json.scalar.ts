import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

/**
 * JSON custom scalar for arbitrary JSON data
 * Compatible with NestJS GraphQL code-first approach
 */
@Scalar('JSON')
export class JSONScalar implements CustomScalar<unknown, unknown> {
	public Description = 'JSON custom scalar type for arbitrary data';

	public parseValue(value: unknown): unknown {
		return value;
	}

	public serialize(value: unknown): unknown {
		return value;
	}

	public parseLiteral(ast: ValueNode): unknown {
		switch (ast.kind) {
			case Kind.STRING:
				return ast.value;
			case Kind.INT:
				return parseInt(ast.value, 10);
			case Kind.FLOAT:
				return parseFloat(ast.value);
			case Kind.BOOLEAN:
				return ast.value;
			case Kind.NULL:
				return null;
			case Kind.LIST:
				return ast.values.map((v) => this.parseLiteral(v));
			case Kind.OBJECT: {
				const Result: Record<string, unknown> = {};
				for (const Field of ast.fields) {
					Result[Field.name.value] = this.parseLiteral(Field.value);
				}
				return Result;
			}
			default:
				return null;
		}
	}
}
