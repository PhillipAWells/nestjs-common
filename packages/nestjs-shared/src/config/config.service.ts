import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { LazyModuleRefService } from '../common/utils/lazy-getter.types.js';
import { AppLogger } from '../common/index.js';

/**
 * Configuration Service
 * Provides typed access to environment variables with validation and transformation
 * Extends NestJS ConfigService with additional typed accessor methods
 */
/**
 * Configuration schema definition interface
 * Used for validating configuration structure
 */
export interface ConfigSchemaDefinition {
	[key: string]: {
		required: boolean;
		[key: string]: any;
	};
}

@Injectable()
export class ConfigService implements LazyModuleRefService, OnModuleDestroy {
	private _contextualLogger: AppLogger | undefined;

	constructor(
		public readonly moduleRef: ModuleRef,
		private readonly nestConfigService: NestConfigService,
	) {
		this.Logger.info('Configuration service initialized');
	}

	public get Logger(): AppLogger {
		if (!this._contextualLogger) {
			const baseLogger = this.moduleRef.get(AppLogger);
			this._contextualLogger = baseLogger.createContextualLogger(ConfigService.name);
		}
		return this._contextualLogger;
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
		return this.nestConfigService.get(propertyPath, defaultValue);
	}

	/**
	 * Get configuration value or throw
	 */
	public getOrThrow<T = any>(propertyPath: string): T {
		return this.nestConfigService.getOrThrow(propertyPath);
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
