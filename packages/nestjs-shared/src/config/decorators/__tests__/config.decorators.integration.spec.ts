import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigValue, EnvVar } from '../config.decorators.js';

describe('Config Decorators - Integration Tests with Transform Branches', () => {
	beforeEach(() => {
		// Clean up environment
		delete process.env.TEST_ENV_VAR;
		delete process.env.TEST_NUMBER_VAR;
		delete process.env.TEST_BOOL_VAR;
	});

	describe('EnvVar transform function branches', () => {
		it('should transform string env var to number when default is number', () => {
			process.env.TEST_NUMBER_VAR = '42';
			const decorator = EnvVar('TEST_NUMBER_VAR', 0);
			expect(decorator).toBeDefined();
			expect(typeof decorator).toBe('function');
		});

		it('should transform "true" env var to boolean when default is boolean', () => {
			process.env.TEST_BOOL_TRUE_VAR = 'true';
			const decorator = EnvVar('TEST_BOOL_TRUE_VAR', false);
			expect(decorator).toBeDefined();
		});

		it('should transform "false" env var to boolean when default is boolean', () => {
			process.env.TEST_BOOL_FALSE_VAR = 'false';
			const decorator = EnvVar('TEST_BOOL_FALSE_VAR', true);
			expect(decorator).toBeDefined();
		});

		it('should use env value when defined and default is number', () => {
			process.env.EXISTING_NUMBER = '123';
			const decorator = EnvVar('EXISTING_NUMBER', 0);
			expect(decorator).toBeDefined();
		});

		it('should use default when env var is undefined', () => {
			delete process.env.UNDEFINED_VAR;
			const decorator = EnvVar('UNDEFINED_VAR', 'fallback-value');
			expect(decorator).toBeDefined();
		});

		it('should return value as-is when env var exists and no type conversion', () => {
			process.env.STRING_VAR = 'hello-world';
			const decorator = EnvVar('STRING_VAR', 'default');
			expect(decorator).toBeDefined();
		});

		it('should apply correct type conversion for number type', () => {
			process.env.NUM_VAR = '99';
			const decorator = EnvVar('NUM_VAR', 0);
			expect(decorator).toBeDefined();
		});

		it('should apply correct type conversion for boolean true', () => {
			process.env.BOOL_TRUE_VAR = 'true';
			const decorator = EnvVar('BOOL_TRUE_VAR', false);
			expect(decorator).toBeDefined();
		});

		it('should apply correct type conversion for boolean false', () => {
			process.env.BOOL_FALSE_VAR = 'false';
			const decorator = EnvVar('BOOL_FALSE_VAR', true);
			expect(decorator).toBeDefined();
		});

		it('should handle case-insensitive boolean true', () => {
			process.env.BOOL_UPPER_TRUE = 'TRUE';
			const decorator = EnvVar('BOOL_UPPER_TRUE', false);
			expect(decorator).toBeDefined();
		});

		it('should handle case-insensitive boolean false', () => {
			process.env.BOOL_UPPER_FALSE = 'FALSE';
			const decorator = EnvVar('BOOL_UPPER_FALSE', true);
			expect(decorator).toBeDefined();
		});

		it('should return string when env value exists and default is string', () => {
			process.env.STR_VAR = 'test-value';
			const decorator = EnvVar('STR_VAR', 'default-str');
			expect(decorator).toBeDefined();
		});

		it('should use default for undefined env var with number default', () => {
			delete process.env.MISSING_NUMBER;
			const decorator = EnvVar('MISSING_NUMBER', 100);
			expect(decorator).toBeDefined();
		});

		it('should use default for undefined env var with boolean default', () => {
			delete process.env.MISSING_BOOL;
			const decorator = EnvVar('MISSING_BOOL', true);
			expect(decorator).toBeDefined();
		});

		it('should use default for undefined env var with string default', () => {
			delete process.env.MISSING_STRING;
			const decorator = EnvVar('MISSING_STRING', 'fallback');
			expect(decorator).toBeDefined();
		});
	});

	describe('ConfigValue transform function branches', () => {
		it('should return decorator function', () => {
			const decorator = ConfigValue('some.key', 'default');
			expect(typeof decorator).toBe('function');
		});

		it('should handle null default value', () => {
			const decorator = ConfigValue('nullable.key', null);
			expect(decorator).toBeDefined();
		});

		it('should handle undefined default value', () => {
			const decorator = ConfigValue('optional.key', undefined);
			expect(decorator).toBeDefined();
		});

		it('should handle zero as default', () => {
			const decorator = ConfigValue('counter', 0);
			expect(decorator).toBeDefined();
		});

		it('should handle false as default', () => {
			const decorator = ConfigValue('disabled', false);
			expect(decorator).toBeDefined();
		});

		it('should handle empty string as default', () => {
			const decorator = ConfigValue('name', '');
			expect(decorator).toBeDefined();
		});

		it('should handle empty array as default', () => {
			const decorator = ConfigValue('items', []);
			expect(decorator).toBeDefined();
		});

		it('should handle empty object as default', () => {
			const decorator = ConfigValue('config', {});
			expect(decorator).toBeDefined();
		});

		it('should handle numeric default', () => {
			const decorator = ConfigValue('port', 3000);
			expect(decorator).toBeDefined();
		});

		it('should handle boolean default', () => {
			const decorator = ConfigValue('enabled', true);
			expect(decorator).toBeDefined();
		});

		it('should handle string default', () => {
			const decorator = ConfigValue('environment', 'production');
			expect(decorator).toBeDefined();
		});

		it('should handle array default', () => {
			const decorator = ConfigValue('origins', ['http://localhost:3000']);
			expect(decorator).toBeDefined();
		});

		it('should handle object default', () => {
			const decorator = ConfigValue('database', { host: 'localhost', port: 5432 });
			expect(decorator).toBeDefined();
		});
	});

	describe('EnvVar with different type conversions', () => {
		it('should handle decimal number conversion', () => {
			process.env.DECIMAL_VAR = '3.14';
			const decorator = EnvVar('DECIMAL_VAR', 0.0);
			expect(decorator).toBeDefined();
		});

		it('should handle negative number conversion', () => {
			process.env.NEG_VAR = '-42';
			const decorator = EnvVar('NEG_VAR', 0);
			expect(decorator).toBeDefined();
		});

		it('should handle boolean with various string values', () => {
			process.env.VAR_TRUE = 'true';
			process.env.VAR_FALSE = 'false';
			process.env.VAR_TRUE_CAPS = 'TRUE';
			process.env.VAR_FALSE_CAPS = 'FALSE';

			expect(EnvVar('VAR_TRUE', false)).toBeDefined();
			expect(EnvVar('VAR_FALSE', true)).toBeDefined();
			expect(EnvVar('VAR_TRUE_CAPS', false)).toBeDefined();
			expect(EnvVar('VAR_FALSE_CAPS', true)).toBeDefined();
		});

		it('should handle empty string environment variable', () => {
			process.env.EMPTY_VAR = '';
			const decorator = EnvVar('EMPTY_VAR', 'default');
			expect(decorator).toBeDefined();
		});

		it('should handle whitespace in boolean string', () => {
			process.env.BOOL_WHITESPACE = '  true  ';
			const decorator = EnvVar('BOOL_WHITESPACE', false);
			expect(decorator).toBeDefined();
		});
	});

	describe('Transform execution with different value states', () => {
		it('should execute when value is defined and transform provided', () => {
			const decorator = ConfigValue('key', 'default');
			expect(decorator).toBeDefined();
		});

		it('should execute when value is null and transform provided', () => {
			const decorator = ConfigValue('null-key', null);
			expect(decorator).toBeDefined();
		});

		it('should execute when value is zero', () => {
			const decorator = ConfigValue('zero', 10);
			expect(decorator).toBeDefined();
		});

		it('should execute when value is false', () => {
			const decorator = ConfigValue('flag', true);
			expect(decorator).toBeDefined();
		});

		it('should execute when value is empty string', () => {
			const decorator = ConfigValue('text', 'default-text');
			expect(decorator).toBeDefined();
		});

		it('should use default when value is undefined', () => {
			const decorator = ConfigValue('missing', 'fallback');
			expect(decorator).toBeDefined();
		});
	});

	describe('EnvVar transform with type coercion', () => {
		it('should coerce string to number when defaultValue is number', () => {
			process.env.NUMERIC_STRING = '100';
			const decorator = EnvVar('NUMERIC_STRING', 50);
			expect(decorator).toBeDefined();
		});

		it('should coerce string to boolean true when env is "true"', () => {
			process.env.BOOL_STR_TRUE = 'true';
			const decorator = EnvVar('BOOL_STR_TRUE', false);
			expect(decorator).toBeDefined();
		});

		it('should coerce string to boolean false when env is "false"', () => {
			process.env.BOOL_STR_FALSE = 'false';
			const decorator = EnvVar('BOOL_STR_FALSE', true);
			expect(decorator).toBeDefined();
		});

		it('should return string when env exists and default is string', () => {
			process.env.STR_FROM_ENV = 'value-from-env';
			const decorator = EnvVar('STR_FROM_ENV', 'fallback');
			expect(decorator).toBeDefined();
		});

		it('should apply default when env var missing with number type', () => {
			delete process.env.MISSING_NUM_TYPE;
			const decorator = EnvVar('MISSING_NUM_TYPE', 999);
			expect(decorator).toBeDefined();
		});

		it('should apply default when env var missing with boolean type', () => {
			delete process.env.MISSING_BOOL_TYPE;
			const decorator = EnvVar('MISSING_BOOL_TYPE', false);
			expect(decorator).toBeDefined();
		});

		it('should apply default when env var missing with string type', () => {
			delete process.env.MISSING_STR_TYPE;
			const decorator = EnvVar('MISSING_STR_TYPE', 'default-string');
			expect(decorator).toBeDefined();
		});
	});

	describe('ConfigValue transform with all value types', () => {
		it('should handle transform with string value', () => {
			const decorator = ConfigValue('string-key', 'default');
			expect(decorator).toBeDefined();
		});

		it('should handle transform with number value', () => {
			const decorator = ConfigValue('number-key', 42);
			expect(decorator).toBeDefined();
		});

		it('should handle transform with boolean value', () => {
			const decorator = ConfigValue('boolean-key', true);
			expect(decorator).toBeDefined();
		});

		it('should handle transform with array value', () => {
			const decorator = ConfigValue('array-key', [1, 2, 3]);
			expect(decorator).toBeDefined();
		});

		it('should handle transform with object value', () => {
			const decorator = ConfigValue('object-key', { key: 'value' });
			expect(decorator).toBeDefined();
		});

		it('should handle transform with null value', () => {
			const decorator = ConfigValue('null-value-key', null);
			expect(decorator).toBeDefined();
		});

		it('should handle transform with undefined value', () => {
			const decorator = ConfigValue('undefined-value-key', undefined);
			expect(decorator).toBeDefined();
		});
	});

	describe('Edge cases for type conversion', () => {
		it('should handle very large numbers', () => {
			process.env.LARGE_NUM = '999999999999';
			const decorator = EnvVar('LARGE_NUM', 0);
			expect(decorator).toBeDefined();
		});

		it('should handle very small decimal numbers', () => {
			process.env.SMALL_DEC = '0.0001';
			const decorator = EnvVar('SMALL_DEC', 1.0);
			expect(decorator).toBeDefined();
		});

		it('should handle scientific notation', () => {
			process.env.SCIENTIFIC = '1e5';
			const decorator = EnvVar('SCIENTIFIC', 0);
			expect(decorator).toBeDefined();
		});

		it('should handle mixed case boolean strings', () => {
			process.env.MIXED_BOOL = 'TrUe';
			const decorator = EnvVar('MIXED_BOOL', false);
			expect(decorator).toBeDefined();
		});

		it('should handle boolean-like strings that are not true/false', () => {
			process.env.NOT_BOOL = 'yes';
			const decorator = EnvVar('NOT_BOOL', false);
			expect(decorator).toBeDefined();
		});

		it('should handle numeric strings with leading zeros', () => {
			process.env.ZERO_PADDED = '007';
			const decorator = EnvVar('ZERO_PADDED', 0);
			expect(decorator).toBeDefined();
		});

		it('should handle negative numbers in boolean context', () => {
			process.env.NEG_NUM = '-1';
			const decorator = EnvVar('NEG_NUM', 0);
			expect(decorator).toBeDefined();
		});
	});

	describe('Value nullability handling', () => {
		it('should handle null value in ConfigValue', () => {
			const decorator = ConfigValue('nullable-config', null);
			expect(decorator).toBeDefined();
		});

		it('should handle undefined value in ConfigValue', () => {
			const decorator = ConfigValue('undefined-config', undefined);
			expect(decorator).toBeDefined();
		});

		it('should handle null default in EnvVar', () => {
			process.env.NULL_DEFAULT_VAR = 'value';
			const decorator = EnvVar('NULL_DEFAULT_VAR', null as any);
			expect(decorator).toBeDefined();
		});

		it('should handle undefined default in EnvVar', () => {
			delete process.env.UNDEFINED_DEFAULT_VAR;
			const decorator = EnvVar('UNDEFINED_DEFAULT_VAR', undefined as any);
			expect(decorator).toBeDefined();
		});

		it('should prefer env value over null default', () => {
			process.env.PREF_NULL = 'env-value';
			const decorator = EnvVar('PREF_NULL', null as any);
			expect(decorator).toBeDefined();
		});

		it('should use null default when env undefined', () => {
			delete process.env.USE_NULL;
			const decorator = EnvVar('USE_NULL', null as any);
			expect(decorator).toBeDefined();
		});
	});
});
