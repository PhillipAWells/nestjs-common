import { Module } from '@nestjs/common';
import { ConfigService } from './config.service.js';
import { ValidationService } from './validation.utils.js';
import { CommonModule } from '../common/index.js';

/**
 * Configuration Module
 * Provides configuration services with validation, logging, and profiling
 */

@Module({
	imports: [
		CommonModule,
		// Note: PyroscopeModule is imported by TracingModule - do not duplicate here
	],
	providers: [
		ConfigService,
		ValidationService,
	],
	exports: [ConfigService, ValidationService],
})
export class ConfigModule {}
