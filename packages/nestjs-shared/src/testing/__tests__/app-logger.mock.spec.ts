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

	it('Debug()() is a no-op', () => {
		expect(() => logger.Debug('msg')).not.toThrow();
		expect(() => logger.Debug('msg', 'context')).not.toThrow();
		expect(() => logger.Debug('msg', { key: 'value' })).not.toThrow();
		expect(() => logger.Debug(new Error('err'))).not.toThrow();
	});

	it('Info() is a no-op', () => {
		expect(() => logger.Info('msg')).not.toThrow();
		expect(() => logger.Info('msg', 'context')).not.toThrow();
	});

	it('Warn() is a no-op', () => {
		expect(() => logger.Warn('msg')).not.toThrow();
		expect(() => logger.Warn(new Error('err'))).not.toThrow();
	});

	it('Error() is a no-op', () => {
		expect(() => logger.Error('msg')).not.toThrow();
		expect(() => logger.Error('msg', 'trace')).not.toThrow();
		expect(() => logger.Error('msg', 'trace', 'context')).not.toThrow();
		expect(() => logger.Error(new Error('err'))).not.toThrow();
	});

	it('fatal() is a no-op', () => {
		expect(() => logger.fatal('msg')).not.toThrow();
		expect(() => logger.fatal('msg', 'trace', 'context')).not.toThrow();
	});

	it('createContextualLogger() returns itself', () => {
		const contextual = logger.CreateContextualLogger('TestContext');
		expect(contextual).toBe(logger);
	});

	it('createContextualLogger() chaining returns same instance', () => {
		const contextual = logger.createContextualLogger('A').createContextualLogger('B');
		expect(contextual).toBe(logger);
	});
});
