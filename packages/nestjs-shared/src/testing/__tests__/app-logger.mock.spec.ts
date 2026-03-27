import { describe, it, expect, beforeEach } from 'vitest';
import { MockAppLogger } from '../mocks/app-logger.mock.js';

describe('MockAppLogger', () => {
	let logger: MockAppLogger;

	beforeEach(() => {
		logger = new MockAppLogger();
	});

	it('should instantiate', () => {
		expect(logger).toBeInstanceOf(MockAppLogger);
	});

	it('debug() is a no-op', () => {
		expect(() => logger.debug('msg')).not.toThrow();
		expect(() => logger.debug('msg', 'context')).not.toThrow();
		expect(() => logger.debug('msg', { key: 'value' })).not.toThrow();
		expect(() => logger.debug(new Error('err'))).not.toThrow();
	});

	it('info() is a no-op', () => {
		expect(() => logger.info('msg')).not.toThrow();
		expect(() => logger.info('msg', 'context')).not.toThrow();
	});

	it('warn() is a no-op', () => {
		expect(() => logger.warn('msg')).not.toThrow();
		expect(() => logger.warn(new Error('err'))).not.toThrow();
	});

	it('error() is a no-op', () => {
		expect(() => logger.error('msg')).not.toThrow();
		expect(() => logger.error('msg', 'trace')).not.toThrow();
		expect(() => logger.error('msg', 'trace', 'context')).not.toThrow();
		expect(() => logger.error(new Error('err'))).not.toThrow();
	});

	it('fatal() is a no-op', () => {
		expect(() => logger.fatal('msg')).not.toThrow();
		expect(() => logger.fatal('msg', 'trace', 'context')).not.toThrow();
	});

	it('createContextualLogger() returns itself', () => {
		const contextual = logger.createContextualLogger('TestContext');
		expect(contextual).toBe(logger);
	});

	it('createContextualLogger() chaining returns same instance', () => {
		const contextual = logger.createContextualLogger('A').createContextualLogger('B');
		expect(contextual).toBe(logger);
	});
});
