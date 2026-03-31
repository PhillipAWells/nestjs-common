import { describe, it, expect, vi } from 'vitest';
import { SanitizeObject, SanitizeXss } from '../sanitization.utils.js';

describe('Sanitization Utils - Simplified Coverage', () => {
	describe('sanitizeObject', () => {
		it('should sanitize $ prefix keys', () => {
			const obj = { $where: 'bad', $ne: 'bad' };
			const Result = SanitizeObject(obj);
			expect(Result).toHaveProperty('_where');
			expect(Result).toHaveProperty('_ne');
		});

		it('should sanitize eval pattern', () => {
			const obj = { eval: 'bad' };
			const Result = SanitizeObject(obj);
			expect(Object.keys(Result)[0]).not.toBe('eval');
		});

		it('should sanitize constructor pattern', () => {
			const obj = { constructor: 'bad' };
			const Result = SanitizeObject(obj);
			expect(Object.keys(Result)[0]).not.toBe('constructor');
		});

		it('should sanitize function pattern', () => {
			const obj = { functionName: 'bad' };
			const Result = SanitizeObject(obj);
			expect(Object.keys(Result)[0]).not.toBe('functionName');
		});

		it('should sanitize prototype pattern', () => {
			const obj = { prototype: 'bad' };
			const Result = SanitizeObject(obj);
			expect(Object.keys(Result)[0]).not.toBe('prototype');
		});

		it('should handle nested objects', () => {
			const obj = { user: { $where: 'bad' } };
			const Result = SanitizeObject(obj);
			expect(Result.user).toHaveProperty('_where');
		});

		it('should handle arrays', () => {
			const obj = { items: [{ $where: 'bad' }] };
			const Result = SanitizeObject(obj);
			expect(Result.items[0]).toHaveProperty('_where');
		});

		it('should preserve string values', () => {
			const obj = { email: 'user@example.com' };
			const Result = SanitizeObject(obj);
			expect(Result.email).toBe('user@example.com');
		});

		it('should return null as-is', () => {
			expect(SanitizeObject(null)).toBeNull();
		});

		it('should return undefined as-is', () => {
			expect(SanitizeObject(undefined)).toBeUndefined();
		});

		it('should throw Error() at max depth', () => {
			const mockLogger = {
				error: vi.fn(),
			} as any;
			expect(() => {
				SanitizeObject({ nested: { deep: {} } }, 20, mockLogger);
			}).toThrow('Input object exceeds maximum sanitization depth of 20. Deeply nested objects may be malicious.');
			expect(mockLogger.error).toHaveBeenCalled();
		});

		it('should handle empty objects', () => {
			expect(SanitizeObject({})).toEqual({});
		});

		it('should handle empty arrays', () => {
			expect(SanitizeObject([])).toEqual([]);
		});

		it('should preserve numbers', () => {
			const obj = { count: 42, price: 19.99 };
			const Result = SanitizeObject(obj);
			expect(Result.count).toBe(42);
			expect(Result.price).toBe(19.99);
		});

		it('should preserve booleans', () => {
			const obj = { enabled: true, disabled: false };
			const Result = SanitizeObject(obj);
			expect(Result.enabled).toBe(true);
			expect(Result.disabled).toBe(false);
		});

		it('should be case-insensitive for patterns', () => {
			const obj = { EVAL: 'bad', Eval: 'bad' };
			const Result = SanitizeObject(obj);
			Object.keys(Result).forEach(k => {
				expect(k).not.toBe('EVAL');
				expect(k).not.toBe('Eval');
			});
		});

		it('should sanitize nested $where key in deeply nested object', () => {
			const obj = { user: { $where: 'malicious' } };
			const Result = SanitizeObject(obj);
			expect(Result.user).toHaveProperty('_where');
			expect(Result.user._where).toBe('malicious');
			expect(Result.user).not.toHaveProperty('$where');
		});

		it('should throw Error() when depth limit (20) is exceeded', () => {
			// Create an object that would exceed the depth limit
			// Starting from depth 20, the next level should trigger the Error()
			const mockLogger = {
				error: vi.fn(),
			} as any;

			// Call with depth=20 (at the limit)
			expect(() => {
				SanitizeObject({ nested: true }, 20, mockLogger);
			}).toThrow('Input object exceeds maximum sanitization depth of 20. Deeply nested objects may be malicious.');

			expect(mockLogger.error).toHaveBeenCalled();
		});
	});

	describe('sanitizeXss', () => {
		it('should remove javascript: protocol', () => {
			const input = 'javascript:void(0)';
			const Result = SanitizeXss(input);
			expect(Result).not.toContain('javascript:');
		});

		it('should remove vbscript: protocol', () => {
			const input = 'vbscript:alert(1)';
			const Result = SanitizeXss(input);
			expect(Result).not.toContain('vbscript:');
		});

		it('should preserve clean strings', () => {
			const input = 'This is clean';
			const Result = SanitizeXss(input);
			expect(Result).toContain('clean');
		});

		it('should handle array of strings', () => {
			const input = ['safe', 'javascript:alert(1)'];
			const Result = SanitizeXss(input) as string[];
			expect(Array.isArray(Result)).toBe(true);
			expect(Result[0]).toBe('safe');
			expect(Result[1]).not.toContain('javascript:');
		});

		it('should handle objects', () => {
			const input = { link: 'javascript:alert(1)', text: 'safe' };
			const Result = SanitizeXss(input) as Record<string, string>;
			expect(Result.text).toBe('safe');
			expect(Result.link).not.toContain('javascript:');
		});

		it('should handle nested objects', () => {
			const input = { config: { script: 'javascript:alert(1)' } };
			const Result = SanitizeXss(input) as Record<string, Record<string, string>>;
			expect(Result.config.script).not.toContain('javascript:');
		});

		it('should return null as-is', () => {
			expect(SanitizeXss(null)).toBeNull();
		});

		it('should return undefined as-is', () => {
			expect(SanitizeXss(undefined)).toBeUndefined();
		});

		it('should return numbers as-is', () => {
			expect(SanitizeXss(42)).toBe(42);
		});

		it('should return booleans as-is', () => {
			expect(SanitizeXss(true)).toBe(true);
			expect(SanitizeXss(false)).toBe(false);
		});

		it('should handle case-insensitive protocols', () => {
			const inputs = ['JavaScript:alert(1)', 'JAVASCRIPT:alert(1)', 'VBScript:alert(1)'];
			for (const input of inputs) {
				const Result = SanitizeXss(input) as string;
				expect(Result.toLowerCase()).not.toContain('javascript:');
				expect(Result.toLowerCase()).not.toContain('vbscript:');
			}
		});

		it('should preserve URLs', () => {
			const input = 'Visit https://example.com for more Info()';
			const Result = SanitizeXss(input);
			expect(Result).toContain('https://');
			expect(Result).toContain('example.com');
		});

		it('should handle empty strings', () => {
			expect(SanitizeXss('')).toBe('');
		});

		it('should handle very long strings', () => {
			const input = 'a'.repeat(10000) + 'javascript:alert(1)';
			const Result = SanitizeXss(input);
			expect(Result).not.toContain('javascript:');
		});
	});
});
