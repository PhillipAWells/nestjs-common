import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../retry.js';
import { TimeoutError, RateLimitError, NetworkError } from '../../errors/index.js';

describe('withRetry', () => {
	it('returns result when function succeeds on first call', async () => {
		const fn = vi.fn().mockResolvedValue('success');
		const result = await withRetry(fn);
		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('does not retry on non-retryable errors', async () => {
		const error = new Error('non-retryable');
		const fn = vi.fn().mockRejectedValue(error);

		await expect(withRetry(fn, { maxRetries: 0 })).rejects.toBe(error);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('retries on TimeoutError', async () => {
		const error = new TimeoutError('timeout');
		const fn = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValueOnce('success');

		const result = await withRetry(fn, { maxRetries: 1, initialDelay: 0, maxDelay: 0 });
		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('retries on RateLimitError', async () => {
		const error = new RateLimitError('rate limit');
		const fn = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValueOnce('success');

		const result = await withRetry(fn, { maxRetries: 1, initialDelay: 0, maxDelay: 0 });
		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('retries on NetworkError', async () => {
		const error = new NetworkError('network error');
		const fn = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValueOnce('success');

		const result = await withRetry(fn, { maxRetries: 1, initialDelay: 0, maxDelay: 0 });
		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('retries on error with retryable statusCode', async () => {
		const error = { statusCode: 408, message: 'timeout' };
		const fn = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValueOnce('success');

		const result = await withRetry(fn, { maxRetries: 1, initialDelay: 0, maxDelay: 0 });
		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('retries on 429 status code', async () => {
		const error = { statusCode: 429, message: 'rate limit' };
		const fn = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValueOnce('success');

		const result = await withRetry(fn, { maxRetries: 1, initialDelay: 0, maxDelay: 0 });
		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('retries on 500 status code', async () => {
		const error = { statusCode: 500, message: 'server error' };
		const fn = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValueOnce('success');

		const result = await withRetry(fn, { maxRetries: 1, initialDelay: 0, maxDelay: 0 });
		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('retries on 502 status code', async () => {
		const error = { statusCode: 502, message: 'bad gateway' };
		const fn = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValueOnce('success');

		const result = await withRetry(fn, { maxRetries: 1, initialDelay: 0, maxDelay: 0 });
		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('retries on 503 status code', async () => {
		const error = { statusCode: 503, message: 'service unavailable' };
		const fn = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValueOnce('success');

		const result = await withRetry(fn, { maxRetries: 1, initialDelay: 0, maxDelay: 0 });
		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('retries on 504 status code', async () => {
		const error = { statusCode: 504, message: 'gateway timeout' };
		const fn = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValueOnce('success');

		const result = await withRetry(fn, { maxRetries: 1, initialDelay: 0, maxDelay: 0 });
		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('does not retry on 400 status code', async () => {
		const error = { statusCode: 400, message: 'bad request' };
		const fn = vi.fn().mockRejectedValue(error);

		await expect(withRetry(fn, { maxRetries: 3 })).rejects.toEqual(error);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('does not retry on 401 status code', async () => {
		const error = { statusCode: 401, message: 'unauthorized' };
		const fn = vi.fn().mockRejectedValue(error);

		await expect(withRetry(fn, { maxRetries: 3 })).rejects.toEqual(error);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('does not retry on 403 status code', async () => {
		const error = { statusCode: 403, message: 'forbidden' };
		const fn = vi.fn().mockRejectedValue(error);

		await expect(withRetry(fn, { maxRetries: 3 })).rejects.toEqual(error);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('does not retry on 404 status code', async () => {
		const error = { statusCode: 404, message: 'not found' };
		const fn = vi.fn().mockRejectedValue(error);

		await expect(withRetry(fn, { maxRetries: 3 })).rejects.toEqual(error);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('does not retry on 409 status code', async () => {
		const error = { statusCode: 409, message: 'conflict' };
		const fn = vi.fn().mockRejectedValue(error);

		await expect(withRetry(fn, { maxRetries: 3 })).rejects.toEqual(error);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('throws after exhausting maxRetries', async () => {
		const error = new TimeoutError('timeout');
		const fn = vi.fn().mockRejectedValue(error);

		await expect(withRetry(fn, { maxRetries: 2, initialDelay: 0, maxDelay: 0 })).rejects.toBe(
			error,
		);
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it('respects maxRetries configuration', async () => {
		const error = new TimeoutError('timeout');
		const fn = vi.fn().mockRejectedValue(error);

		await expect(withRetry(fn, { maxRetries: 1, initialDelay: 0, maxDelay: 0 })).rejects.toBe(
			error,
		);
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('does not retry when maxRetries is 0', async () => {
		const error = new TimeoutError('timeout');
		const fn = vi.fn().mockRejectedValue(error);

		await expect(withRetry(fn, { maxRetries: 0 })).rejects.toBe(error);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('uses custom retryableStatuses', async () => {
		const error = { statusCode: 400, message: 'bad request' };
		const fn = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockResolvedValueOnce('success');

		const result = await withRetry(fn, {
			maxRetries: 3,
			initialDelay: 0,
			maxDelay: 0,
			retryableStatuses: [400],
		});
		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('uses default config when undefined', async () => {
		const fn = vi.fn().mockResolvedValue('success');
		const result = await withRetry(fn);
		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('uses default config when empty object', async () => {
		const fn = vi.fn().mockResolvedValue('success');
		const result = await withRetry(fn, {});
		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('wraps non-Error objects as Error', async () => {
		const fn = vi.fn().mockRejectedValue('string error');

		await expect(withRetry(fn, { maxRetries: 0 })).rejects.toBeInstanceOf(Error);
	});

	it('multiple retries succeed eventually', async () => {
		const error = new TimeoutError('timeout');
		const fn = vi
			.fn()
			.mockRejectedValueOnce(error)
			.mockRejectedValueOnce(error)
			.mockResolvedValueOnce('success');

		const result = await withRetry(fn, {
			maxRetries: 3,
			initialDelay: 0,
			maxDelay: 0,
		});
		expect(result).toBe('success');
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it('respects custom retryable statuses over defaults', async () => {
		const error500 = { statusCode: 500, message: 'server error' };
		const fn = vi.fn().mockRejectedValue(error500);

		// When we override retryableStatuses with an empty array, 500 is not retryable
		await expect(
			withRetry(fn, {
				maxRetries: 2,
				retryableStatuses: [],
			}),
		).rejects.toEqual(error500);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('handles mixed retryable and non-retryable errors', async () => {
		const retryableError = new TimeoutError('timeout');
		const nonRetryableError = new Error('fatal error');
		const fn = vi
			.fn()
			.mockRejectedValueOnce(retryableError)
			.mockRejectedValueOnce(nonRetryableError);

		await expect(
			withRetry(fn, { maxRetries: 5, initialDelay: 0, maxDelay: 0 }),
		).rejects.toBe(nonRetryableError);
		expect(fn).toHaveBeenCalledTimes(2);
	});
});
