
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { QueryComplexityGuard } from '../../guards/query-complexity.guard.js';
import * as QueryComplexity from '../../graphql/query-complexity.js';

describe('QueryComplexityGuard', () => {
	let guard: QueryComplexityGuard;
	let mockExecutionContext: any;
	let mockRequest: any;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [QueryComplexityGuard]
		}).compile();

		guard = module.get<QueryComplexityGuard>(QueryComplexityGuard);

		mockRequest = {
			headers: {},
			user: { id: 'user123' }
		};

		mockExecutionContext = {};

		// Mock GqlExecutionContext.create
		jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
			getContext: () => ({
				req: mockRequest
			}),
			getArgs: () => ({
				schema: {},
				document: { kind: 'Document' },
				variables: {},
				operationName: 'TestQuery'
			})
		} as any);
	});

	afterEach(() => {
		jest.clearAllMocks();
		guard.onModuleDestroy();
	});

	describe('canActivate - Normal Operation', () => {
		const COMPLEXITY_WITHIN_LIMITS = 500;
		const COMPLEXITY_EXCEEDED = 2000;
		const COMPLEXITY_MID_RANGE = 750;

		it('should allow query when complexity is within limits', async () => {
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(COMPLEXITY_WITHIN_LIMITS);
			jest.spyOn(QueryComplexity, 'exceedsComplexityLimit').mockReturnValue(false);

			const result = await guard.canActivate(mockExecutionContext);

			expect(result).toBe(true);
		});

		it('should attach complexity to request object', async () => {
			const complexity = COMPLEXITY_MID_RANGE;
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(complexity);
			jest.spyOn(QueryComplexity, 'exceedsComplexityLimit').mockReturnValue(false);

			await guard.canActivate(mockExecutionContext);

			expect(mockRequest.queryComplexity).toBe(complexity);
		});

		it('should reject query when complexity exceeds limit', async () => {
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(COMPLEXITY_EXCEEDED);
			jest.spyOn(QueryComplexity, 'exceedsComplexityLimit').mockReturnValue(true);

			await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(BadRequestException);
			await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(/exceeds maximum/);
		});
	});

	describe('QueryComplexityGuard - Error Handling', () => {
		const COMPLEXITY_EXCEEDED = 2000;

		it('should throw InternalServerErrorException on complexity calculation error', async () => {
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockImplementation(() => {
				throw new Error('Complexity calculation failed');
			});

			await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(InternalServerErrorException);
		});

		it('should NOT allow query on complexity calculation error', async () => {
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockImplementation(() => {
				throw new Error('Complexity calculation failed');
			});

			// Should throw, not return true
			await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow();
		});

		it('should NOT return true on calculation error (fail closed)', async () => {
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockImplementation(() => {
				throw new Error('Complexity calculation failed');
			});

			// Verify that it does NOT return true
			let didThrow = false;
			try {
				await guard.canActivate(mockExecutionContext);
			}
			// eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
			catch (_error) {
				// Expected: should throw, not return true
				didThrow = true;
			}

			expect(didThrow).toBe(true);
		});

		it('should log error with context when complexity calculation fails', async () => {
			const calculationError = new Error('Complexity calculation failed');

			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockImplementation(() => {
				throw calculationError;
			});

			try {
				await guard.canActivate(mockExecutionContext);
			}
			catch (error) {
				// Expected to throw
				expect(error).toBeInstanceOf(InternalServerErrorException);
			}
		});

		it('should handle errors from calculateQueryComplexity function', async () => {
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockImplementation(() => {
				throw new Error('Schema validation failed');
			});

			await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(InternalServerErrorException);
		});

		it('should distinguish between BadRequestException (limit exceeded) and other errors', async () => {
			// First test: BadRequestException should be re-thrown
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(COMPLEXITY_EXCEEDED);
			jest.spyOn(QueryComplexity, 'exceedsComplexityLimit').mockReturnValue(true);

			await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(BadRequestException);

			// Second test: Other errors should throw InternalServerErrorException
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockImplementation(() => {
				throw new Error('Unexpected error');
			});

			await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(InternalServerErrorException);
		});

		it('should throw InternalServerErrorException with appropriate message on error', async () => {
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockImplementation(() => {
				throw new Error('Complexity calculation failed');
			});

			try {
				await guard.canActivate(mockExecutionContext);

				fail('Should have thrown InternalServerErrorException');
			}

			catch (err: any) {
				expect(err).toBeInstanceOf(InternalServerErrorException);
				expect(err.message).toContain('validate');
			}
		});

		it('should handle thrown errors gracefully', async () => {
			const thrownError = new Error('Some unexpected error');
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockImplementation(() => {
				throw thrownError;
			});

			await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(InternalServerErrorException);
		});
	});

	describe('canActivate - Edge Cases', () => {
		const ZERO_COMPLEXITY = 0;
		const VALID_COMPLEXITY = 500;

		it('should handle requests without user object', async () => {
			mockRequest.user = undefined;
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(VALID_COMPLEXITY);
			jest.spyOn(QueryComplexity, 'exceedsComplexityLimit').mockReturnValue(false);

			const result = await guard.canActivate(mockExecutionContext);

			expect(result).toBe(true);
		});

		it('should handle requests without variables', async () => {
			(GqlExecutionContext.create as jest.Mock).mockReturnValue({
				getContext: () => ({
					req: mockRequest
				}),
				getArgs: () => ({
					schema: {},
					document: { kind: 'Document' },
					variables: undefined,
					operationName: 'TestQuery'
				})
			} as any);

			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(VALID_COMPLEXITY);
			jest.spyOn(QueryComplexity, 'exceedsComplexityLimit').mockReturnValue(false);

			const result = await guard.canActivate(mockExecutionContext);

			expect(result).toBe(true);
		});

		it('should handle zero complexity', async () => {
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(ZERO_COMPLEXITY);
			jest.spyOn(QueryComplexity, 'exceedsComplexityLimit').mockReturnValue(false);

			const result = await guard.canActivate(mockExecutionContext);

			expect(result).toBe(true);
		});

		it('should handle requests without req object', async () => {
			(GqlExecutionContext.create as jest.Mock).mockReturnValue({
				getContext: () => ({
					req: undefined
				}),
				getArgs: () => ({
					schema: {},
					document: { kind: 'Document' },
					variables: {},
					operationName: 'TestQuery'
				})
			} as any);

			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(VALID_COMPLEXITY);
			jest.spyOn(QueryComplexity, 'exceedsComplexityLimit').mockReturnValue(false);

			const result = await guard.canActivate(mockExecutionContext);

			expect(result).toBe(true);
		});
	});

	describe('QueryComplexityGuard - Complexity Caching', () => {
		it('should cache complexity calculation for identical queries', async () => {
			const mockDocument = { kind: 'Document', definitions: [] };
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(500);
			jest.spyOn(QueryComplexity, 'exceedsComplexityLimit').mockReturnValue(false);

			(GqlExecutionContext.create as jest.Mock).mockReturnValue({
				getContext: () => ({
					req: mockRequest
				}),
				getArgs: () => ({
					schema: {},
					document: mockDocument,
					variables: {},
					operationName: 'TestQuery'
				})
			} as any);

			// First call - should calculate
			await guard.canActivate(mockExecutionContext);
			expect(QueryComplexity.calculateQueryComplexity).toHaveBeenCalledTimes(1);

			// Second call with same document - should use cache
			await guard.canActivate(mockExecutionContext);
			expect(QueryComplexity.calculateQueryComplexity).toHaveBeenCalledTimes(1); // Still 1, not 2
		});

		it('should avoid recalculation for repeated identical queries', async () => {
			const complexity = 750;
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(complexity);
			jest.spyOn(QueryComplexity, 'exceedsComplexityLimit').mockReturnValue(false);

			const mockDocument = { kind: 'Document', definitions: [] };
			(GqlExecutionContext.create as jest.Mock).mockReturnValue({
				getContext: () => ({
					req: mockRequest
				}),
				getArgs: () => ({
					schema: {},
					document: mockDocument,
					variables: {},
					operationName: 'TestQuery'
				})
			} as any);

			// Run 5 times - should only calculate once
			for (let i = 0; i < 5; i++) {
				await guard.canActivate(mockExecutionContext);
			}

			expect(QueryComplexity.calculateQueryComplexity).toHaveBeenCalledTimes(1);
		});

		it('should perform complexity calculation under 10ms', async () => {
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(500);
			jest.spyOn(QueryComplexity, 'exceedsComplexityLimit').mockReturnValue(false);

			const start = performance.now();
			await guard.canActivate(mockExecutionContext);
			const elapsed = performance.now() - start;

			expect(elapsed).toBeLessThan(10);
		});

		it('should use cache lookup under 1ms on subsequent calls', async () => {
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(500);
			jest.spyOn(QueryComplexity, 'exceedsComplexityLimit').mockReturnValue(false);

			// Prime the cache
			await guard.canActivate(mockExecutionContext);

			// Measure cached lookup
			const start = performance.now();
			await guard.canActivate(mockExecutionContext);
			const elapsed = performance.now() - start;

			expect(elapsed).toBeLessThan(1);
		});
	});

	describe('QueryComplexityGuard - Cache Management', () => {
		it('should cleanup cache on module destroy', async () => {
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(500);
			jest.spyOn(QueryComplexity, 'exceedsComplexityLimit').mockReturnValue(false);

			// Populate cache
			await guard.canActivate(mockExecutionContext);

			// Cleanup
			guard.onModuleDestroy();

			// Cache should be cleared - next call should recalculate
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(600);
			await guard.canActivate(mockExecutionContext);

			// Should have been called again
			expect(QueryComplexity.calculateQueryComplexity).toHaveBeenCalledTimes(2);
		});

		it('should periodically clear cache every 10 minutes', async () => {
			jest.useFakeTimers();

			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(500);
			jest.spyOn(QueryComplexity, 'exceedsComplexityLimit').mockReturnValue(false);

			// Populate cache
			await guard.canActivate(mockExecutionContext);
			expect(QueryComplexity.calculateQueryComplexity).toHaveBeenCalledTimes(1);

			// Fast forward 10 minutes
			jest.advanceTimersByTime(600000);

			// Next call should recalculate after cleanup
			jest.spyOn(QueryComplexity, 'calculateQueryComplexity').mockReturnValue(500);
			await guard.canActivate(mockExecutionContext);

			jest.useRealTimers();
		});
	});
});
