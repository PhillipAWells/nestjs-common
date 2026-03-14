import { Module } from '@nestjs/common';
import { ConfigService } from './config.service.js';
import { ValidationService } from './validation.utils.js';

/**
 * Configuration Module.
 * Provides configuration services with environment variable access, validation, and logging.
 * MUST be imported before CommonModule in your application.
 *
 * Exports:
 * - ConfigService: Typed configuration accessor
 * - ValidationService: Configuration validation utilities
 *
 * @remarks
 * - ConfigService is required by CommonModule and other @pawells packages
 * - Initializes logging for configuration operations
 * - Import order critical: ConfigModule must come BEFORE CommonModule
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     ConfigModule,              // FIRST
 *     CommonModule,              // SECOND (depends on ConfigModule)
 *     MetricsModule.forRoot(),
 *     // ... other modules
 *   ]
 * })
 * export class AppModule {}
 * ```
 */

@Module({
	providers: [
		ConfigService,
		ValidationService,
	],
	exports: [ConfigService, ValidationService],
})
export class ConfigModule {}
