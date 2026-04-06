import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { ILazyModuleRefService } from '../common/utils/lazy-getter.types.js';
import { AppLogger, getErrorMessage } from '../common/index.js';

/**
 * Configuration schema definition interface.
 * Used for validating configuration structure.
 */
export interface IConfigSchemaDefinition {
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
export class ConfigService implements ILazyModuleRefService, OnModuleInit, OnModuleDestroy {
	private _ContextualLogger: AppLogger | undefined;

	public readonly Module: ModuleRef;

	constructor(module: ModuleRef) {
		this.Module = module;
	}

	public onModuleInit(): void {
		this.Logger.info('Configuration service initialized');
	}

	public get Logger(): AppLogger {
		if (!this._ContextualLogger) {
			const BaseLogger = this.Module.get(AppLogger, { strict: false });
			if (BaseLogger) {
				this._ContextualLogger = BaseLogger.CreateContextualLogger(ConfigService.name);
			}
		}
		return this._ContextualLogger ?? this.Module.get(AppLogger);
	}

	private get NestConfig(): NestConfigService {
		return this.Module.get(NestConfigService, { strict: false });
	}

	/**
	 * Validate configuration against schema
	 */
	public Validate(schema: IConfigSchemaDefinition): void {
		const StartTime = Date.now();
		this.Logger.Debug('Starting configuration validation', {
			schemaKeys: Object.keys(schema).length,
		});

		try {
			// Basic validation - check required fields
			const RequiredFields = Object.keys(schema).filter(key => schema[key].required);
			const OptionalFields = Object.keys(schema).filter(key => !schema[key].required);
			const MissingFields = RequiredFields.filter(field => this.Get(field) === undefined);

			if (MissingFields.length > 0) {
				const DurationMs = Date.now() - StartTime;
				this.Logger.error('Configuration validation failed', undefined, undefined, {
					missingFields: MissingFields,
					requiredFields: RequiredFields.length,
					durationMs: DurationMs,
				});
				throw new Error(`Missing required configuration fields: ${MissingFields.join(', ')}`);
			}

			const DurationMs = Date.now() - StartTime;
			this.Logger.info('Configuration validation successful', {
				validatedFields: Object.keys(schema).length,
				requiredFields: RequiredFields.length,
				optionalFields: OptionalFields.length,
				durationMs: DurationMs,
			});
		} catch (error) {
			const DurationMs = Date.now() - StartTime;
			this.Logger.error('Configuration validation error', undefined, undefined, {
				error: getErrorMessage(error),
				durationMs: DurationMs,
			});
			throw error;
		}
	}

	/**
	 * Get configuration value
	 */
	public Get<T = any>(propertyPath: string, defaultValue?: T): T | undefined {
		return this.NestConfig.get(propertyPath, defaultValue);
	}

	/**
	 * Get configuration value or throw
	 */
	public GetOrThrow<T = any>(propertyPath: string): T {
		return this.NestConfig.getOrThrow(propertyPath);
	}

	/**
	 * Get configuration value as string
	 */
	public GetString(propertyPath: string, defaultValue?: string): string | undefined {
		const Value = this.Get(propertyPath, defaultValue);
		if (Value === undefined) return undefined;
		return String(Value);
	}

	/**
	 * Get configuration value as number
	 */
	public GetNumber(propertyPath: string, defaultValue?: number): number | undefined {
		const Value = this.Get(propertyPath, defaultValue);
		if (Value === undefined) return undefined;
		const Num = Number(Value);
		return isNaN(Num) ? undefined : Num;
	}

	/**
	 * Cleanup resources on module destruction
	 */
	public onModuleDestroy(): void {
		this._ContextualLogger = undefined;
	}
}
