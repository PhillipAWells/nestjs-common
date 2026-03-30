// Security services
export { CSRFService } from '../common/services/csrf.service.js';

// Security guards
export { CSRFGuard } from '../common/guards/csrf.guard.js';

// Middleware and security bootstrap
export { ApplySecurityMiddleware } from '../common/factories/security-bootstrap.factory.js';
export type { ISecurityBootstrapOptions } from '../common/factories/security-bootstrap.factory.js';

// Rate limiting utilities
export { CreateRateLimitConfig } from '../common/factories/rate-limit-config.factory.js';
export type { IRateLimitConfig, IRateLimitDescriptor } from '../common/factories/rate-limit-config.factory.js';

// Throttler module
export { SharedThrottlerModule, type ISharedThrottlerConfig } from '../common/modules/throttler.module.js';
