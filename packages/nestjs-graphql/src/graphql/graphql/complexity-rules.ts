import { IComplexityConfig, DEFAULT_COMPLEXITY_CONFIG } from './query-complexity.js';
import { QUERY_COMPLEXITY_THRESHOLD, QUERY_DEPTH_LIMIT, QUERY_COMPLEXITY_SCALAR_WEIGHT, QUERY_COMPLEXITY_DEFAULT_DEPTH_MULTIPLIER } from '../constants/complexity.constants.js';

/** Custom scalar complexity is lighter than list items by this offset */
const CUSTOM_SCALAR_WEIGHT_OFFSET = 8;
/** Default estimated item count for list/connection complexity calculations */
const DEFAULT_ESTIMATED_ITEMS = 10;

/**
 * Complexity weights for different field types
 */
export const COMPLEXITY_WEIGHTS = {
	// Simple field operations
	SIMPLE_FIELD: 1,

	// Object field operations (fields that return objects)
	OBJECT_FIELD: 5,

	// List field operations (per item)
	LIST_ITEM: QUERY_COMPLEXITY_SCALAR_WEIGHT,

	// Nested list operations (per item in nested lists)
	NESTED_LIST_ITEM: 50,

	// Connection field operations
	CONNECTION: 20,

	// Union/interface field operations
	UNION_FIELD: 3,

	// Custom scalar operations
	CUSTOM_SCALAR: QUERY_COMPLEXITY_SCALAR_WEIGHT - CUSTOM_SCALAR_WEIGHT_OFFSET,
} as const;

/**
 * Default complexity rules configuration
 */
export const DEFAULT_COMPLEXITY_RULES: IComplexityConfig = {
	...DEFAULT_COMPLEXITY_CONFIG,
	multipliers: {
		depth: QUERY_COMPLEXITY_DEFAULT_DEPTH_MULTIPLIER,
		list: COMPLEXITY_WEIGHTS.LIST_ITEM,
	},
	limits: {
		maxComplexity: QUERY_COMPLEXITY_THRESHOLD,
		maxDepth: QUERY_DEPTH_LIMIT,
	},
};

/**
 * Complexity rules for specific field patterns
 */
export const FIELD_COMPLEXITY_RULES = {
	// IUser-related fields
	user: {
		profile: COMPLEXITY_WEIGHTS.OBJECT_FIELD,
		friends: COMPLEXITY_WEIGHTS.LIST_ITEM,
		posts: COMPLEXITY_WEIGHTS.LIST_ITEM,
		comments: COMPLEXITY_WEIGHTS.LIST_ITEM,
	},

	// IProduct-related fields
	product: {
		details: COMPLEXITY_WEIGHTS.OBJECT_FIELD,
		reviews: COMPLEXITY_WEIGHTS.LIST_ITEM,
		related: COMPLEXITY_WEIGHTS.LIST_ITEM,
	},

	// IOrder-related fields
	order: {
		items: COMPLEXITY_WEIGHTS.LIST_ITEM,
		history: COMPLEXITY_WEIGHTS.LIST_ITEM,
		customer: COMPLEXITY_WEIGHTS.OBJECT_FIELD,
	},

	// IComment-related fields
	comment: {
		replies: COMPLEXITY_WEIGHTS.LIST_ITEM,
		author: COMPLEXITY_WEIGHTS.OBJECT_FIELD,
		post: COMPLEXITY_WEIGHTS.OBJECT_FIELD,
	},

	// ITag-related fields
	tag: {
		posts: COMPLEXITY_WEIGHTS.LIST_ITEM,
		related: COMPLEXITY_WEIGHTS.LIST_ITEM,
	},
} as const;

/**
 * Gets complexity weight for a specific field
 * @param type Entity type (user, product, etc.)
 * @param field Field name
 * @returns Complexity weight or default
 */
export function getFieldComplexityWeight(
	type: keyof typeof FIELD_COMPLEXITY_RULES,
	field: string,
): number {
	const typeRules = FIELD_COMPLEXITY_RULES[type];
	if (!typeRules) return COMPLEXITY_WEIGHTS.SIMPLE_FIELD;

	return (typeRules as any)[field] ?? COMPLEXITY_WEIGHTS.SIMPLE_FIELD;
}

/**
 * Calculates complexity for list fields
 * @param baseComplexity Base field complexity
 * @param estimatedItems Estimated number of items (optional)
 * @param config Complexity configuration
 * @returns Calculated list complexity
 */
export function calculateListComplexity(
	baseComplexity: number,
	estimatedItems: number = DEFAULT_ESTIMATED_ITEMS,
	config: IComplexityConfig = DEFAULT_COMPLEXITY_RULES,
): number {
	const { list = COMPLEXITY_WEIGHTS.LIST_ITEM } = config.multipliers ?? {};
	return baseComplexity + (estimatedItems * list);
}

/**
 * Calculates complexity for nested operations
 * @param baseComplexity Base complexity
 * @param depth Nesting depth
 * @param config Complexity configuration
 * @returns Calculated nested complexity
 */
export function calculateNestedComplexity(
	baseComplexity: number,
	depth: number,
	config: IComplexityConfig = DEFAULT_COMPLEXITY_RULES,
): number {
	const { depth: depthMultiplier = 2 } = config.multipliers ?? {};
	return baseComplexity * Math.pow(depthMultiplier, depth);
}

/**
 * Calculates complexity for connection fields (pagination)
 * @param baseComplexity Base complexity
 * @param first Number of items requested
 * @param config Complexity configuration
 * @returns Calculated connection complexity
 */
export function calculateConnectionComplexity(
	baseComplexity: number,
	first: number = DEFAULT_ESTIMATED_ITEMS,
	config: IComplexityConfig = DEFAULT_COMPLEXITY_RULES,
): number {
	return COMPLEXITY_WEIGHTS.CONNECTION + calculateListComplexity(baseComplexity, first, config);
}

/**
 * Validates complexity configuration
 * @param config Complexity configuration to validate
 * @returns True if configuration is valid
 */
export function validateComplexityConfig(config: IComplexityConfig): boolean {
	const { multipliers, limits } = config;

	// Validate multipliers
	if (multipliers) {
		if (multipliers.depth && multipliers.depth < 1) return false;
		if (multipliers.list && multipliers.list < 1) return false;
	}

	// Validate limits
	if (limits) {
		if (limits.maxComplexity && limits.maxComplexity < 1) return false;
		if (limits.maxDepth && limits.maxDepth < 1) return false;
	}

	return true;
}

/**
 * Creates a custom complexity configuration
 * @param overrides Configuration overrides
 * @returns Merged complexity configuration
 */
export function createComplexityConfig(
	overrides: Partial<IComplexityConfig> = {},
): IComplexityConfig {
	const config = {
		...DEFAULT_COMPLEXITY_RULES,
		...overrides,
		multipliers: {
			...DEFAULT_COMPLEXITY_RULES.multipliers,
			...overrides.multipliers,
		},
		limits: {
			...DEFAULT_COMPLEXITY_RULES.limits,
			...overrides.limits,
		},
	};

	if (!validateComplexityConfig(config)) {
		throw new Error('Invalid complexity configuration');
	}

	return config;
}
