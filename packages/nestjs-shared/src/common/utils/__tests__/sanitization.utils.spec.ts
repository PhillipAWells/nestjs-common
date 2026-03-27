import { describe, it, expect, vi } from 'vitest';
import { sanitizeObject, sanitizeXss } from '../sanitization.utils.js';
import { Logger } from '@nestjs/common';

describe('Sanitization Utils - Simplified Coverage', () => {
	describe('sanitizeObject', () => {
		it('should sanitize $ prefix keys', () => {
			const obj = { $where: 'bad', $ne: 'bad' };
			const result = sanitizeObject(obj);
			expect(result).toHaveProperty('_where');
			expect(result).toHaveProperty('_ne');
		});

		it('should sanitize eval pattern', () => {
			const obj = { eval: 'bad' };
			const result = sanitizeObject(obj);
			expect(Object.keys(result)[0]).not.toBe('eval');
		});

		it('should sanitize constructor pattern', () => {
			const obj = { constructor: 'bad' };
			const result = sanitizeObject(obj);
			expect(Object.keys(result)[0]).not.toBe('constructor');
		});

		it('should sanitize function pattern', () => {
			const obj = { functionName: 'bad' };
			const result = sanitizeObject(obj);
			expect(Object.keys(result)[0]).not.toBe('functionName');
		});

		it('should sanitize prototype pattern', () => {
			const obj = { prototype: 'bad' };
			const result = sanitizeObject(obj);
			expect(Object.keys(result)[0]).not.toBe('prototype');
		});

		it('should handle nested objects', () => {
			const obj = { user: { $where: 'bad' } };
			const result = sanitizeObject(obj);
			expect(result.user).toHaveProperty('_where');
		});

		it('should handle arrays', () => {
			const obj = { items: [{ $where: 'bad' }] };
			const result = sanitizeObject(obj);
			expect(result.items[0]).toHaveProperty('_where');
		});

		it('should preserve string values', () => {
			const obj = { email: 'user@example.com' };
			const result = sanitizeObject(obj);
			expect(result.email).toBe('user@example.com');
		});

		it('should return null as-is', () => {
			expect(sanitizeObject(null)).toBeNull();
		});

		it('should return undefined as-is', () => {
			expect(sanitizeObject(undefined)).toBeUndefined();
		});

		it('should throw error at max depth', () => {
			const logger = new Logger('test');
			const logSpy = vi.spyOn(logger, 'error');
			expect(() => {
				sanitizeObject({ nested: { deep: {} } }, 20, logger);
			}).toThrow('Input object exceeds maximum sanitization depth of 20. Deeply nested objects may be malicious.');
			expect(logSpy).toHaveBeenCalled();
		});

		it('should handle empty objects', () => {
			expect(sanitizeObject({})).toEqual({});
		});

		it('should handle empty arrays', () => {
			expect(sanitizeObject([])).toEqual([]);
		});

		it('should preserve numbers', () => {
			const obj = { count: 42, price: 19.99 };
			const result = sanitizeObject(obj);
			expect(result.count).toBe(42);
			expect(result.price).toBe(19.99);
		});

		it('should preserve booleans', () => {
			const obj = { enabled: true, disabled: false };
			const result = sanitizeObject(obj);
			expect(result.enabled).toBe(true);
			expect(result.disabled).toBe(false);
		});

		it('should be case-insensitive for patterns', () => {
			const obj = { EVAL: 'bad', Eval: 'bad' };
			const result = sanitizeObject(obj);
			Object.keys(result).forEach(k => {
				expect(k).not.toBe('EVAL');
				expect(k).not.toBe('Eval');
			});
		});

		it('should sanitize nested $where key in deeply nested object', () => {
			const obj = { user: { $where: 'malicious' } };
			const result = sanitizeObject(obj);
			expect(result.user).toHaveProperty('_where');
			expect(result.user._where).toBe('malicious');
			expect(result.user).not.toHaveProperty('$where');
		});

		it('should throw error when depth limit (20) is exceeded', () => {
			// Create an object that would exceed the depth limit
			// Starting from depth 20, the next level should trigger the error
			const logger = new Logger('test');
			const logSpy = vi.spyOn(logger, 'error');

			// Call with depth=20 (at the limit)
			expect(() => {
				sanitizeObject({ nested: true }, 20, logger);
			}).toThrow('Input object exceeds maximum sanitization depth of 20. Deeply nested objects may be malicious.');

			expect(logSpy).toHaveBeenCalled();
		});
	});

	describe('sanitizeXss', () => {
		it('should remove javascript: protocol', () => {
			const input = 'javascript:void(0)';
			const result = sanitizeXss(input);
			expect(result).not.toContain('javascript:');
		});

		it('should remove vbscript: protocol', () => {
			const input = 'vbscript:alert(1)';
			const result = sanitizeXss(input);
			expect(result).not.toContain('vbscript:');
		});

		it('should preserve clean strings', () => {
			const input = 'This is clean';
			const result = sanitizeXss(input);
			expect(result).toContain('clean');
		});

		it('should handle array of strings', () => {
			const input = ['safe', 'javascript:alert(1)'];
			const result = sanitizeXss(input) as string[];
			expect(Array.isArray(result)).toBe(true);
			expect(result[0]).toBe('safe');
			expect(result[1]).not.toContain('javascript:');
		});

		it('should handle objects', () => {
			const input = { link: 'javascript:alert(1)', text: 'safe' };
			const result = sanitizeXss(input) as Record<string, string>;
			expect(result.text).toBe('safe');
			expect(result.link).not.toContain('javascript:');
		});

		it('should handle nested objects', () => {
			const input = { config: { script: 'javascript:alert(1)' } };
			const result = sanitizeXss(input) as Record<string, Record<string, string>>;
			expect(result.config.script).not.toContain('javascript:');
		});

		it('should return null as-is', () => {
			expect(sanitizeXss(null)).toBeNull();
		});

		it('should return undefined as-is', () => {
			expect(sanitizeXss(undefined)).toBeUndefined();
		});

		it('should return numbers as-is', () => {
			expect(sanitizeXss(42)).toBe(42);
		});

		it('should return booleans as-is', () => {
			expect(sanitizeXss(true)).toBe(true);
			expect(sanitizeXss(false)).toBe(false);
		});

		it('should handle case-insensitive protocols', () => {
			const inputs = ['JavaScript:alert(1)', 'JAVASCRIPT:alert(1)', 'VBScript:alert(1)'];
			for (const input of inputs) {
				const result = sanitizeXss(input) as string;
				expect(result.toLowerCase()).not.toContain('javascript:');
				expect(result.toLowerCase()).not.toContain('vbscript:');
			}
		});

		it('should preserve URLs', () => {
			const input = 'Visit https://example.com for more info';
			const result = sanitizeXss(input);
			expect(result).toContain('https://');
			expect(result).toContain('example.com');
		});

		it('should handle empty strings', () => {
			expect(sanitizeXss('')).toBe('');
		});

		it('should handle very long strings', () => {
			const input = 'a'.repeat(10000) + 'javascript:alert(1)';
			const result = sanitizeXss(input);
			expect(result).not.toContain('javascript:');
		});
	});
});
