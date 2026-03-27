import { GraphQLResolveInfo } from 'graphql';
import { getComplexity, simpleEstimator, fieldExtensionsEstimator } from 'graphql-query-complexity';
import { AppLogger, getErrorStack } from '@pawells/nestjs-shared/common';
import { QUERY_COMPLEXITY_THRESHOLD, QUERY_DEPTH_LIMIT, QUERY_COMPLEXITY_SCALAR_WEIGHT, QUERY_COMPLEXITY_DEFAULT_DEPTH_MULTIPLIER } from '../constants/complexity.constants.js';

/**
 * Interface for complexity configuration
 */
export interface ComplexityConfig {
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
export const DEFAULT_COMPLEXITY_CONFIG: ComplexityConfig = {
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
export function calculateQueryComplexity(
	schema: any,
	query: any,
	variables: Record<string, any> | undefined,
	operationName: string | undefined,
	config: ComplexityConfig = DEFAULT_COMPLEXITY_CONFIG,
): number {
	const { defaultComplexity = 1 } = config;

	try {
		const complexity = getComplexity({
			schema,
			query,
			...(variables !== undefined ? { variables } : {}),
			...(operationName !== undefined ? { operationName } : {}),
			estimators: [
				fieldExtensionsEstimator(),
				simpleEstimator({ defaultComplexity }),
			],
		});

		return complexity;
	} catch (error) {
		// If complexity calculation fails, return a high complexity to be safe
		const logger = new AppLogger(undefined, 'QueryComplexity');
		logger.warn('Failed to calculate query complexity:', getErrorStack(error));
		return config.limits?.maxComplexity ?? QUERY_COMPLEXITY_THRESHOLD;
	}
}

/**
 * Checks if a query exceeds complexity limits
 * @param complexity Calculated complexity score
 * @param config Complexity configuration
 * @returns True if query exceeds limits
 */
export function exceedsComplexityLimit(
	complexity: number,
	config: ComplexityConfig = DEFAULT_COMPLEXITY_CONFIG,
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
export function calculateQueryDepth(
	info: GraphQLResolveInfo,
	maxDepth: number = QUERY_DEPTH_LIMIT,
): number {
	let depth = 0;
	let [current] = info.fieldNodes;

	while (current && depth < maxDepth) {
		depth++;
		const selections = current.selectionSet?.selections ?? [];
		if (selections.length === 0) break;

		// Find the first field selection (skip fragments for simplicity)
		const fieldSelection = selections.find(
			(selection: any) => selection.kind === 'Field',
		) as any;

		if (!fieldSelection) break;
		current = fieldSelection;
	}

	return depth;
}

/**
 * Checks if query depth exceeds limits
 * @param depth Calculated depth
 * @param config Complexity configuration
 * @returns True if depth exceeds limits
 */
export function exceedsDepthLimit(
	depth: number,
	config: ComplexityConfig = DEFAULT_COMPLEXITY_CONFIG,
): boolean {
	const { maxDepth } = config.limits ?? {};
	return maxDepth ? depth > maxDepth : false;
}

/**
 * Gets field complexity from GraphQL field config
 * @param fieldConfig GraphQL field configuration
 * @returns Field complexity or default
 */
export function getFieldComplexity(
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
export function applyListMultiplier(
	complexity: number,
	isList: boolean,
	config: ComplexityConfig = DEFAULT_COMPLEXITY_CONFIG,
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
export function applyDepthMultiplier(
	complexity: number,
	depth: number,
	config: ComplexityConfig = DEFAULT_COMPLEXITY_CONFIG,
): number {
	const { depth: depthMultiplier = QUERY_COMPLEXITY_DEFAULT_DEPTH_MULTIPLIER } = config.multipliers ?? {};
	return complexity * Math.pow(depthMultiplier, depth - 1);
}
