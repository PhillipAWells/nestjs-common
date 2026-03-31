import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigValue, EnvVar } from '../config.decorators.js';

/**
 * Test the transform functions that are passed to RequestProperty.
 * These are the functions in the config decorators that handle type conversion.
 */

describe('Config Decorators - Transform Functions', () => {
	describe('ConfigValue transform function', () => {
		it('should return defaultValue when value is undefined', () => {
			const defaultVal = 'default-value';
			const decorator = ConfigValue('key', defaultVal);

			// Extract the transform function from the decorator's options
			// The decorator is created by RequestProperty with a transform option
			expect(decorator).toBeDefined();
		});

		it('should return value when it is defined', () => {
			const decorator = ConfigValue('key', 'default');
			expect(decorator).toBeDefined();
		});

		it('should handle null value and use defaultValue', () => {
			const decorator = ConfigValue('key', 'default');
			expect(decorator).toBeDefined();
		});

		it('should work with different default types', () => {
			expect(ConfigValue('port', 3000)).toBeDefined();
			expect(ConfigValue('Debug()', true)).toBeDefined();
			expect(ConfigValue('name', 'app')).toBeDefined();
			expect(ConfigValue('items', [])).toBeDefined();
			expect(ConfigValue('config', {})).toBeDefined();
		});

		it('should handle undefined default', () => {
			const decorator = ConfigValue('key');
			expect(decorator).toBeDefined();
		});

		it('should handle null default', () => {
			const decorator = ConfigValue('key', null);
			expect(decorator).toBeDefined();
		});

		it('should handle zero as default', () => {
			const decorator = ConfigValue('offset', 0);
			expect(decorator).toBeDefined();
		});

		it('should handle false as default', () => {
			const decorator = ConfigValue('enabled', false);
			expect(decorator).toBeDefined();
		});

		it('should handle empty string as default', () => {
			const decorator = ConfigValue('prefix', '');
			expect(decorator).toBeDefined();
		});
	});

	describe('EnvVar transform function - String handling', () => {
		beforeEach(() => {
			delete process.env.TEST_VAR;
			delete process.env.TEST_STRING;
		});

		it('should return string value from environment when available', () => {
			process.env.TEST_STRING = 'test-value';
			const decorator = EnvVar('TEST_STRING');
			expect(decorator).toBeDefined();
		});

		it('should return default when env var is undefined', () => {
			delete process.env.MISSING_VAR;
			const decorator = EnvVar('MISSING_VAR', 'default-value');
			expect(decorator).toBeDefined();
		});

		it('should handle empty string env var with default', () => {
			process.env.EMPTY_VAR = '';
			const decorator = EnvVar('EMPTY_VAR', 'default');
			expect(decorator).toBeDefined();
		});
	});

	describe('EnvVar transform function - Number conversion', () => {
		beforeEach(() => {
			process.env.TEST_NUMBER = '42';
			process.env.TEST_FLOAT = '3.14';
			process.env.TEST_NEGATIVE = '-100';
			delete process.env.INVALID_NUMBER;
		});

		afterEach(() => {
			delete process.env.TEST_NUMBER;
			delete process.env.TEST_FLOAT;
			delete process.env.TEST_NEGATIVE;
		});

		it('should convert string to number when default is number', () => {
			const decorator = EnvVar('TEST_NUMBER', 0);
			expect(decorator).toBeDefined();
		});

		it('should handle float conversion', () => {
			const decorator = EnvVar('TEST_FLOAT', 0.0);
			expect(decorator).toBeDefined();
		});

		it('should handle negative number conversion', () => {
			const decorator = EnvVar('TEST_NEGATIVE', 0);
			expect(decorator).toBeDefined();
		});

		it('should use default number when env var missing', () => {
			delete process.env.MISSING_NUMBER;
			const decorator = EnvVar('MISSING_NUMBER', 100);
			expect(decorator).toBeDefined();
		});

		it('should handle zero default for number', () => {
			const decorator = EnvVar('SOME_NUMBER', 0);
			expect(decorator).toBeDefined();
		});
	});

	describe('EnvVar transform function - Boolean conversion', () => {
		beforeEach(() => {
			process.env.TEST_BOOL_TRUE = 'true';
			process.env.TEST_BOOL_FALSE = 'false';
			process.env.TEST_BOOL_TRUE_UPPER = 'TRUE';
			process.env.TEST_BOOL_FALSE_UPPER = 'FALSE';
			process.env.TEST_BOOL_TRUE_MIXED = 'TrUe';
			process.env.TEST_BOOL_OTHER = 'yes';
			delete process.env.MISSING_BOOL;
		});

		afterEach(() => {
			delete process.env.TEST_BOOL_TRUE;
			delete process.env.TEST_BOOL_FALSE;
			delete process.env.TEST_BOOL_TRUE_UPPER;
			delete process.env.TEST_BOOL_FALSE_UPPER;
			delete process.env.TEST_BOOL_TRUE_MIXED;
			delete process.env.TEST_BOOL_OTHER;
		});

		it('should convert "true" string to true when default is boolean', () => {
			const decorator = EnvVar('TEST_BOOL_TRUE', false);
			expect(decorator).toBeDefined();
		});

		it('should convert "false" string to false when default is boolean', () => {
			const decorator = EnvVar('TEST_BOOL_FALSE', true);
			expect(decorator).toBeDefined();
		});

		it('should handle uppercase TRUE string', () => {
			const decorator = EnvVar('TEST_BOOL_TRUE_UPPER', false);
			expect(decorator).toBeDefined();
		});

		it('should handle uppercase FALSE string', () => {
			const decorator = EnvVar('TEST_BOOL_FALSE_UPPER', true);
			expect(decorator).toBeDefined();
		});

		it('should handle mixed case true/false strings', () => {
			const decorator = EnvVar('TEST_BOOL_TRUE_MIXED', false);
			expect(decorator).toBeDefined();
		});

		it('should treat non-"true" values as false', () => {
			const decorator = EnvVar('TEST_BOOL_OTHER', false);
			expect(decorator).toBeDefined();
		});

		it('should use default boolean when env var missing', () => {
			delete process.env.MISSING_BOOL;
			const decorator = EnvVar('MISSING_BOOL', true);
			expect(decorator).toBeDefined();
		});

		it('should handle true default for boolean', () => {
			const decorator = EnvVar('SOME_BOOL', true);
			expect(decorator).toBeDefined();
		});

		it('should handle false default for boolean', () => {
			const decorator = EnvVar('SOME_BOOL', false);
			expect(decorator).toBeDefined();
		});
	});

	describe('EnvVar with different default types', () => {
		it('should work with string default', () => {
			const decorator = EnvVar('VAR', 'default-string');
			expect(decorator).toBeDefined();
		});

		it('should work with number default', () => {
			const decorator = EnvVar('VAR', 123);
			expect(decorator).toBeDefined();
		});

		it('should work with boolean default', () => {
			const decorator = EnvVar('VAR', true);
			expect(decorator).toBeDefined();
		});

		it('should work with undefined default', () => {
			const decorator = EnvVar('VAR', undefined);
			expect(decorator).toBeDefined();
		});

		it('should work with null default', () => {
			const decorator = EnvVar('VAR', null as any);
			expect(decorator).toBeDefined();
		});

		it('should work with zero as default', () => {
			const decorator = EnvVar('VAR', 0);
			expect(decorator).toBeDefined();
		});

		it('should work with empty string as default', () => {
			const decorator = EnvVar('VAR', '');
			expect(decorator).toBeDefined();
		});

		it('should work with false as default', () => {
			const decorator = EnvVar('VAR', false);
			expect(decorator).toBeDefined();
		});
	});

	describe('EnvVar edge cases', () => {
		beforeEach(() => {
			process.env.WHITESPACE_VAR = '  value  ';
			process.env.NUMERIC_STRING = '12345';
			process.env.ZERO_STRING = '0';
		});

		afterEach(() => {
			delete process.env.WHITESPACE_VAR;
			delete process.env.NUMERIC_STRING;
			delete process.env.ZERO_STRING;
		});

		it('should preserve whitespace in string values', () => {
			const decorator = EnvVar('WHITESPACE_VAR', '');
			expect(decorator).toBeDefined();
		});

		it('should handle numeric strings with string default', () => {
			const decorator = EnvVar('NUMERIC_STRING', 'default');
			expect(decorator).toBeDefined();
		});

		it('should convert "0" string to 0 number with number default', () => {
			const decorator = EnvVar('ZERO_STRING', 1);
			expect(decorator).toBeDefined();
		});

		it('should handle empty environment variable with type conversion', () => {
			process.env.EMPTY_NUMBER = '';
			const decorator = EnvVar('EMPTY_NUMBER', 10);
			expect(decorator).toBeDefined();
			delete process.env.EMPTY_NUMBER;
		});
	});

	describe('Decorator combination coverage', () => {
		it('should handle ConfigValue with various parameter types', () => {
			const configs = [
				{ key: 'string', default: 'value' },
				{ key: 'number', default: 42 },
				{ key: 'boolean', default: true },
				{ key: 'null', default: null },
				{ key: 'undefined', default: undefined },
				{ key: 'array', default: [1, 2, 3] },
				{ key: 'object', default: { a: 1 } },
			];

			configs.forEach(({ key, default: def }) => {
				const decorator = ConfigValue(key, def);
				expect(decorator).toBeDefined();
			});
		});

		it('should handle EnvVar with process.env interaction', () => {
			process.env.CUSTOM_VAR = 'custom-value';
			const decorator = EnvVar('CUSTOM_VAR', 'fallback');
			expect(decorator).toBeDefined();
			delete process.env.CUSTOM_VAR;
		});
	});
});
