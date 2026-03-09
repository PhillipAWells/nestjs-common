import { CreateRequestPropertyDecorator } from './decorator-factory.js';

/**
 * Extract query parameters from request
 * @param key - Specific query parameter key (optional - extracts all if not specified)
 * @returns Parameter decorator
 *
 * @example
 * // Extract all query parameters
 * getData(@Query() query: any) {}
 *
 * @example
 * // Extract specific query parameter
 * getData(@Query('limit') limit: number) {}
 */
export function Query(key?: string): ParameterDecorator {
	return CreateRequestPropertyDecorator(
		(request) => (key ? request.query[key] : request.query),
	);
}

/**
 * Extract route parameters from request
 * @param key - Specific route parameter key (optional - extracts all if not specified)
 * @returns Parameter decorator
 *
 * @example
 * // Extract all route parameters
 * getUser(@Params() params: any) {}
 *
 * @example
 * // Extract specific route parameter
 * getUser(@Params('id') id: string) {}
 */
export function Params(key?: string): ParameterDecorator {
	return CreateRequestPropertyDecorator(
		(request) => (key ? request.params[key] : request.params),
	);
}

/**
 * Extract request body
 * @param key - Specific body property key (optional - extracts all if not specified)
 * @returns Parameter decorator
 *
 * @example
 * // Extract entire body
 * createUser(@Body() userData: CreateUserDto) {}
 *
 * @example
 * // Extract specific body property
 * updateUser(@Body('email') email: string) {}
 */
export function Body(key?: string): ParameterDecorator {
	return CreateRequestPropertyDecorator(
		(request) => (key ? request.body[key] : request.body),
	);
}

/**
 * Extract request headers
 * @param key - Specific header key (optional - extracts all if not specified)
 * @returns Parameter decorator
 *
 * @example
 * // Extract all headers
 * getData(@Headers() headers: any) {}
 *
 * @example
 * // Extract specific header
 * getData(@Headers('authorization') auth: string) {}
 */
export function Headers(key?: string): ParameterDecorator {
	return CreateRequestPropertyDecorator(
		(request) => (key ? request.headers[key] : request.headers),
	);
}

/**
 * Extract cookies from request
 * @param key - Specific cookie key (optional - extracts all if not specified)
 * @returns Parameter decorator
 *
 * @example
 * // Extract all cookies
 * getData(@Cookies() cookies: any) {}
 *
 * @example
 * // Extract specific cookie
 * getData(@Cookies('sessionId') sessionId: string) {}
 */
export function Cookies(key?: string): ParameterDecorator {
	return CreateRequestPropertyDecorator(
		(request) => (key ? request.cookies[key] : request.cookies),
	);
}
