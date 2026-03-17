import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as https from 'https';
import * as http from 'http';
import { LazyModuleRefService } from '../utils/lazy-getter.types.js';
import { AppLogger } from './logger.service.js';
import { getHttpClientTimeout } from '../constants/timeout.constants.js';
import { HTTP_STATUS_OK } from '../constants/http-status.constants.js';

/**
 * HTTP request options.
 */
interface HttpRequestOptions {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	url: string;
	headers?: Record<string, string>;
	data?: Record<string, unknown> | string;
	timeout?: number;
	correlationId?: string;
	/**
	 * Whether to reject unauthorized (self-signed) SSL/TLS certificates.
	 * Default: true (recommended for production)
	 *
	 * Security Warning: Setting this to false allows Man-in-the-Middle (MITM) attacks
	 * in production environments. Only use for development or testing with known certificates.
	 *
	 * @default true
	 */
	rejectUnauthorized?: boolean;
	/**
	 * Custom Certificate Authority (CA) certificate for SSL/TLS validation.
	 * Can be a PEM-encoded certificate as a string or Buffer.
	 * Useful for environments using self-signed or internal CAs.
	 *
	 * @example
	 * ```typescript
	 * const cert = fs.readFileSync('/path/to/ca.pem');
	 * await client.request({
	 *   url: 'https://internal-api.local',
	 *   ca: cert,
	 * });
	 * ```
	 */
	ca?: Buffer | string;
}

/**
 * HTTP response wrapper.
 */
interface HttpResponse<T = Record<string, unknown>> {
	data: T;
	status: number;
	statusText: string;
	headers: Record<string, string>;
	duration: number;
}

/**
 * HTTP Client Service.
 * Provides a robust HTTP client with timeout handling, SSL/TLS configuration, payload size limits,
 * and comprehensive logging with sensitive data redaction.
 *
 * Features:
 * - Configurable timeouts (default: HTTP_CLIENT_TIMEOUT)
 * - SSL/TLS certificate validation (default: strict)
 * - Custom CA certificate support for self-signed certs
 * - Payload size limit enforcement (10MB default)
 * - Automatic content-type parsing (JSON, text)
 * - Correlation ID support for request tracing
 * - Sensitive data redaction in logs (passwords, tokens, auth headers)
 * - Request/response duration tracking
 *
 * @remarks
 * - Maximum payload size: 10MB (prevents memory exhaustion from large responses)
 * - Timeout error handling with clear error messages
 * - Content-type validation before JSON parsing
 * - All sensitive headers (Authorization, Cookie, X-API-Key) redacted in logs
 * - URLs with embedded credentials are sanitized before logging
 *
 * @example
 * ```typescript
 * // Simple GET request
 * const response = await client.get('https://api.example.com/users');
 *
 * // POST with custom timeout and correlation ID
 * const response = await client.post('https://api.example.com/users',
 *   { name: 'John', email: 'john@example.com' },
 *   { timeout: 5000, correlationId: 'req-123' }
 * );
 *
 * // HTTPS with custom CA certificate
 * const cert = fs.readFileSync('/path/to/ca.pem');
 * const response = await client.get('https://internal-api.local/data', { ca: cert });
 * ```
 */
@Injectable()
export class HttpClientService implements LazyModuleRefService {
	private _contextualLogger: AppLogger | undefined;

	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	public get Logger(): AppLogger {
		if (!this._contextualLogger) {
			const baseLogger = this.Module.get(AppLogger);
			this._contextualLogger = baseLogger.createContextualLogger(HttpClientService.name);
		}
		return this._contextualLogger;
	}

