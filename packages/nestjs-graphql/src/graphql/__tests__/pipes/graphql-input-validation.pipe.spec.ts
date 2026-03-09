
import { BadRequestException } from '@nestjs/common';
import { GraphQLInputValidationPipe } from '../../pipes/graphql-input-validation.pipe.js';
import { IsString, IsEmail, MinLength } from 'class-validator';

// Mock input classes for testing
class MockLoginInput {
	@IsEmail()
	public email!: string;

	@IsString()
	@MinLength(8)
	public password!: string;
}

class MockUserInput {
	@IsString()
	public name!: string;

	@IsEmail()
	public email!: string;
}

describe('GraphQLInputValidationPipe - Security Validation', () => {
	let pipe: GraphQLInputValidationPipe;

	beforeEach(() => {
		pipe = new GraphQLInputValidationPipe();
	});

	describe('Input size validation', () => {
		it('should reject input exceeding maximum size', async () => {
			const largeInput = {
				data: 'a'.repeat(101_000), // Exceeds 100KB limit
			};

			await expect(
				pipe.transform(largeInput, {
					metatype: MockUserInput,
					type: 'body',
					data: undefined,
				}),
			).rejects.toThrow(BadRequestException);
		});

		it('should accept input within size limits', async () => {
			const validInput = {
				name: 'John Doe',
				email: 'john@example.com',
			};

			const result = await pipe.transform(validInput, {
				metatype: MockUserInput,
				type: 'body',
				data: undefined,
			});

			expect(result).toBeDefined();
			expect(result.name).toBe('John Doe');
		});
	});

	describe('SQL injection detection', () => {
		it('should reject input with SQL comment pattern', async () => {
			const injectionInput = {
				email: 'test@example.com',
				password: 'admin\' --',
			};

			await expect(
				pipe.transform(injectionInput, {
					metatype: MockLoginInput,
					type: 'body',
					data: undefined,
				}),
			).rejects.toThrow(BadRequestException);
		});

		it('should reject input with multiple consecutive special characters', async () => {
			const injectionInput = {
				email: 'test@example.com',
				password: 'pass"""word',
			};

			await expect(
				pipe.transform(injectionInput, {
					metatype: MockLoginInput,
					type: 'body',
					data: undefined,
				}),
			).rejects.toThrow(BadRequestException);
		});

		it('should reject input with SQL wildcard characters', async () => {
			const injectionInputs = [
				{ email: 'test%@example.com', password: 'password123' },
				{ email: 'test*@example.com', password: 'password123' },
				{ email: 'test`@example.com', password: 'password123' },
			];

			for (const input of injectionInputs) {
				await expect(
					pipe.transform(input, {
						metatype: MockLoginInput,
						type: 'body',
						data: undefined,
					}),
				).rejects.toThrow(BadRequestException);
			}
		});

		it('should reject input with SQL Server procedures', async () => {
			const injectionInput = {
				email: 'test@example.com',
				password: 'xp_cmdshell',
			};

			await expect(
				pipe.transform(injectionInput, {
					metatype: MockLoginInput,
					type: 'body',
					data: undefined,
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('XSS/script injection detection', () => {
		it('should reject input with script tags', async () => {
			const xssInput = {
				name: '<script>alert("xss")</script>',
				email: 'test@example.com',
			};

			await expect(
				pipe.transform(xssInput, {
					metatype: MockUserInput,
					type: 'body',
					data: undefined,
				}),
			).rejects.toThrow(BadRequestException);
		});

		it('should reject input with javascript protocol', async () => {
			const xssInput = {
				name: 'test',
				email: 'javascript:alert("xss")',
			};

			await expect(
				pipe.transform(xssInput, {
					metatype: MockUserInput,
					type: 'body',
					data: undefined,
				}),
			).rejects.toThrow(BadRequestException);
		});

		it('should reject input with event handler injection', async () => {
			const xssInput = {
				name: 'test',
				email: 'test@example.com',
				extra: 'onerror="alert(1)"',
			};

			// Create a temporary class to test this
			class TestInput {
				@IsString()
				public name!: string;

				@IsEmail()
				public email!: string;

				@IsString()
				public extra!: string;
			}

			await expect(
				pipe.transform(xssInput, {
					metatype: TestInput,
					type: 'body',
					data: undefined,
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('Nested object validation', () => {
		it('should check injection patterns in nested objects', async () => {
			class NestedInput {
				@IsString()
				public name!: string;

				public profile!: { bio: string };
			}

			const nestedInjectionInput = {
				name: 'John',
				profile: {
					bio: '\'; DROP TABLE users--',
				},
			};

			await expect(
				pipe.transform(nestedInjectionInput, {
					metatype: NestedInput,
					type: 'body',
					data: undefined,
				}),
			).rejects.toThrow(BadRequestException);
		});

		it('should check injection patterns in array elements', async () => {
			const arrayInjectionInput = {
				emails: [
					'valid@example.com',
					'invalid/*@example.com',
				],
			};

			class ArrayInput {
				public emails!: string[];
			}

			await expect(
				pipe.transform(arrayInjectionInput, {
					metatype: ArrayInput,
					type: 'body',
					data: undefined,
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('Valid input handling', () => {
		it('should allow special characters in legitimate contexts', async () => {
			const validInput = {
				email: 'user+test@example.co.uk',
				password: 'P@ssw0rd!Secure',
			};

			const result = await pipe.transform(validInput, {
				metatype: MockLoginInput,
				type: 'body',
				data: undefined,
			});

			expect(result).toBeDefined();
		});

		it('should handle null and undefined values gracefully', async () => {
			const nullInput = null;

			const result = await pipe.transform(nullInput, {
				metatype: MockLoginInput,
				type: 'body',
				data: undefined,
			});

			expect(result).toBeNull();
		});

		it('should skip validation for primitive types', async () => {
			const stringValue = 'some string';

			const result = await pipe.transform(stringValue, {
				metatype: String,
				type: 'body',
				data: undefined,
			});

			expect(result).toBe(stringValue);
		});
	});

	describe('Error handling and logging', () => {
		it('should provide detailed injection error information', async () => {
			const injectionInput = {
				email: 'test@example.com',
				password: '\'; --',
			};

			const error = await pipe.transform(injectionInput, {
				metatype: MockLoginInput,
				type: 'body',
				data: undefined,
			}).catch(e => e);

			expect(error).toBeInstanceOf(BadRequestException);
			expect(error.getResponse()).toMatchObject({
				message: expect.stringContaining('Invalid characters or patterns'),
				code: 'INJECTION_DETECTED',
			});
		});

		it('should provide detailed size limit error information', async () => {
			const largeInput = {
				data: 'a'.repeat(101_000),
			};

			const error = await pipe.transform(largeInput, {
				metatype: MockUserInput,
				type: 'body',
				data: undefined,
			}).catch(e => e);

			expect(error).toBeInstanceOf(BadRequestException);
			expect(error.getResponse()).toMatchObject({
				message: expect.stringContaining('exceeds maximum'),
				code: 'INPUT_SIZE_EXCEEDED',
			});
		});
	});

	describe('Edge cases', () => {
		it('should handle empty objects', async () => {
			const emptyInput = {};

			const result = await pipe.transform(emptyInput, {
				metatype: MockUserInput,
				type: 'body',
				data: undefined,
			});

			expect(result).toBeDefined();
		});

		it('should handle Unicode characters in legitimate input', async () => {
			const unicodeInput = {
				name: 'José García',
				email: 'user@example.com',
			};

			const result = await pipe.transform(unicodeInput, {
				metatype: MockUserInput,
				type: 'body',
				data: undefined,
			});

			expect(result).toBeDefined();
		});

		it('should handle deeply nested objects with injection attempts', async () => {
			class DeepInput {
				public level1!: {
					level2: {
						level3: {
							value: string;
						};
					};
				};
			}

			const deepInjectionInput = {
				level1: {
					level2: {
						level3: {
							value: '\'; DROP TABLE--',
						},
					},
				},
			};

			await expect(
				pipe.transform(deepInjectionInput, {
					metatype: DeepInput,
					type: 'body',
					data: undefined,
				}),
			).rejects.toThrow(BadRequestException);
		});
	});
});
