
/**
 * Security Bootstrap Factory
 *
 * Provides a comprehensive factory function for applying security middleware and
 * configurations to a NestJS application. This includes compression, MongoDB injection
 * prevention, XSS protection, Helmet.js security headers, CORS, and global validation pipes.
 *
 * All security features are enabled by default and can be selectively disabled via options.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import express, { Request, Response, NextFunction } from 'express';
import { SanitizeObject, SanitizeXss } from '../utils/sanitization.utils.js';

export interface ISecurityBootstrapOptions {
	/** List of allowed CORS origins. In development, localhost and Apollo Studio are always included. */
	corsOrigins?: string[];
	/** Environment mode (development or production). Defaults to NODE_ENV or 'development'. */
	environment?: string;
	/** Enable/disable compression middleware (default: true) */
	compressionEnabled?: boolean;
	/** Enable/disable XSS protection (default: true) */
	xssEnabled?: boolean;
	/** Enable/disable Helmet.js security headers (default: true) */
	helmetEnabled?: boolean;
	/** Enable/disable MongoDB injection prevention (default: true) */
	mongoDbInjectionPreventionEnabled?: boolean;
	/** Enable/disable CORS (default: true) */
	corsEnabled?: boolean;
	/** Custom CORS allowed headers (default: Content-Type, Authorization, etc.) */
	corsAllowedHeaders?: string[];
	/** CSP Connect-Src directives for allowed API origins. Merged with default 'self' (default: empty array). Use for configuring allowed API endpoints in production. */
	cspConnectSrc?: string[];
	/** CSP Image-Src directives for allowed image origins. Merged with default 'self' and 'data:' (default: empty array). Use for configuring allowed image CDNs in production. */
	cspImgSrc?: string[];
	/** CSP Style-Src directives for allowed style origins. Merged with default 'self' (default: empty array). Use for configuring allowed style CDNs like Google Fonts in production. */
	cspStyleSrc?: string[];
	/** CSP Font-Src directives for allowed font origins. Merged with default 'self' (default: empty array). Use for configuring allowed font CDNs like Google Fonts in production. */
	cspFontSrc?: string[];
	/** Maximum request body size limit (default: '10mb'). Express format: '10mb', '100kb', etc. */
	maxBodySize?: string;
}

/**
 * Applies comprehensive security middleware and configurations to a NestJS application
 *
 * Configured middleware stack (in order):
 * 0. Body Size Limits - Enforces maximum request body size
 * 1. Compression - Reduces response size for APIs larger than 1KB
 * 2. MongoDB Injection Prevention - Sanitizes request body and params
 * 3. XSS Protection - Sanitizes user input to prevent XSS attacks
 * 4. Helmet.js - Sets security-related HTTP headers (CSP, HSTS, X-Frame-Options, etc)
 * 5. Global Validation Pipe - Validates and transforms incoming data
 * 6. CORS - Enables cross-origin resource sharing with configurable origins
 *
 * @param app The NestJS application instance
 * @param options Configuration options for security bootstrap
 *
 * @example
 * ```typescript
 * import { NestFactory } from '@nestjs/core';
 * import { ApplySecurityMiddleware } from '@pawells/nestjs-shared';
 * import { AppModule } from './app.module';
 *
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *
 *   ApplySecurityMiddleware(app, {
 *     corsOrigins: ['https://example.com'],
 *     environment: 'production',
 *   });
 *
 *   await app.listen(3000);
 * }
 *
 * bootstrap();
 * ```
 */
