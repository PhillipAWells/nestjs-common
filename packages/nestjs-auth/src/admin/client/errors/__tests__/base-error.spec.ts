import { describe, it, expect } from 'vitest';
import {
	KeycloakClientError,
	AuthenticationError,
	AuthorizationError,
	NotFoundError,
	ValidationError,
	RateLimitError,
	TimeoutError,
	NetworkError,
	ConflictError,
} from '../base-error.js';

describe('KeycloakClientError', () => {
	it('is an instance of Error', () => {
		const error = new KeycloakClientError('test message');
		expect(error).toBeInstanceOf(Error);
	});

	it('has the correct name', () => {
		const error = new KeycloakClientError('test message');
		expect(error.name).toBe('KeycloakClientError');
	});

	it('preserves the message', () => {
		const error = new KeycloakClientError('test message');
		expect(error.message).toBe('test message');
	});

	it('sets statusCode when provided', () => {
		const error = new KeycloakClientError('test message', 500);
		expect(error.statusCode).toBe(500);
	});

	it('sets response when provided', () => {
		const response = { error: 'some error' };
		const error = new KeycloakClientError('test message', 500, response);
		expect(error.response).toBe(response);
	});

	it('sets cause when provided', () => {
		const cause = new Error('cause error');
		const error = new KeycloakClientError('test message', 500, undefined, cause);
		expect(error.cause).toBe(cause);
	});

	it('captures stack trace', () => {
		const error = new KeycloakClientError('test message');
		expect(error.stack).toBeDefined();
		expect(error.stack).toContain('KeycloakClientError');
	});
});

describe('AuthenticationError', () => {
	it('is an instance of KeycloakClientError', () => {
		const error = new AuthenticationError('test message');
		expect(error).toBeInstanceOf(KeycloakClientError);
	});

	it('is an instance of Error', () => {
		const error = new AuthenticationError('test message');
		expect(error).toBeInstanceOf(Error);
	});

	it('has the correct name', () => {
		const error = new AuthenticationError('test message');
		expect(error.name).toBe('AuthenticationError');
	});

	it('preserves the message', () => {
		const error = new AuthenticationError('auth failed');
		expect(error.message).toBe('auth failed');
	});

	it('sets statusCode when provided', () => {
		const error = new AuthenticationError('auth failed', 401);
		expect(error.statusCode).toBe(401);
	});

	it('sets response when provided', () => {
		const response = { error: 'invalid credentials' };
		const error = new AuthenticationError('auth failed', 401, response);
		expect(error.response).toBe(response);
	});
});

describe('AuthorizationError', () => {
	it('is an instance of KeycloakClientError', () => {
		const error = new AuthorizationError('test message');
		expect(error).toBeInstanceOf(KeycloakClientError);
	});

	it('is an instance of Error', () => {
		const error = new AuthorizationError('test message');
		expect(error).toBeInstanceOf(Error);
	});

	it('has the correct name', () => {
		const error = new AuthorizationError('test message');
		expect(error.name).toBe('AuthorizationError');
	});

	it('preserves the message', () => {
		const error = new AuthorizationError('not authorized');
		expect(error.message).toBe('not authorized');
	});

	it('sets statusCode when provided', () => {
		const error = new AuthorizationError('not authorized', 403);
		expect(error.statusCode).toBe(403);
	});

	it('sets response when provided', () => {
		const response = { error: 'insufficient permissions' };
		const error = new AuthorizationError('not authorized', 403, response);
		expect(error.response).toBe(response);
	});
});

describe('NotFoundError', () => {
	it('is an instance of KeycloakClientError', () => {
		const error = new NotFoundError('test message');
		expect(error).toBeInstanceOf(KeycloakClientError);
	});

	it('is an instance of Error', () => {
		const error = new NotFoundError('test message');
		expect(error).toBeInstanceOf(Error);
	});

	it('has the correct name', () => {
		const error = new NotFoundError('test message');
		expect(error.name).toBe('NotFoundError');
	});

	it('preserves the message', () => {
		const error = new NotFoundError('resource not found');
		expect(error.message).toBe('resource not found');
	});

	it('always sets statusCode to 404', () => {
		const error = new NotFoundError('resource not found');
		expect(error.statusCode).toBe(404);
	});

	it('sets response when provided', () => {
		const response = { error: 'not found' };
		const error = new NotFoundError('resource not found', response);
		expect(error.response).toBe(response);
	});
});

