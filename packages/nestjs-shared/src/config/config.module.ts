import { Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService as NestConfigService } from '@nestjs/config';
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
		{
			provide: ConfigService,
			inject: [ModuleRef, NestConfigService],
			useFactory: (moduleRef: ModuleRef, nestConfigService: NestConfigService) =>
				new ConfigService(moduleRef, nestConfigService),
		},
		ValidationService,
	],
	exports: [ConfigService, ValidationService],
})
export class ConfigModule {}
