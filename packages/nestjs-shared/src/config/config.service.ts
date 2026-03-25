import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { LazyModuleRefService } from '../common/utils/lazy-getter.types.js';
import { AppLogger } from '../common/index.js';

/**
 * Configuration schema definition interface.
 * Used for validating configuration structure.
 */
export interface ConfigSchemaDefinition {
	[key: string]: {
		required: boolean;
		[key: string]: any;
	};
}

/**
 * Configuration Service.
 * Provides typed access to environment variables with validation and transformation.
 * Extends NestJS ConfigService with additional typed accessor methods (getString, getNumber).
 * Integrates with AppLogger for configuration validation logging.
 *
 * @remarks
 * - Must be imported before CommonModule in your application
 * - Validates configuration at module initialization
 * - Supports type-safe getters for string and number values
 * - Logs all configuration operations for audit trail
 *
 * @example
 * ```typescript
 * // Get configuration values
 * const port = configService.getNumber('PORT') ?? 3000;
 * const nodeEnv = configService.getString('NODE_ENV') ?? 'development';
 * const dbUrl = configService.getOrThrow('DATABASE_URL');
 *
 * // Validate configuration
 * configService.validate({
 *   PORT: { required: true },
 *   DATABASE_URL: { required: true },
 *   LOG_LEVEL: { required: false }
 * });
 * ```
 */
@Injectable()
export class ConfigService implements LazyModuleRefService, OnModuleInit, OnModuleDestroy {
	private _contextualLogger: AppLogger | undefined;

	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	public onModuleInit(): void {
		Logger.log('Configuration service initialized', ConfigService.name);
	}

	public get Logger(): AppLogger {
		if (!this._contextualLogger) {
			const baseLogger = this.Module.get(AppLogger, { strict: false });
			if (baseLogger) {
				this._contextualLogger = baseLogger.createContextualLogger(ConfigService.name);
			}
		}
		return this._contextualLogger ?? this.Module.get(AppLogger);
	}

	private get NestConfig(): NestConfigService {
		return this.Module.get(NestConfigService, { strict: false });
	}

	/**
	 * Validate configuration against schema
	 */
	public validate(schema: ConfigSchemaDefinition): void {
		const startTime = Date.now();
		this.Logger.debug('Starting configuration validation', {
			schemaKeys: Object.keys(schema).length,
		});

		try {
			// Basic validation - check required fields
			const requiredFields = Object.keys(schema).filter(key => schema[key].required);
			const optionalFields = Object.keys(schema).filter(key => !schema[key].required);
			const missingFields = requiredFields.filter(field => this.get(field) === undefined);

			if (missingFields.length > 0) {
				const durationMs = Date.now() - startTime;
				this.Logger.error('Configuration validation failed', undefined, undefined, {
					missingFields,
					requiredFields: requiredFields.length,
					durationMs,
				});
				throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
			}

			const durationMs = Date.now() - startTime;
			this.Logger.info('Configuration validation successful', {
				validatedFields: Object.keys(schema).length,
				requiredFields: requiredFields.length,
				optionalFields: optionalFields.length,
				durationMs,
			});
		} catch (error) {
			const durationMs = Date.now() - startTime;
			this.Logger.error('Configuration validation error', undefined, undefined, {
				error: error instanceof Error ? error.message : String(error),
				durationMs,
			});
			throw error;
		}
	}

	/**
	 * Get configuration value
	 */
	public get<T = any>(propertyPath: string, defaultValue?: T): T | undefined {
		return this.NestConfig.get(propertyPath, defaultValue);
	}

	/**
	 * Get configuration value or throw
	 */
	public getOrThrow<T = any>(propertyPath: string): T {
		return this.NestConfig.getOrThrow(propertyPath);
	}

	/**
	 * Get configuration value as string
	 */
	public getString(propertyPath: string, defaultValue?: string): string | undefined {
		const value = this.get(propertyPath, defaultValue);
		if (value === undefined) return undefined;
		return String(value);
	}

	/**
	 * Get configuration value as number
	 */
	public getNumber(propertyPath: string, defaultValue?: number): number | undefined {
		const value = this.get(propertyPath, defaultValue);
		if (value === undefined) return undefined;
		const num = Number(value);
		return isNaN(num) ? undefined : num;
	}

	/**
	 * Cleanup resources on module destruction
	 */
	public onModuleDestroy(): void {
		this._contextualLogger = undefined;
	}
}
