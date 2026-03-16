import { Injectable, OnModuleInit, OnModuleDestroy, Logger, HttpException, HttpStatus, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { doubleCsrf, type DoubleCsrfUtilities } from 'csrf-csrf';
import { Request, Response, NextFunction } from 'express';

/**
 * Configuration options for CSRF protection.
 */
export interface CSRFServiceOptions {
	/**
	 * Whether to trust X-Forwarded-For header for client IP detection.
	 * Set to true when running behind a reverse proxy (nginx, Apache, load balancer, etc.)
	 * to correctly identify the real client IP for rate limiting.
	 *
	 * Security note: Only enable if your reverse proxy is trusted and properly configured
	 * to set X-Forwarded-For. Enabling this on an untrusted proxy allows IP spoofing attacks.
	 *
	 * Default: false (use direct socket IP)
	 */
	trustProxy?: boolean;
}

/**
 * CSRF Service.
 * Provides CSRF token generation and validation using the Double Submit Cookie pattern.
 * Uses cryptographic signing and per-session/IP binding for secure token verification.
 *
 * Features:
 * - Double-CSRF token pattern (cookie + request header/body)
 * - Per-IP rate limiting: 10 tokens per 60 seconds
 * - Session binding (when available) or IP-based fallback
 * - Automatic pruning of stale timestamps
 * - Capacity monitoring with safety margin (80% threshold)
 * - SSL-only, HTTPOnly cookies in production
 *
 * Configuration requirements:
 * - CSRF_SECRET: Min 32 characters, cryptographically random, high entropy
 * - Express app with cookie parser middleware
 * - Optional: trustProxy for reverse proxy environments
 *
 * @remarks
 * - In-memory rate limiting supports ~10,000 concurrent IPs per instance
 * - For distributed deployments, use Redis-backed SharedThrottlerModule instead
 * - Token generation timeout: 30 seconds (queue timeout)
 * - Token timestamp pruning interval: 10 seconds
 * - IP map capacity threshold: 80% (8,000 IPs) before pruning
 * - Returns 503 Service Unavailable if at capacity after pruning
 * - Returns 429 Too Many Requests if rate limit exceeded
 *
 * @example
 * ```typescript
 * // Generate token for form
 * const token = await csrfService.generateToken(req, res);
 * res.render('form', { csrfToken: token });
 *
 * // Validate incoming request (done automatically by CSRFGuard)
 * const isValid = csrfService.validateToken(req);
 *
 * // Refresh token after sensitive operation (login, password change)
 * const newToken = await csrfService.refreshToken(req, res);
 * ```
 */
@Injectable()
export class CSRFService implements OnModuleInit, OnModuleDestroy {
	// Configuration constants
	// eslint-disable-next-line no-magic-numbers
	private static readonly MIN_SECRET_LENGTH = 32;
	// eslint-disable-next-line no-magic-numbers
	private static readonly MIN_CHARACTER_SET_DIVERSITY = 3;
	// eslint-disable-next-line no-magic-numbers
	private static readonly ANONYMOUS_TOKEN_RANDOMNESS_BYTES = 4;
	// eslint-disable-next-line no-magic-numbers
	private static readonly RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds
	// eslint-disable-next-line no-magic-numbers
	private static readonly RATE_LIMIT_COUNT = 10;
	/**
	 * Maximum number of unique IP addresses tracked for rate limiting.
	 * This in-memory strategy supports ~10,000 concurrent IPs per instance.
	 *
	 * **Scaling guidance**: For deployments exceeding 10,000 concurrent unique IPs,
	 * migrate to a Redis-backed rate limiting solution via SharedThrottlerModule:
	 * - Configure SharedThrottlerModule with Redis backend
	 * - Adjust limits and TTL for your traffic pattern
	 *
	 * **Memory management**: When the tracked IPs map reaches 80% capacity
	 * (8,000 IPs), the pruning logic removes stale entries (>60s old).
	 * If after pruning the map remains >= 10,000 IPs, token generation is
	 * rejected with HTTP 503 to prevent unbounded memory growth.
	 * The 80% threshold provides a safety margin before hard limits are hit.
	 *
	 * @see SharedThrottlerModule for Redis-backed distributed rate limiting
	 */
	// eslint-disable-next-line no-magic-numbers
	private static readonly MAX_TRACKED_IPS = 10000;
	// eslint-disable-next-line no-magic-numbers
	private static readonly TIMESTAMP_PRUNING_INTERVAL_MS = 10 * 1000; // Prune every 10 seconds
	// eslint-disable-next-line no-magic-numbers
	private static readonly IP_LOCK_TIMEOUT_MS = 30_000; // 30 second timeout for queued requests
	// eslint-disable-next-line no-magic-numbers
	private static readonly CAPACITY_THRESHOLD_PERCENT = 0.8;

	private csrfProtection: DoubleCsrfUtilities | undefined;
	private readonly logger = new Logger('CSRFService');
	private readonly tokenGenTimestamps = new Map<string, number[]>();
	private readonly ipLocks = new Map<string, Promise<unknown>>();
	private readonly trustProxy: boolean;
	private capacityThresholdCrossedCount = 0;
	private pruneIntervalHandle: ReturnType<typeof setInterval> | undefined;
	private _isPruning = false;

	constructor(
		@Inject(ConfigService) @Optional() private readonly configService?: ConfigService,
		@Optional() options?: CSRFServiceOptions,
	) {
		// Note: CSRF_SECRET validation is deferred to onModuleInit() to ensure
		// NestJS surfaces the error at bootstrap time rather than during DI resolution
		this.trustProxy = options?.trustProxy ?? false;
	}

	/**
	 * NestJS lifecycle hook: validate required CSRF_SECRET environment variable
	 * at application bootstrap time
	 */
	public onModuleInit(): void {
		const csrfSecret = this.configService?.get<string>('CSRF_SECRET') ?? process.env['CSRF_SECRET'];
		if (!csrfSecret) {
			throw new Error(
				'CSRF_SECRET environment variable is required but not set. ' +
			'Set it in your .env file or as an environment variable before starting the application.',
			);
		}

		// Validate CSRF_SECRET entropy
		if (csrfSecret.length < CSRFService.MIN_SECRET_LENGTH) {
			throw new Error(
				`CSRF_SECRET must be at least ${CSRFService.MIN_SECRET_LENGTH} characters long for adequate entropy. ` +
			`Current length: ${csrfSecret.length}. ` +
			'Generate a cryptographically secure value with: openssl rand -base64 32',
			);
		}

		// Check for obviously weak patterns as secondary check
		if (this.isWeakSecret(csrfSecret)) {
			throw new Error(
				'CSRF_SECRET contains obviously weak pattern. ' +
			'Must have a mix of different characters, not repeated or common strings. ' +
			'Generate a cryptographically secure value with: openssl rand -base64 32',
			);
		}

		// Validate entropy (primary check)
		const entropy = this.calculateEntropy(csrfSecret);
		const MIN_ENTROPY = 4.0;
		if (entropy < MIN_ENTROPY) {
			throw new Error(
				`CSRF_SECRET entropy is insufficient (${entropy.toFixed(2)} bits/char). ` +
			`Minimum required: ${MIN_ENTROPY} bits/char. ` +
			'Generate a cryptographically secure value with: openssl rand -base64 32',
			);
		}

		// Initialize CSRF protection now that we know the secret is available and valid
		this.csrfProtection = doubleCsrf({
			getSecret: () => csrfSecret,
			getSessionIdentifier: (req) => this.getSessionIdentifier(req),
			cookieName: '__Host-psifi.x-csrf-token',
			cookieOptions: {
				httpOnly: true,
				secure: process.env['NODE_ENV'] === 'production',
				sameSite: 'strict',
				path: '/',
			},
		});

		// Check for trust proxy misconfiguration at boot time
		this.validateTrustProxyConfiguration();

		// Prune old token generation timestamps more frequently to prevent unbounded growth
		// More aggressive pruning than 5 minutes to handle high-traffic scenarios
		this.pruneIntervalHandle = setInterval(() => this.pruneTokenTimestamps(), CSRFService.TIMESTAMP_PRUNING_INTERVAL_MS);
	}

	/**
	 * NestJS lifecycle hook: clear the pruning interval on module destroy
	 */
	public onModuleDestroy(): void {
		if (this.pruneIntervalHandle !== undefined) {
			clearInterval(this.pruneIntervalHandle);
			this.pruneIntervalHandle = undefined;
		}
		// Clear maps to release memory on shutdown
		this.tokenGenTimestamps.clear();
		this.ipLocks.clear();
	}

	/**
	 * Validate trust proxy configuration to detect mismatches early
	 * Checks if X-Forwarded-For header support is configured correctly in both directions:
	 * - If trustProxy=false but X-Forwarded-For is present: may miss real client IP
	 * - If trustProxy=true but X-Forwarded-For is absent: proxy may not be configured correctly
	 */
	private validateTrustProxyConfiguration(): void {
		// Check direction 1: trustProxy=false but service is likely behind a proxy
		// We detect this by checking if the NODE_ENV and common proxy environments are misconfigured.
		// Note: We do NOT call extractClientIp here to avoid spurious "X-Forwarded-For detected" warnings
		// during module initialization with synthetic sample requests.
		if (!this.trustProxy) {
			// Nothing to warn about at init time — the runtime warning in extractClientIp
			// will fire if real requests arrive with X-Forwarded-For headers.
			return;
		}

		// Check direction 2: trustProxy=true but X-Forwarded-For absent (reverse proxy may not be configured)
		// Use a sample request without X-Forwarded-For to detect this early
		const sampleRequestWithoutHeader = { headers: {}, socket: { remoteAddress: '127.0.0.1' } } as unknown as Request;
		const extractedIpWithoutHeader = this.extractClientIp(sampleRequestWithoutHeader);

		if (extractedIpWithoutHeader === undefined || extractedIpWithoutHeader === null) {
			this.logger.warn(
				'Trust proxy is enabled but X-Forwarded-For header is not present in sample request. ' +
				'Your reverse proxy may not be configured to set X-Forwarded-For correctly. ' +
				'Verify your proxy (nginx, Apache, load balancer, etc.) is setting this header.',
			);
		}
	}

	/**
	 * Calculate Shannon entropy of a string to measure randomness.
	 * Higher entropy indicates better randomness quality.
	 *
	 * The minimum threshold of 4.0 bits/char is chosen because:
	 * - A uniformly random string from a 16-character alphabet (hex: 0-9a-f) has log2(16) = 4.0 bits/char
	 * - This ensures the CSRF_SECRET has sufficient entropy for cryptographic purposes
	 * - Values below 4.0 bits/char indicate the secret uses a limited character set or has patterns
	 *
	 * @param str - Input string to analyze
	 * @returns Entropy in bits per character
	 */
	private calculateEntropy(str: string): number {
		const freq = new Map<string, number>();
		for (const char of str) {
			freq.set(char, (freq.get(char) ?? 0) + 1);
		}
		let entropy = 0;
		for (const count of freq.values()) {
			const p = count / str.length;
			entropy -= p * Math.log2(p);
		}
		return entropy;
	}

	/**
	 * Check if the secret contains obviously weak patterns
	 */
	private isWeakSecret(secret: string): boolean {
		// Check if all characters are the same (e.g., 'aaaaa...')
		if (/^(.)\1+$/.test(secret)) {
			return true;
		}

		// Check for repeated character sequences (e.g., 'aaaa' or 'bbbb')
		// Indicates low entropy and predictable patterns
		if (/(.)\1{4,}/.test(secret)) {
			return true;
		}

		// Check for common weak strings (case-insensitive)
		const lowerSecret = secret.toLowerCase();
		const weakPatterns = ['password', 'secret', '12345678', 'qwerty', '00000000', '11111111', '88888888', '99999999'];
		if (weakPatterns.some(pattern => lowerSecret.includes(pattern))) {
			return true;
		}

		return false;
	}

	/**
	 * Get session identifier for CSRF token binding
	 * Prefers session ID if available, falls back to IP address
	 * @param req - Express request object
	 * @returns Session identifier
	 */
	private getSessionIdentifier(req: unknown): string {
		const sessionId = (req as { session?: { id?: string } }).session?.id;
		if (sessionId) return sessionId;

		const ip = this.extractClientIp(req as Request);
		if (!ip) {
		// Log warning — do not silently fall through to 'unknown'
			this.logger.warn(
				'CSRF session identifier unavailable: no session and no IP. ' +
				'Using fixed fallback bucket to enforce rate limiting on anonymous requests.',
			);
			// Use fixed fallback bucket so all anonymous requests share the same rate limit
			return 'anon';
		}
		return ip;
	}

	/**
	 * Extract client IP address from request, respecting trustProxy setting
	 *
	 * **Note on Express vs Fastify**: This implementation uses `req.ip` (Express-specific).
	 * For Fastify deployments, ensure the `trustProxy` option is properly configured:
	 * - In Fastify, use `app.register(require('@fastify/proxy'), { ...config })`
	 * - Or set the Fastify instance option: `fastify({ trustProxy: true })`
	 * - Without correct Fastify configuration, IP detection will fail
	 *
	 * @param req - Express request object
	 * @returns Client IP address or null if unavailable
	 */
	private extractClientIp(req: Request): string | null {
		// If trustProxy is enabled, use X-Forwarded-For header (first IP only)
		if (this.trustProxy) {
			const forwardedFor = req.headers['x-forwarded-for'];
			if (forwardedFor) {
				// X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2...
				// We only trust the first one (the original client)
				const firstIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
				return firstIp?.trim() ?? null;
			}
		} else {
			// Warn if X-Forwarded-For is present but trustProxy is false
			// This may indicate a misconfiguration where the service is behind a reverse proxy
			const forwardedFor = req.headers['x-forwarded-for'];
			if (forwardedFor) {
				this.logger.warn(
					'X-Forwarded-For header detected but trustProxy is false. ' +
					'If this service is behind a reverse proxy (nginx, Apache, load balancer, etc.), ' +
					'enable trustProxy in CSRFService options to correctly identify client IPs. ' +
					'Otherwise, client IP detection will use direct socket IP.',
				);
			}
		}

		// Fall back to direct socket IP
		return (req as unknown as { ip?: string }).ip ?? ((req.socket as { remoteAddress?: string } | undefined)?.remoteAddress) ?? null;
	}

	/**
	 * Prune old token generation timestamps to prevent unbounded map growth
	 * Removes entries older than 60 seconds and cleans up idle IPs from both
	 * tokenGenTimestamps and ipLocks to prevent memory accumulation.
	 */
	private pruneTokenTimestamps(): void {
		const now = Date.now();
		const TIMESTAMP_TTL = 60_000; // 60 seconds

		for (const [ip, timestamps] of this.tokenGenTimestamps.entries()) {
			const recentTimestamps = timestamps.filter(ts => now - ts < TIMESTAMP_TTL);
			if (recentTimestamps.length === 0) {
				this.tokenGenTimestamps.delete(ip);
				// Clean up corresponding ipLocks entry when IP has no timestamps
				this.ipLocks.delete(ip);
			} else {
				this.tokenGenTimestamps.set(ip, recentTimestamps);
			}
		}
	}

	/**
	 * Generate CSRF token with per-IP rate limiting
	 * Limits to 10 token generations per IP per 60 seconds
	 * Uses per-IP locking to serialize concurrent requests from the same IP,
	 * preventing race conditions in rate limit checks.
	 * @param req - Express request object
	 * @param res - Express response object
	 * @returns CSRF token
	 * @throws Error if CSRF_SECRET was not initialized in onModuleInit
	 * @throws {HttpException} 429 - When rate limit exceeded for this IP
	 * @throws {HttpException} 503 - When service is at capacity
	 */
	public async generateToken(req: Request, res: Response): Promise<string> {
		if (!this.csrfProtection) {
			throw new Error('CSRFService not initialized — call onModuleInit() first');
		}

		const ip = this.extractClientIp(req) ?? 'unknown';

		// Serialize rate-limit check + token generation per IP to prevent race conditions
		// Chain this request's work after any pending work for the same IP
		const pendingWork = this.ipLocks.get(ip) ?? Promise.resolve();

		// Wrap with a timeout to prevent indefinite waits in the queue
		const currentWork = pendingWork.then(() => {
			return new Promise<string>((resolve, reject) => {
				const timer = setTimeout(() => {
					reject(new HttpException(
						'CSRF token generation timed out waiting in queue',
						HttpStatus.SERVICE_UNAVAILABLE,
					));
				}, CSRFService.IP_LOCK_TIMEOUT_MS);

				try {
					const token = this.performRateLimitedTokenGeneration(req, res);
					clearTimeout(timer);
					resolve(token);
				} catch (err) {
					clearTimeout(timer);
					reject(err);
				}
			});
		});

		this.ipLocks.set(ip, currentWork);

		// Clean up the lock after this work completes (only if no new work queued)
		currentWork.finally(() => {
			if (this.ipLocks.get(ip) === currentWork) {
				this.ipLocks.delete(ip);
			}
		});

		// eslint-disable-next-line @typescript-eslint/return-await
		return await currentWork;
	}

	/**
	 * Perform rate-limited token generation for a single IP.
	 * This method is called within an IP-serialized lock to ensure atomicity.
	 * @param req - Express request object
	 * @param res - Express response object
	 * @returns CSRF token
	 * @throws HttpException with 429 status if rate limit exceeded
	 */
	private performRateLimitedTokenGeneration(req: Request, res: Response): string {
		// Check per-IP rate limit
		const ip = this.extractClientIp(req) ?? 'unknown';
		const now = Date.now();

		// Check if map is approaching capacity (at 80% threshold with 20% safety margin)
		// This safety margin prevents race conditions where concurrent requests might insert
		// new IPs between the pruning step and the final capacity check.
		 
		const capacityThreshold = CSRFService.MAX_TRACKED_IPS * CSRFService.CAPACITY_THRESHOLD_PERCENT;
		if (this.tokenGenTimestamps.size >= capacityThreshold) {
			this.capacityThresholdCrossedCount++;
			// eslint-disable-next-line no-magic-numbers
			const capacityPercent = (this.tokenGenTimestamps.size / CSRFService.MAX_TRACKED_IPS * 100).toFixed(1);
			this.logger.warn(
				`CSRF token generation approaching capacity (${capacityPercent}% of ${CSRFService.MAX_TRACKED_IPS} max IPs). ` +
				`Threshold crossed ${this.capacityThresholdCrossedCount} times.`,
			);

			if (!this._isPruning) {
				this._isPruning = true;
				this.pruneTokenTimestamps();
				this._isPruning = false;
			}
			// Check again after pruning
			if (this.tokenGenTimestamps.size >= CSRFService.MAX_TRACKED_IPS) {
				// eslint-disable-next-line no-magic-numbers
				const finalCapacityPercent = (this.tokenGenTimestamps.size / CSRFService.MAX_TRACKED_IPS * 100).toFixed(1);
				this.logger.error(
					`CSRF service at maximum capacity (${finalCapacityPercent}% of ${CSRFService.MAX_TRACKED_IPS} max IPs). ` +
					'Token generation rejected.',
				);
				throw new HttpException(
					'CSRF token generation service is temporarily unavailable',
					HttpStatus.SERVICE_UNAVAILABLE,
				);
			}
		}

		let timestamps = this.tokenGenTimestamps.get(ip) ?? [];
		// Filter to only timestamps within the last 60 seconds
		timestamps = timestamps.filter(ts => now - ts < CSRFService.RATE_LIMIT_WINDOW_MS);

		if (timestamps.length >= CSRFService.RATE_LIMIT_COUNT) {
			this.logger.warn(`CSRF token rate limit exceeded for IP: ${ip}`);
			throw new HttpException(
				'Rate limit exceeded for CSRF token generation',
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}

		// Record this generation
		timestamps.push(now);
		this.tokenGenTimestamps.set(ip, timestamps);

		// Generate and return the token
		// csrfProtection is guaranteed non-null: generateToken (our caller) checks it,
		// and performRateLimitedTokenGeneration is only called from generateToken's chain.
		const protection = this.csrfProtection;
		if (!protection) {
			throw new Error('CSRFService not initialized — call onModuleInit() first');
		}
		return protection.generateToken(req, res);
	}

	/**
	 * Validate CSRF token
	 * @param req - Express request object
	 * @returns true if token is valid, false otherwise
	 * @throws Error if CSRF_SECRET was not initialized in onModuleInit
	 */
	public validateToken(req: Request): boolean {
		if (!this.csrfProtection) {
			throw new Error('CSRFService not initialized — call onModuleInit() first');
		}

		try {
			this.csrfProtection.validateRequest(req);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Refresh CSRF token by invalidating the current one and generating a new one
	 * Use this after sensitive operations like login, password change, or privilege escalation
	 * to ensure the user has a fresh token that cannot be replayed from before the operation
	 * @param req - Express request object
	 * @param res - Express response object
	 * @returns New CSRF token
	 * @throws Error if CSRF_SECRET was not initialized in onModuleInit
	 */
	// eslint-disable-next-line @typescript-eslint/promise-function-async
	public refreshToken(req: Request, res: Response): Promise<string> {
		if (!this.csrfProtection) {
			throw new Error('CSRFService not initialized — call onModuleInit() first');
		}

		// Route through rate limiting to enforce per-IP token generation limits
		// Clear any session-bound CSRF state by generating a fresh token
		// The doubleCsrf library handles invalidation through cookie/session updates
		return this.generateToken(req, res);
	}

	/**
	 * Get CSRF middleware
	 * @returns CSRF protection middleware
	 * @throws Error if CSRF_SECRET was not initialized in onModuleInit
	 */
	public getMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
		if (!this.csrfProtection) {
			throw new Error('CSRFService not initialized — call onModuleInit() first');
		}

		return this.csrfProtection.doubleCsrfProtection;
	}
}
