import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom throttle guard that uses IP address for tracking
 * Provides IP-based rate limiting for HTTP requests
 *
 * IMPORTANT: Proxy Configuration
 * This guard prefers the direct TCP connection address (req.socket.remoteAddress)
 * which is not spoofable via HTTP headers. If your application is behind a
 * reverse proxy (Nginx, HAProxy, AWS ELB, etc.), ensure the proxy is correctly
 * configured as trusted in Express:
 *
 * - Express: app.set('trust proxy', 'loopback') or app.set('trust proxy', 1)
 * - Only then will req.ip correctly reflect the client IP through the proxy
 *
 * If req.socket.remoteAddress is unavailable (e.g., in test environments),
 * falls back to req.ip, which may be influenced by X-Forwarded-For headers.
 */
@Injectable()
export class CustomThrottleGuard extends ThrottlerGuard {
	/**
	 * Get tracker identifier from request
	 * Prefers the direct socket address (not spoofable via headers),
	 * falls back to req.ip when unavailable
	 * @param req Request object
	 * @returns Tracker string (IP address)
	 */
	// eslint-disable-next-line require-await
	protected override async getTracker(req: Record<string, unknown>): Promise<string> {
		// Prefer the direct TCP connection address (not spoofable via headers)
		// req.socket.remoteAddress is the actual connecting IP regardless of proxies
		const DirectIp =
			(req['socket'] as { remoteAddress?: string } | undefined)?.remoteAddress ??
			(req['connection'] as { remoteAddress?: string } | undefined)?.remoteAddress;

		if (DirectIp) return DirectIp;

		// Fall back to req.ip only when direct address is unavailable (e.g., test environment)
		// NOTE: req.ip may be influenced by X-Forwarded-For in proxy setups.
		// Ensure express trust proxy is configured correctly if behind a trusted reverse proxy.
		const Ip = req['ip'] as string | undefined;
		return Ip ?? 'unknown';
	}
}
