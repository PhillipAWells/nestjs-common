import { CreateRequestPropertyDecorator } from './decorator-factory.js';

/**
 * Extract query parameters from HTTP request.
 * @param key - Specific query parameter key (optional - extracts all if not specified)
 * @returns Parameter decorator
 *
 * @example
 * ```typescript
 * // Extract all query parameters
 * @Get()
 * getData(@Query() query: any) {}
 *
 * // Extract specific query parameter
 * @Get()
 * getData(@Query('limit') limit: number) {}
 * ```
 */
export function Query(key?: string): ParameterDecorator {
	return CreateRequestPropertyDecorator(
		(request) => (key ? request.query[key] : request.query),
	);
}

/**
 * Extract route parameters from HTTP request.
 * @param key - Specific route parameter key (optional - extracts all if not specified)
 * @returns Parameter decorator
 *
 * @example
 * ```typescript
 * // Extract all route parameters
 * @Get(':id')
 * getUser(@Params() params: any) {}
 *
 * // Extract specific route parameter
 * @Get(':id')
 * getUser(@Params('id') id: string) {}
 * ```
 */
export function Params(key?: string): ParameterDecorator {
	return CreateRequestPropertyDecorator(
		(request) => (key ? request.params[key] : request.params),
	);
}

/**
 * Extract request body from HTTP request.
 * @param key - Specific body property key (optional - extracts all if not specified)
 * @returns Parameter decorator
 *
 * @example
 * ```typescript
 * // Extract entire body
 * @Post()
 * createUser(@Body() userData: CreateUserDto) {}
 *
 * // Extract specific body property
 * @Patch(':id')
 * updateUser(@Body('email') email: string) {}
 * ```
 */
export function Body(key?: string): ParameterDecorator {
	return CreateRequestPropertyDecorator(
		(request) => (key ? request.body[key] : request.body),
	);
}

/**
 * Extract request headers from HTTP request.
 * @param key - Specific header key (optional - extracts all if not specified)
 * @returns Parameter decorator
 *
 * @remarks Header names are case-insensitive in HTTP/1.1.
 *
 * @example
 * ```typescript
 * // Extract all headers
 * @Get()
 * getData(@Headers() headers: any) {}
 *
 * // Extract specific header
 * @Get()
 * getData(@Headers('authorization') auth: string) {}
 * ```
 */
export function Headers(key?: string): ParameterDecorator {
	return CreateRequestPropertyDecorator(
		(request) => (key ? request.headers[key] : request.headers),
	);
}

/**
 * Extract cookies from HTTP request.
 * @param key - Specific cookie key (optional - extracts all if not specified)
 * @returns Parameter decorator
 *
 * @remarks Requires cookie-parser middleware to be enabled.
 *
 * @example
 * ```typescript
 * // Extract all cookies
 * @Get()
 * getData(@Cookies() cookies: any) {}
 *
 * // Extract specific cookie
 * @Get()
 * getData(@Cookies('sessionId') sessionId: string) {}
 * ```
 */
export function Cookies(key?: string): ParameterDecorator {
	return CreateRequestPropertyDecorator(
		(request) => (key ? request.cookies[key] : request.cookies),
	);
}
