export { RequestProperty } from './request-property.decorator.js';
export type { RequestPropertyOptions } from './request-property.decorator.js';

// Decorator factories
export {
	CreateRequestPropertyDecorator as createRequestPropertyDecorator,
	CreateConditionalDecorator as createConditionalDecorator,
	CreateValidatingDecorator as createValidatingDecorator,
	CreateTransformingDecorator as createTransformingDecorator,
	GetRequestFromContext as getRequestFromContext,
} from './decorator-factory.js';
export { ObjectGetPropertyByPath as GetNestedProperty, ObjectGetPropertyByPath as getNestedProperty } from '@pawells/typescript-common';
export type {
	BaseDecoratorOptions,
	ConditionalDecoratorOptions,
	ValidatingDecoratorOptions,
	TransformingDecoratorOptions,
} from './decorator-factory.js';

// Common decorators
export {
	Query,
	Params,
	Body,
	Headers,
	Cookies,
} from './common-decorators.js';

// Guard decorators
export * from './guard.decorators.js';

// Instrumentation
export { InstrumentationRegistryHolder, Instrument } from './instrument.decorator.js';
export type { InstrumentOptions } from './instrument.decorator.js';