describe('ValidationError', () => {
	it('is an instance of KeycloakClientError', () => {
		const error = new ValidationError('test message');
		expect(error).toBeInstanceOf(KeycloakClientError);
	});

	it('is an instance of Error', () => {
		const error = new ValidationError('test message');
		expect(error).toBeInstanceOf(Error);
	});

	it('has the correct name', () => {
		const error = new ValidationError('test message');
		expect(error.name).toBe('ValidationError');
	});

	it('preserves the message', () => {
		const error = new ValidationError('invalid data');
		expect(error.message).toBe('invalid data');
	});

	it('always sets statusCode to 400', () => {
		const error = new ValidationError('invalid data');
		expect(error.statusCode).toBe(400);
	});

	it('sets response when provided', () => {
		const response = { error: 'validation failed' };
		const error = new ValidationError('invalid data', response);
		expect(error.response).toBe(response);
	});
});

describe('RateLimitError', () => {
	it('is an instance of KeycloakClientError', () => {
		const error = new RateLimitError('test message');
		expect(error).toBeInstanceOf(KeycloakClientError);
	});

	it('is an instance of Error', () => {
		const error = new RateLimitError('test message');
		expect(error).toBeInstanceOf(Error);
	});

	it('has the correct name', () => {
		const error = new RateLimitError('test message');
		expect(error.name).toBe('RateLimitError');
	});

	it('preserves the message', () => {
		const error = new RateLimitError('too many requests');
		expect(error.message).toBe('too many requests');
	});

	it('always sets statusCode to 429', () => {
		const error = new RateLimitError('too many requests');
		expect(error.statusCode).toBe(429);
	});

	it('sets response when provided', () => {
		const response = { error: 'rate limited' };
		const error = new RateLimitError('too many requests', response);
		expect(error.response).toBe(response);
	});
});

describe('TimeoutError', () => {
	it('is an instance of KeycloakClientError', () => {
		const error = new TimeoutError('test message');
		expect(error).toBeInstanceOf(KeycloakClientError);
	});

	it('is an instance of Error', () => {
		const error = new TimeoutError('test message');
		expect(error).toBeInstanceOf(Error);
	});

	it('has the correct name', () => {
		const error = new TimeoutError('test message');
		expect(error.name).toBe('TimeoutError');
	});

	it('preserves the message', () => {
		const error = new TimeoutError('request timeout');
		expect(error.message).toBe('request timeout');
	});

	it('always sets statusCode to 408', () => {
		const error = new TimeoutError('request timeout');
		expect(error.statusCode).toBe(408);
	});

	it('does not set response', () => {
		const error = new TimeoutError('request timeout');
		expect(error.response).toBeUndefined();
	});
});

describe('NetworkError', () => {
	it('is an instance of KeycloakClientError', () => {
		const error = new NetworkError('test message');
		expect(error).toBeInstanceOf(KeycloakClientError);
	});

	it('is an instance of Error', () => {
		const error = new NetworkError('test message');
		expect(error).toBeInstanceOf(Error);
	});

	it('has the correct name', () => {
		const error = new NetworkError('test message');
		expect(error.name).toBe('NetworkError');
	});

	it('preserves the message', () => {
		const error = new NetworkError('connection refused');
		expect(error.message).toBe('connection refused');
	});

	it('sets statusCode to 500 by default', () => {
		const error = new NetworkError('connection refused');
		expect(error.statusCode).toBe(500);
	});

	it('sets cause when provided', () => {
		const cause = new Error('underlying error');
		const error = new NetworkError('connection refused', cause);
		expect(error.cause).toBe(cause);
	});

	it('does not set response', () => {
		const error = new NetworkError('connection refused');
		expect(error.response).toBeUndefined();
	});
});

describe('ConflictError', () => {
	it('is an instance of KeycloakClientError', () => {
		const error = new ConflictError('test message');
		expect(error).toBeInstanceOf(KeycloakClientError);
	});

	it('is an instance of Error', () => {
		const error = new ConflictError('test message');
		expect(error).toBeInstanceOf(Error);
	});

	it('has the correct name', () => {
		const error = new ConflictError('test message');
		expect(error.name).toBe('ConflictError');
	});

	it('preserves the message', () => {
		const error = new ConflictError('conflict detected');
		expect(error.message).toBe('conflict detected');
	});

	it('always sets statusCode to 409', () => {
		const error = new ConflictError('conflict detected');
		expect(error.statusCode).toBe(409);
	});

	it('sets response when provided', () => {
		const response = { error: 'conflict' };
		const error = new ConflictError('conflict detected', response);
		expect(error.response).toBe(response);
	});
});