	/**
	 * Makes an HTTP request. URLs with embedded credentials and sensitive headers
	 * are sanitized before logging.
	 */
	// eslint-disable-next-line @typescript-eslint/promise-function-async
	public request<T = Record<string, unknown>>(options: HttpRequestOptions): Promise<HttpResponse<T>> {
		const { method, url: requestUrl, headers, data, timeout = getHttpClientTimeout(), correlationId, rejectUnauthorized = true, ca } = options;
		const startTime = Date.now();
		const MAX_PAYLOAD_SIZE = 10_485_760; // 10MB in bytes

		const safeUrl = this.sanitizeUrl(requestUrl);

		this.Logger.debug('Making HTTP request', JSON.stringify({
			method,
			url: safeUrl,
			headers: this.sanitizeHeaders(headers),
			hasData: !!data,
			timeout,
			correlationId: correlationId ?? 'unknown',
		}));

		return new Promise((resolve, reject) => {
			const parsedUrl = new URL(requestUrl); // Use raw URL for actual request
			const isHttps = parsedUrl.protocol === 'https:';
			const client = isHttps ? https : http;

			const requestOptions: any = {
				hostname: parsedUrl.hostname,
				port: parsedUrl.port || undefined,
				path: parsedUrl.pathname + parsedUrl.search,
				method,
				headers: headers ?? {},
				timeout,
			};

			// Add SSL/TLS options for HTTPS requests
			if (isHttps) {
				requestOptions.rejectUnauthorized = rejectUnauthorized;
				if (ca) {
					requestOptions.ca = ca;
				}
			}

			const req = client.request(requestOptions, (res) => {
				const chunks: Buffer[] = [];
				let totalSize = 0;

				res.on('data', (chunk: Buffer) => {
					totalSize += chunk.length;
					if (totalSize > MAX_PAYLOAD_SIZE) {
						const duration = Date.now() - startTime;
						req.destroy();
						const error = new Error('Payload too large');
						this.Logger.error('HTTP response payload exceeded size limit', JSON.stringify({
							method,
							url: safeUrl,
							maxSize: MAX_PAYLOAD_SIZE,
							actualSize: totalSize,
							durationMs: duration,
							correlationId: correlationId ?? 'unknown',
						}));
						reject(error);
						return;
					}
					chunks.push(chunk);
				});

				res.on('error', (error) => {
					const duration = Date.now() - startTime;
					this.Logger.error('HTTP response error', JSON.stringify({
						method,
						url: safeUrl,
						error: error.message,
						durationMs: duration,
						correlationId: correlationId ?? 'unknown',
					}));
					reject(error);
				});

				res.on('end', () => {
					const duration = Date.now() - startTime;

					try {
						const body = Buffer.concat(chunks).toString('utf-8');

						// Validate payload size before parsing JSON
						if (body.length > MAX_PAYLOAD_SIZE) {
							this.Logger.error('HTTP response payload exceeded size limit', JSON.stringify({
								method,
								url: safeUrl,
								maxSize: MAX_PAYLOAD_SIZE,
								actualSize: body.length,
								durationMs: duration,
								correlationId: correlationId ?? 'unknown',
							}));
							reject(new Error('Payload too large'));
							return;
						}

						// Validate content-type before parsing JSON
						const contentType = res.headers['content-type'] ?? '';
						let parsedData: any = null;

						if (body) {
							if (contentType.includes('application/json')) {
								parsedData = JSON.parse(body);
							} else if (contentType.includes('text/')) {
								parsedData = body;
							} else {
								// For other content types, return raw body
								parsedData = body;
							}
						}

						this.Logger.info('HTTP request successful', JSON.stringify({
							method,
							url: safeUrl,
							statusCode: res.statusCode,
							durationMs: duration,
							responseSize: body.length,
							correlationId: correlationId ?? 'unknown',
						}));

						resolve({
							data: parsedData,
							status: res.statusCode ?? HTTP_STATUS_OK,
							statusText: res.statusMessage ?? 'OK',
							headers: res.headers as Record<string, string>,
							duration,
						});
					} catch (error) {
						this.Logger.error('HTTP response parsing failed', JSON.stringify({
							method,
							url: safeUrl,
							statusCode: res.statusCode,
							error: (error as Error).message,
							durationMs: duration,
							correlationId: correlationId ?? 'unknown',
						}));
						reject(error);
					}
				});
			});

			req.on('error', (error) => {
				const duration = Date.now() - startTime;
				this.Logger.error('HTTP request failed', JSON.stringify({
					method,
					url: safeUrl,
					error: error.message,
					durationMs: duration,
					correlationId: correlationId ?? 'unknown',
				}));
				reject(error);
			});

			req.on('timeout', () => {
				const duration = Date.now() - startTime;
				req.destroy();
				this.Logger.warn('HTTP request timeout', JSON.stringify({
					method,
					url: safeUrl,
					timeout,
					durationMs: duration,
					correlationId: correlationId ?? 'unknown',
				}));
				reject(new Error('Request timeout'));
			});

			if (data) {
				const bodyData = typeof data === 'string' ? data : JSON.stringify(data);
				req.write(bodyData);
			}

			req.end();
		});
	}

	// eslint-disable-next-line @typescript-eslint/promise-function-async
	public get<T = Record<string, unknown>>(url: string, options: Omit<HttpRequestOptions, 'method' | 'url'> = {}): Promise<HttpResponse<T>> {
		return this.request<T>({ ...options, method: 'GET', url });
	}

	// eslint-disable-next-line @typescript-eslint/promise-function-async
	public post<T = Record<string, unknown>>(url: string, data?: Record<string, unknown> | string, options: Omit<HttpRequestOptions, 'method' | 'url' | 'data'> = {}): Promise<HttpResponse<T>> {
		return this.request<T>({ ...options, method: 'POST', url, data });
	}

	// eslint-disable-next-line @typescript-eslint/promise-function-async
	public put<T = Record<string, unknown>>(url: string, data?: Record<string, unknown> | string, options: Omit<HttpRequestOptions, 'method' | 'url' | 'data'> = {}): Promise<HttpResponse<T>> {
		return this.request<T>({ ...options, method: 'PUT', url, data });
	}

	// eslint-disable-next-line @typescript-eslint/promise-function-async
	public delete<T = Record<string, unknown>>(url: string, options: Omit<HttpRequestOptions, 'method' | 'url'> = {}): Promise<HttpResponse<T>> {
		return this.request<T>({ ...options, method: 'DELETE', url });
	}

	/**
	 * Sanitize a URL to remove embedded credentials (e.g., https://user:pass@host/)
	 */
	private sanitizeUrl(url: string): string {
		try {
			const parsed = new URL(url);
			if (parsed.username || parsed.password) {
				parsed.username = '[REDACTED]';
				parsed.password = '[REDACTED]';
				return parsed.toString();
			}
			return url;
		} catch {
			return url;
		}
	}

	/**
	 * Redacts sensitive headers (authorization, cookies, API keys, CSRF tokens)
	 * before logging.
	 */
	private sanitizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
		if (!headers) return undefined;

		const sensitiveHeaders = [
			'authorization',
			'x-api-key',
			'cookie',
			'set-cookie',
			'x-auth-token',
			'proxy-authorization',
			'x-csrf-token',
		];
		const sanitized = { ...headers };

		// Replace sensitive headers with redacted value (case-insensitive)
		for (const [key] of Object.entries(sanitized)) {
			if (sensitiveHeaders.includes(key.toLowerCase())) {
				sanitized[key] = '[REDACTED]';
			}
		}

		return sanitized;
	}
}
