import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Observable, from, EMPTY } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Response } from 'express';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';
import { AppLogger, getErrorMessage } from '@pawells/nestjs-shared/common';
import { BsonSerializationService } from './bson-serialization.service.js';

/**
 * Interceptor for serializing GraphQL responses to BSON
 * Checks Accept header for application/bson and converts response accordingly
 */
@Injectable()
export class BsonResponseInterceptor implements NestInterceptor, ILazyModuleRefService {
	public readonly Module: ModuleRef;
	private readonly Logger: AppLogger;

	public get BsonSerializationService(): BsonSerializationService {
		return this.Module.get(BsonSerializationService, { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
		this.Logger = new AppLogger(undefined, BsonResponseInterceptor.name);
	}

	/**
	 * Intercept GraphQL response and serialize to BSON if requested
	 */
	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		// Get HTTP context
		const Ctx = context.switchToHttp();
		const Response = Ctx.getResponse<Response>();
		const Request = Ctx.getRequest<any>();

		return next.handle().pipe(
			switchMap((data) => {
				// Check if client requested BSON response via Accept header
				const AcceptHeader = Request.get('accept')?.toLowerCase() ?? '';
				const AcceptsBson = AcceptHeader.includes('application/bson');

				if (!AcceptsBson) {
					// If not BSON request, let default JSON serialization handle it
					return from(Promise.resolve(data));
				}

				return from(
					this.BsonSerializationService.serialize(data).then(
						(bsonBuffer) => {
							// Set response headers
							Response.setHeader('Content-Type', 'application/bson');
							Response.setHeader('Content-Length', bsonBuffer.length);

							// Send BSON buffer directly
							Response.end(bsonBuffer);
							return EMPTY;
						},
						(error: unknown) => {
							// Log error but fall through to JSON response
							this.Logger.error(
								`Failed to serialize BSON response: ${getErrorMessage(error)}`,
							);

							// Set content type to JSON as fallback
							Response.setHeader('Content-Type', 'application/json');

							// Return data as JSON (will be handled by default serialization)
							Response.json(data);
							return EMPTY;
						},
					),
				);
			}),
		);
	}
}
