import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for subscription configuration
 */
export const SUBSCRIPTION_METADATA = 'subscription';

/**
 * Options for subscription decorator
 */
export interface ISubscriptionOptions {
	/** Topic filter pattern */
	filter?: string;

	/** Parameter mapping for dynamic topics */
	params?: string[];

	/** Whether to require authentication */
	requiresAuth?: boolean;

	/** Custom resolver function */
	resolver?: (...args: unknown[]) => unknown;
}

/**
 * Decorator for GraphQL subscription resolvers
 * @param topic The subscription topic pattern
 * @param options Additional subscription options
 * @returns Method decorator
 */
export function Subscription(topic: string, options: ISubscriptionOptions = {}) {
	return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
		// Store subscription metadata
		SetMetadata(SUBSCRIPTION_METADATA, {
			topic,
			...options,
			methodName: propertyKey,
		})(target, propertyKey, descriptor);

		// Mark method as subscription resolver
		SetMetadata('graphql:subscription', true)(target, propertyKey, descriptor);
		return descriptor;
	};
}

/**
 * Decorator for subscription filters
 * @param filterFunction Filter function
 * @returns Parameter decorator
 */
export function SubscriptionFilter(filterFunction: (payload: any, variables: any, context: any) => boolean) {
	return (target: any, propertyKey: string, parameterIndex: number) => {
		const ExistingFilters = Reflect.getMetadata('subscription:filters', target, propertyKey) ?? [];
		ExistingFilters.push({
			parameterIndex,
			filterFunction,
		});
		Reflect.defineMetadata('subscription:filters', ExistingFilters, target, propertyKey);
		return undefined;
	};
}

/**
 * Decorator for subscription authentication
 * @param requiredRoles Required roles for subscription
 * @returns Method decorator
 */
export function SubscriptionAuth(requiredRoles: string[] = []) {
	return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
		SetMetadata('subscription:auth', { requiredRoles })(target, propertyKey, descriptor);
		return descriptor;
	};
}
