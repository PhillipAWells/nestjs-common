import { Injectable, OnModuleInit, OnModuleDestroy, HttpException, HttpStatus, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { doubleCsrf, type DoubleCsrfUtilities } from 'csrf-csrf';
import { Request, Response, NextFunction } from 'express';
import { EscapeNewlines } from '../utils/sanitization.utils.js';
import { AppLogger } from './logger.service.js';

/**
 * Configuration options for CSRF protection.
 */
export interface ICSRFServiceOptions {
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
 * const IsValid = csrfService.validateToken(req);
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

	private CsrfProtection: DoubleCsrfUtilities | undefined;
	private _Logger: AppLogger | undefined;
	private readonly TokenGenTimestamps = new Map<string, number[]>();
	private readonly IpLocks = new Map<string, Promise<unknown>>();
	private readonly TrustProxy: boolean;
	private CapacityThresholdCrossedCount = 0;
	private PruneIntervalHandle: ReturnType<typeof setInterval> | undefined;
	private _IsPruning = false;
	private readonly ConfigService: ConfigService | undefined;

	constructor(
		@Inject(ConfigService) @Optional() configService?: ConfigService,
		@Optional() options?: ICSRFServiceOptions,
		@Optional() logger?: AppLogger,
	) {
		this.ConfigService = configService;
		this._Logger = logger;
		// Note: CSRF_SECRET validation is deferred to onModuleInit() to ensure
		// NestJS surfaces the error at bootstrap time rather than during DI resolution
		this.TrustProxy = options?.trustProxy ?? false;
	}

	private get Logger(): AppLogger {
		// Fallback: create a new AppLogger if none was provided
		this._Logger ??= new AppLogger();
		return this._Logger;
	}

	/**
	 * NestJS lifecycle hook: validate required CSRF_SECRET environment variable
	 * at application bootstrap time
	 */
	public onModuleInit(): void {
		const CsrfSecret = this.ConfigService?.get<string>('CSRF_SECRET') ?? process.env['CSRF_SECRET'];
		if (!CsrfSecret) {
			throw new Error(
				'CSRF_SECRET environment variable is required but not set. ' +
			'Set it in your .env file or as an environment variable before starting the application.',
			);
		}

		// Validate CSRF_SECRET entropy
		if (CsrfSecret.length < CSRFService.MIN_SECRET_LENGTH) {
			throw new Error(
				`CSRF_SECRET must be at least ${CSRFService.MIN_SECRET_LENGTH} characters long for adequate entropy. ` +
			`Current length: ${CsrfSecret.length}. ` +
			'Generate a cryptographically secure value with: openssl rand -base64 32',
			);
		}

		// Check for obviously weak patterns as secondary check
		if (this.IsWeakSecret(CsrfSecret)) {
			throw new Error(
				'CSRF_SECRET contains obviously weak pattern. ' +
			'Must have a mix of different characters, not repeated or common strings. ' +
			'Generate a cryptographically secure value with: openssl rand -base64 32',
			);
		}

		// Validate entropy (primary check)
		const Entropy = this.CalculateEntropy(CsrfSecret);
		const MIN_ENTROPY = 4.0;
		if (Entropy < MIN_ENTROPY) {
			throw new Error(
				`CSRF_SECRET entropy is insufficient (${Entropy.toFixed(2)} bits/char). ` +
			`Minimum required: ${MIN_ENTROPY} bits/char. ` +
			'Generate a cryptographically secure value with: openssl rand -base64 32',
			);
		}

		// Initialize CSRF protection now that we know the secret is available and valid
		this.CsrfProtection = doubleCsrf({
			getSecret: () => CsrfSecret,
			getSessionIdentifier: (req) => this.GetSessionIdentifier(req),
			cookieName: '__Host-psifi.x-csrf-token',
			cookieOptions: {
				httpOnly: true,
				secure: process.env['NODE_ENV'] === 'production',
				sameSite: 'strict',
				path: '/',
			},
		});

		// Check for trust proxy misconfiguration at boot time
		this.ValidateTrustProxyConfiguration();

		// Prune old token generation timestamps more frequently to prevent unbounded growth
		// More aggressive pruning than 5 minutes to handle high-traffic scenarios
		this.PruneIntervalHandle = setInterval(() => this.PruneTokenTimestamps(), CSRFService.TIMESTAMP_PRUNING_INTERVAL_MS);
	}

	/**
	 * NestJS lifecycle hook: clear the pruning interval on module destroy
	 */
	public onModuleDestroy(): void {
		if (this.PruneIntervalHandle !== undefined) {
			clearInterval(this.PruneIntervalHandle);
			this.PruneIntervalHandle = undefined;
		}
		// Clear maps to release memory on shutdown
		this.TokenGenTimestamps.clear();
		this.IpLocks.clear();
	}

	/**
	 * Validate trust proxy configuration to detect mismatches early
	 * Checks if X-Forwarded-For header support is configured correctly in both directions:
	 * - If trustProxy=false but X-Forwarded-For is present: may miss real client IP
	 * - If trustProxy=true but X-Forwarded-For is absent: proxy may not be configured correctly
	 */
	private ValidateTrustProxyConfiguration(): void {
		// Check direction 1: trustProxy=false but service is likely behind a proxy
		// We detect this by checking if the NODE_ENV and common proxy environments are misconfigured.
		// Note: We do NOT call extractClientIp here to avoid spurious "X-Forwarded-For detected" warnings
		// during module initialization with synthetic sample requests.
		if (!this.TrustProxy) {
			// Nothing to warn about at init time — the runtime warning in extractClientIp
			// will fire if real requests arrive with X-Forwarded-For headers.
			return;
		}

		// Check direction 2: trustProxy=true but X-Forwarded-For absent (reverse proxy may not be configured)
		// Use a sample request without X-Forwarded-For to detect this early
		const SampleRequestWithoutHeader = { headers: {}, socket: { remoteAddress: '127.0.0.1' } } as unknown as Request;
		const ExtractedIpWithoutHeader = this.ExtractClientIp(SampleRequestWithoutHeader);

		if (ExtractedIpWithoutHeader === undefined || ExtractedIpWithoutHeader === null) {
			this.Logger.warn(
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
	private CalculateEntropy(str: string): number {
		const Freq = new Map<string, number>();
		for (const Char of str) {
			Freq.set(Char, (Freq.get(Char) ?? 0) + 1);
		}
		let Entropy = 0;
		for (const Count of Freq.values()) {
			const P = Count / str.length;
			Entropy -= P * Math.log2(P);
		}
		return Entropy;
	}

	/**
	 * Check if the secret contains obviously weak patterns
	 */
	private IsWeakSecret(secret: string): boolean {
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
		const LowerSecret = secret.toLowerCase();
		const WeakPatterns = ['password', 'secret', '12345678', 'qwerty', '00000000', '11111111', '88888888', '99999999'];
		if (WeakPatterns.some(pattern => LowerSecret.includes(pattern))) {
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
	private GetSessionIdentifier(req: unknown): string {
		const SessionId = (req as { session?: { id?: string } }).session?.id;
		if (SessionId) return SessionId;

		const Ip = this.ExtractClientIp(req as Request);
		if (!Ip) {
			// Log warning — do not silently fall through to 'unknown'
			this.Logger.warn(
				'CSRF session identifier unavailable: no session and no IP. ' +
				'Using fixed fallback bucket to enforce rate limiting on anonymous requests.',
			);
			// Use fixed fallback bucket so all anonymous requests share the same rate limit
			return 'anon';
		}
		return Ip;
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
	private ExtractClientIp(req: Request): string | null {
		// If trustProxy is enabled, use X-Forwarded-For header (first IP only)
		if (this.TrustProxy) {
			const ForwardedFor = req.headers['x-forwarded-for'];
			if (ForwardedFor) {
				// X-Forwarded-For can contain multiple IPs: client, proxy1, proxy2...
				// We only trust the first one (the original client)
				const FirstIp = Array.isArray(ForwardedFor) ? ForwardedFor[0] : ForwardedFor.split(',')[0];
				return FirstIp?.trim() ?? null;
			}
		} else {
			// Warn if X-Forwarded-For is present but trustProxy is false
			// This may indicate a misconfiguration where the service is behind a reverse proxy
			const ForwardedFor = req.headers['x-forwarded-for'];
			if (ForwardedFor) {
				this.Logger.warn(
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
	private PruneTokenTimestamps(): void {
		const Now = Date.now();
		const TIMESTAMP_TTL = 60_000; // 60 seconds

		for (const [Ip, Timestamps] of this.TokenGenTimestamps.entries()) {
			const RecentTimestamps = Timestamps.filter(ts => Now - ts < TIMESTAMP_TTL);
			if (RecentTimestamps.length === 0) {
				this.TokenGenTimestamps.delete(Ip);
				// Clean up corresponding ipLocks entry when IP has no timestamps
				this.IpLocks.delete(Ip);
			} else {
				this.TokenGenTimestamps.set(Ip, RecentTimestamps);
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
	public async GenerateToken(req: Request, res: Response): Promise<string> {
		if (!this.CsrfProtection) {
			throw new Error('CSRFService not initialized — call onModuleInit() first');
		}

		const Ip = this.ExtractClientIp(req) ?? 'unknown';

		// Serialize rate-limit check + token generation per IP to prevent race conditions
		// Chain this request's work after any pending work for the same IP
		const PendingWork = this.IpLocks.get(Ip) ?? Promise.resolve();

		// Wrap with a timeout to prevent indefinite waits in the queue
		const CurrentWork = PendingWork.then(() => {
			return new Promise<string>((resolve, reject) => {
				const Timer = setTimeout(() => {
					reject(new HttpException(
						'CSRF token generation timed out waiting in queue',
						HttpStatus.SERVICE_UNAVAILABLE,
					));
				}, CSRFService.IP_LOCK_TIMEOUT_MS);

				try {
					const Token = this.PerformRateLimitedTokenGeneration(req, res);
					clearTimeout(Timer);
					resolve(Token);
				} catch (Err) {
					clearTimeout(Timer);
					reject(Err);
				}
			});
		});

		this.IpLocks.set(Ip, CurrentWork);

		// Clean up the lock after this work completes (only if no new work queued)
		CurrentWork.finally(() => {
			if (this.IpLocks.get(Ip) === CurrentWork) {
				this.IpLocks.delete(Ip);
			}
		});

		// eslint-disable-next-line @typescript-eslint/return-await
		return await CurrentWork;
	}

	/**
	 * Perform rate-limited token generation for a single IP.
	 * This method is called within an IP-serialized lock to ensure atomicity.
	 * @param req - Express request object
	 * @param res - Express response object
	 * @returns CSRF token
	 * @throws HttpException with 429 status if rate limit exceeded
	 */
	private PerformRateLimitedTokenGeneration(req: Request, res: Response): string {
		// Check per-IP rate limit
		const Ip = this.ExtractClientIp(req) ?? 'unknown';
		const Now = Date.now();

		// Check if map is approaching capacity (at 80% threshold with 20% safety margin)
		// This safety margin prevents race conditions where concurrent requests might insert
		// new IPs between the pruning step and the final capacity check.

		const CapacityThreshold = CSRFService.MAX_TRACKED_IPS * CSRFService.CAPACITY_THRESHOLD_PERCENT;
		if (this.TokenGenTimestamps.size >= CapacityThreshold) {
			this.CapacityThresholdCrossedCount++;
			// eslint-disable-next-line no-magic-numbers
			const CapacityPercent = (this.TokenGenTimestamps.size / CSRFService.MAX_TRACKED_IPS * 100).toFixed(1);
			this.Logger.warn(
				`CSRF token generation approaching capacity (${CapacityPercent}% of ${CSRFService.MAX_TRACKED_IPS} max IPs). ` +
				`Threshold crossed ${this.CapacityThresholdCrossedCount} times.`,
			);

			if (!this._IsPruning) {
				this._IsPruning = true;
				this.PruneTokenTimestamps();
				this._IsPruning = false;
			}
			// Check again after pruning
			if (this.TokenGenTimestamps.size >= CSRFService.MAX_TRACKED_IPS) {
				// eslint-disable-next-line no-magic-numbers
				const FinalCapacityPercent = (this.TokenGenTimestamps.size / CSRFService.MAX_TRACKED_IPS * 100).toFixed(1);
				this.Logger.error(
					`CSRF service at maximum capacity (${FinalCapacityPercent}% of ${CSRFService.MAX_TRACKED_IPS} max IPs). ` +
					'Token generation rejected.',
				);
				throw new HttpException(
					'CSRF token generation service is temporarily unavailable',
					HttpStatus.SERVICE_UNAVAILABLE,
				);
			}
		}

		let Timestamps = this.TokenGenTimestamps.get(Ip) ?? [];
		// Filter to only timestamps within the last 60 seconds
		Timestamps = Timestamps.filter(ts => Now - ts < CSRFService.RATE_LIMIT_WINDOW_MS);

		if (Timestamps.length >= CSRFService.RATE_LIMIT_COUNT) {
			this.Logger.warn(`CSRF token rate limit exceeded for IP: ${EscapeNewlines(Ip)}`);
			throw new HttpException(
				'Rate limit exceeded for CSRF token generation',
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}

		// Record this generation
		Timestamps.push(Now);
		this.TokenGenTimestamps.set(Ip, Timestamps);

		// Generate and return the token
		// csrfProtection is guaranteed non-null: generateToken (our caller) checks it,
		// and performRateLimitedTokenGeneration is only called from generateToken's chain.
		const Protection = this.CsrfProtection;
		if (!Protection) {
			throw new Error('CSRFService not initialized — call onModuleInit() first');
		}
		return Protection.generateCsrfToken(req, res);
	}

	/**
	 * Validate CSRF token
	 * @param req - Express request object
	 * @returns true if token is valid, false otherwise
	 * @throws Error if CSRF_SECRET was not initialized in onModuleInit
	 */
	public ValidateToken(req: Request): boolean {
		if (!this.CsrfProtection) {
			throw new Error('CSRFService not initialized — call onModuleInit() first');
		}

		try {
			this.CsrfProtection.validateRequest(req);
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
	public RefreshToken(req: Request, res: Response): Promise<string> {
		if (!this.CsrfProtection) {
			throw new Error('CSRFService not initialized — call onModuleInit() first');
		}

		// Route through rate limiting to enforce per-IP token generation limits
		// Clear any session-bound CSRF state by generating a fresh token
		// The doubleCsrf library handles invalidation through cookie/session updates
		return this.GenerateToken(req, res);
	}

	/**
	 * Get CSRF middleware
	 * @returns CSRF protection middleware
	 * @throws Error if CSRF_SECRET was not initialized in onModuleInit
	 */
	public GetMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
		if (!this.CsrfProtection) {
			throw new Error('CSRFService not initialized — call onModuleInit() first');
		}

		return this.CsrfProtection.doubleCsrfProtection;
	}
}
