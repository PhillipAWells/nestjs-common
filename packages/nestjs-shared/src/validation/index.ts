// Validation pipes
export { BaseValidationPipe } from '../common/pipes/base-validation.pipe.js';
export { ValidationPipe } from '../common/pipes/validation.pipe.js';

// Validation service and utilities
export { ValidationService } from '../config/validation.utils.js';
export type { ValidationResult } from '../config/config.types.js';

// Joi schema builders
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
} from '../config/validation.utils.js';
