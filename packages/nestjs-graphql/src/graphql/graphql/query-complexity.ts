import { GraphQLResolveInfo } from 'graphql';
import { getComplexity, simpleEstimator, fieldExtensionsEstimator } from 'graphql-query-complexity';
import { AppLogger, getErrorStack } from '@pawells/nestjs-shared/common';
import { QUERY_COMPLEXITY_THRESHOLD, QUERY_DEPTH_LIMIT, QUERY_COMPLEXITY_SCALAR_WEIGHT, QUERY_COMPLEXITY_DEFAULT_DEPTH_MULTIPLIER } from '../constants/complexity.constants.js';

/**
 * Interface for complexity configuration
 */
export interface IComplexityConfig {
	defaultComplexity?: number;
	multipliers?: {
		depth?: number;
		list?: number;
	};
	limits?: {
		maxComplexity?: number;
		maxDepth?: number;
	};
}

/**
 * Default complexity configuration
 */
export const DEFAULT_COMPLEXITY_CONFIG: IComplexityConfig = {
	defaultComplexity: 1,
	multipliers: {
		depth: QUERY_COMPLEXITY_DEFAULT_DEPTH_MULTIPLIER,
		list: QUERY_COMPLEXITY_SCALAR_WEIGHT,
	},
	limits: {
		maxComplexity: QUERY_COMPLEXITY_THRESHOLD,
		maxDepth: QUERY_DEPTH_LIMIT,
	},
};

/**
 * Calculates the complexity of a GraphQL query
 * @param schema GraphQL schema
 * @param query GraphQL query document
 * @param variables Query variables
 * @param operationName Operation name (optional)
 * @param config Complexity configuration
 * @returns Calculated complexity score
 */
export function CalculateQueryComplexity(
	schema: any,
	query: any,
	variables: Record<string, any> | undefined,
	operationName: string | undefined,
	config: IComplexityConfig = DEFAULT_COMPLEXITY_CONFIG,
): number {
	const { defaultComplexity = 1 } = config;

	try {
		const Complexity = getComplexity({
			schema,
			query,
			...(variables !== undefined ? { variables } : {}),
			...(operationName !== undefined ? { operationName } : {}),
			estimators: [
				fieldExtensionsEstimator(),
				simpleEstimator({ defaultComplexity }),
			],
		});

		return Complexity;
	} catch (error) {
		// If complexity calculation fails, return a high complexity to be safe
		const Logger = new AppLogger(undefined, 'QueryComplexity');
		Logger.warn('Failed to calculate query complexity:', getErrorStack(error));
		return config.limits?.maxComplexity ?? QUERY_COMPLEXITY_THRESHOLD;
	}
}

/**
 * Checks if a query exceeds complexity limits
 * @param complexity Calculated complexity score
 * @param config Complexity configuration
 * @returns True if query exceeds limits
 */
export function ExceedsComplexityLimit(
	complexity: number,
	config: IComplexityConfig = DEFAULT_COMPLEXITY_CONFIG,
): boolean {
	const { maxComplexity } = config.limits ?? {};
	return maxComplexity ? complexity > maxComplexity : false;
}

/**
 * Calculates query depth
 * @param info GraphQL resolve info
 * @param maxDepth Maximum allowed depth
 * @returns Query depth
 */
export function CalculateQueryDepth(
	info: GraphQLResolveInfo,
	maxDepth: number = QUERY_DEPTH_LIMIT,
): number {
	let Depth = 0;
	let [Current] = info.fieldNodes;

	while (Current && Depth < maxDepth) {
		Depth++;
		const Selections = Current.selectionSet?.selections ?? [];
		if (Selections.length === 0) break;

		// Find the first field selection (skip fragments for simplicity)
		const FieldSelection = Selections.find(
			(selection: any) => selection.kind === 'Field',
		) as any;

		if (!FieldSelection) break;
		Current = FieldSelection;
	}

	return Depth;
}

/**
 * Checks if query depth exceeds limits
 * @param depth Calculated depth
 * @param config Complexity configuration
 * @returns True if depth exceeds limits
 */
export function ExceedsDepthLimit(
	depth: number,
	config: IComplexityConfig = DEFAULT_COMPLEXITY_CONFIG,
): boolean {
	const { maxDepth } = config.limits ?? {};
	return maxDepth ? depth > maxDepth : false;
}

/**
 * Gets field complexity from GraphQL field config
 * @param fieldConfig GraphQL field configuration
 * @returns Field complexity or default
 */
export function GetFieldComplexity(
	fieldConfig: any,
	defaultComplexity: number = 1,
): number {
	return fieldConfig?.extensions?.complexity ?? defaultComplexity;
}

/**
 * Applies list multiplier to complexity
 * @param complexity Base complexity
 * @param isList Whether the field returns a list
 * @param config Complexity configuration
 * @returns Adjusted complexity
 */
export function ApplyListMultiplier(
	complexity: number,
	isList: boolean,
	config: IComplexityConfig = DEFAULT_COMPLEXITY_CONFIG,
): number {
	if (!isList) return complexity;

	const { list = QUERY_COMPLEXITY_SCALAR_WEIGHT } = config.multipliers ?? {};
	return complexity * list;
}

/**
 * Applies depth multiplier to complexity
 * @param complexity Base complexity
 * @param depth Query depth
 * @param config Complexity configuration
 * @returns Adjusted complexity
 */
export function ApplyDepthMultiplier(
	complexity: number,
	depth: number,
	config: IComplexityConfig = DEFAULT_COMPLEXITY_CONFIG,
): number {
	const { depth: DepthMultiplier = QUERY_COMPLEXITY_DEFAULT_DEPTH_MULTIPLIER } = config.multipliers ?? {};
	return complexity * Math.pow(DepthMultiplier, depth - 1);
}
