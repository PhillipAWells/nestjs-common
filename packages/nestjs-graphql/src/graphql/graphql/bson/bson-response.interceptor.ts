import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Response } from 'express';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';
import { BsonSerializationService } from './bson-serialization.service.js';

/**
 * Interceptor for serializing GraphQL responses to BSON
 * Checks Accept header for application/bson and converts response accordingly
 */
@Injectable()
export class BsonResponseInterceptor implements NestInterceptor, LazyModuleRefService {
	private readonly logger = new Logger(BsonResponseInterceptor.name);

	public get BsonSerializationService(): BsonSerializationService {
		return this.Module.get(BsonSerializationService, { strict: false });
	}

	constructor(public readonly Module: ModuleRef) {}

	/**
	 * Intercept GraphQL response and serialize to BSON if requested
	 */
	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		// Get HTTP context
		const ctx = context.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<any>();

		return next.handle().pipe(
			switchMap((data) => {
				// Check if client requested BSON response via Accept header
				const acceptHeader = request.get('accept')?.toLowerCase() ?? '';
				const acceptsBson = acceptHeader.includes('application/bson');

				if (!acceptsBson) {
					// If not BSON request, let default JSON serialization handle it
					return from(Promise.resolve(data));
				}

				return from(
					this.BsonSerializationService.serialize(data).then(
						(bsonBuffer) => {
							// Set response headers
							response.setHeader('Content-Type', 'application/bson');
							response.setHeader('Content-Length', bsonBuffer.length);

							// Send BSON buffer directly
							response.end(bsonBuffer);
							return data;
						},
						(error: unknown) => {
							// Log error but fall through to JSON response
							this.logger.error(
								`Failed to serialize BSON response: ${error instanceof Error ? error.message : String(error)}`,
							);

							// Set content type to JSON as fallback
							response.setHeader('Content-Type', 'application/json');

							// Return data as JSON (will be handled by default serialization)
							response.json(data);
							return data;
						},
					),
				);
			}),
		);
	}
}
