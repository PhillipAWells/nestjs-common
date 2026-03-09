import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import { BsonSerializationService } from './bson-serialization.service.js';

/**
 * Interceptor for serializing GraphQL responses to BSON
 * Checks Accept header for application/bson and converts response accordingly
 */
@Injectable()
export class BsonResponseInterceptor implements NestInterceptor {
	private readonly logger = new Logger(BsonResponseInterceptor.name);

	constructor(private readonly bsonService: BsonSerializationService) {}

	/**
	 * Intercept GraphQL response and serialize to BSON if requested
	 */
	public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		// Get HTTP context
		const ctx = context.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<any>();

		return next.handle().pipe(
			tap(async (data) => {
				// Check if client requested BSON response via Accept header
				const acceptHeader = request.get('accept')?.toLowerCase() ?? '';
				const acceptsBson = acceptHeader.includes('application/bson');

				if (acceptsBson) {
					try {
						// Serialize response to BSON
						const bsonBuffer = await this.bsonService.serialize(data);

						// Set response headers
						response.setHeader('Content-Type', 'application/bson');
						response.setHeader('Content-Length', bsonBuffer.length);

						// Send BSON buffer directly
						response.end(bsonBuffer);
					} catch (error) {
						// Log error but fall through to JSON response
						this.logger.error(
							`Failed to serialize BSON response: ${error instanceof Error ? error.message : String(error)},
						`,
						);

						// Set content type to JSON as fallback
						response.setHeader('Content-Type', 'application/json');

						// Return data as JSON (will be handled by default serialization)
						response.json(data);
					}
				}
				// If not BSON request, let default JSON serialization handle it
			}),
		);
	}
}