export function ApplySecurityMiddleware(
	app: INestApplication,
	options: ISecurityBootstrapOptions = {},
): void {
	const {
		corsOrigins = [],
		environment = process.env['NODE_ENV'] ?? 'development',
		compressionEnabled = true,
		xssEnabled = true,
		helmetEnabled = true,
		mongoDbInjectionPreventionEnabled = true,
		corsEnabled = true,
		corsAllowedHeaders = ['Content-Type', 'Authorization', 'X-Requested-With', 'apollographql-client-name', 'apollographql-client-version', 'X-CSRF-Token'],
		cspConnectSrc = [],
		cspImgSrc = [],
		cspStyleSrc = [],
		cspFontSrc = [],
		maxBodySize = '10mb',
	} = options;

	// Named constants for configuration
	const DEFAULT_COMPRESSION_LEVEL = 6;
	const DEFAULT_COMPRESSION_THRESHOLD = 1024;

	// Step 0: Apply request body size limits
	app.use(express.json({ limit: maxBodySize }));
	app.use(express.urlencoded({ extended: true, limit: maxBodySize }));

	// Step 1: Apply compression middleware
	if (compressionEnabled) {
		app.use(
			compression({
				level: DEFAULT_COMPRESSION_LEVEL,
				threshold: DEFAULT_COMPRESSION_THRESHOLD,
				filter: (req: Request, res: Response) => {
					// Don't compress responses with this request header
					if (req.headers['x-no-compression']) {
						return false;
					}
					// Use default compression filter function
					return compression.filter(req, res);
				},
			}),
		);
	}

	// Step 2: Apply MongoDB injection prevention middleware
	if (mongoDbInjectionPreventionEnabled) {
		app.use((req: Request, _res: Response, next: NextFunction) => {
			if (req.body) {
				req.body = SanitizeObject(req.body, 0);
			}
			if (req.params) {
				req.params = SanitizeObject(req.params, 0);
			}
			if (req.cookies && typeof req.cookies === 'object') {
				req.cookies = SanitizeObject(req.cookies);
			}
			next();
		});
	}

	// Step 3: Apply XSS protection middleware
	if (xssEnabled) {
		app.use((req: Request, _res: Response, next: NextFunction) => {
			if (req.body) {
				req.body = SanitizeXss(req.body);
			}
			if (req.query) {
				req.query = SanitizeXss(req.query) as Record<string, string[]> | Record<string, string>;
			}
			if (req.params) {
				req.params = SanitizeXss(req.params) as Record<string, string>;
			}
			next();
		});
	}

	// Step 4: Apply Helmet.js for security headers
	if (helmetEnabled) {
		app.use(
			helmet({
				contentSecurityPolicy: {
					directives: {
						defaultSrc: [...new Set(['\'self\''])],
						scriptSrc: [...new Set(['\'self\''])],
						styleSrc: [...new Set(['\'self\'', ...cspStyleSrc])],
						imgSrc: [...new Set(['\'self\'', ...cspImgSrc])],
						connectSrc: [...new Set(['\'self\'', ...cspConnectSrc])],
						fontSrc: [...new Set(['\'self\'', ...cspFontSrc])],
						baseUri: [...new Set(['\'self\''])],
						objectSrc: [...new Set(['\'none\''])],
						mediaSrc: [...new Set(['\'self\''])],
						frameSrc: [...new Set(['\'none\''])],
					},
				},
				hsts: {
					maxAge: 31536000, // 1 year
					includeSubDomains: true,
					preload: true,
				},
				frameguard: {
					action: 'deny',
				},
				referrerPolicy: {
					policy: 'strict-origin-when-cross-origin',
				},
				noSniff: true,
				xssFilter: true,
				dnsPrefetchControl: {
					allow: false,
				},
			}),
		);
	}

	// Step 5: Apply global validation pipe
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		}),
	);

	// Step 6: Enable CORS with smart origin validation
	if (corsEnabled) {
		// Apollo Studio origins that need access in development
		const ApolloStudioOrigins = [
			'https://studio.apollographql.com',
			'https://sandbox.apollo.dev',
		];

		/**
		 * Smart CORS origin validation algorithm.
		 *
		 * This validator implements a layered origin checking strategy that balances
		 * development convenience with production security:
		 *
		 * 1. **No-origin requests**: Allows requests without an Origin header
		 *    (typical for same-origin, curl, Postman, and other non-browser clients).
		 *    These requests are safe and do not require CORS validation.
		 *
		 * 2. **Development localhost origins**: In development mode, permits all localhost origins
		 *    (http://localhost:*) to enable rapid iteration without configuration.
		 *    This includes any port number (e.g., http://localhost:3000, http://localhost:5173).
		 *
		 * 3. **Development Apollo Studio origins**: In development mode, explicitly allows
		 *    Apollo Studio (https://studio.apollographql.com) and Apollo Sandbox (https://sandbox.apollo.dev)
		 *    to facilitate GraphQL IDE testing without additional setup.
		 *
		 * 4. **Configured production origins**: Allows explicitly configured origins from the
		 *    corsOrigins option. This is the primary enforcement mechanism in production.
		 *
		 * 5. **Default rejection**: Any origin not matching the above is rejected with an
		 *    "Not allowed by CORS" error.
		 *
		 * **Security notes:**
		 * - Development mode origins (localhost, Apollo Studio) are disabled in production
		 * - Configured origins are checked case-insensitively for robustness
		 * - Wildcard origins (e.g., *.example.com) are not supported; specify each origin explicitly
		 */
		app.enableCors({
			origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
				// Allow requests with no origin (same-origin, curl, Postman, etc.)
				if (!origin) {
					callback(null, true);
					return;
				}

				// In development, allow all localhost origins (strict match: must be http://localhost or http://localhost:PORT)
				if (environment === 'development' && /^http:\/\/localhost(?::\d+)?$/.test(origin)) {
					callback(null, true);
					return;
				}

				// In development, allow Apollo Studio origins
				if (environment === 'development' && ApolloStudioOrigins.includes(origin)) {
					callback(null, true);
					return;
				}

				// Check against configured allowed origins list (case-insensitive)
				if (corsOrigins.some(allowed => allowed.toLowerCase() === origin.toLowerCase())) {
					callback(null, true);
					return;
				}

				// Reject unknown origins
				callback(new Error('Not allowed by CORS'));
			},
			credentials: true,
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
			allowedHeaders: corsAllowedHeaders,
			exposedHeaders: ['X-Total-Count', 'X-Page-Number'],
			maxAge: 3600,
		});
	}
}
