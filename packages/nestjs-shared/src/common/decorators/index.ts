export { RequestProperty } from './request-property.decorator.js';
export type { IRequestPropertyOptions } from './request-property.decorator.js';

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
	IBaseDecoratorOptions,
	IConditionalDecoratorOptions,
	IValidatingDecoratorOptions,
	ITransformingDecoratorOptions,
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
export type { IInstrumentOptions } from './instrument.decorator.js';
