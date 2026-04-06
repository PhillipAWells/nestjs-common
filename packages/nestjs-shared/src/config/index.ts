// Main exports
export { ConfigService } from './config.service.js';
export { ValidationService } from './validation.utils.js';
export { ConfigModule } from './config.module.js';

// Types
export type {
	IAppConfig,
	IDatabaseConfig,
	ICacheConfig,
	IAuthConfig,
	IValidationResult,
	IConfigSchema,
	IEnvironmentOptions,
} from './config.types.js';

// Validation utilities
export {
	CreateValidationSchema,
	ValidateConfig,
	CreateStringSchema,
	CreateNumberSchema,
	CreateBooleanSchema,
	CreateUriSchema,
	CreatePortSchema,
	CreateEnvironmentSchema,
	CreateJwtExpirationSchema,
} from './validation.utils.js';

// Decorators
export * from './decorators/index.js';
