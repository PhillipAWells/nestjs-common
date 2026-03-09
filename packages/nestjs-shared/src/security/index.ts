// Security services
export { CSRFService } from '../common/services/csrf.service.js';

// Security guards
export { CSRFGuard } from '../common/guards/csrf.guard.js';

// Middleware and security bootstrap
export { ApplySecurityMiddleware } from '../common/factories/security-bootstrap.factory.js';
export type { SecurityBootstrapOptions } from '../common/factories/security-bootstrap.factory.js';

// Rate limiting utilities
export { CreateRateLimitConfig } from '../common/factories/rate-limit-config.factory.js';
export type { RateLimitConfig, RateLimitDescriptor } from '../common/factories/rate-limit-config.factory.js';

// Throttler module
export { SharedThrottlerModule, type SharedThrottlerConfig } from '../common/modules/throttler.module.js';
