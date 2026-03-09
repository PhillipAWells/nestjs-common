import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { BsonSerializationService } from './bson-serialization.service.js';

/**
 * Middleware for handling BSON request bodies
 * Deserializes incoming BSON data to JSON before GraphQL processing
 */
@Injectable()
export class BsonSerializationMiddleware implements NestMiddleware {
	constructor(private readonly bsonService: BsonSerializationService) {}

	/**
	 * Handle incoming request
	 * If Content-Type is application/bson, deserialize and mark request
	 */
	public use(req: Request, res: Response, next: NextFunction): void {
		const contentType = req.get('content-type')?.toLowerCase() ?? '';

		// If not a BSON request, pass through
		if (!contentType.includes('application/bson')) {
			next();
			return;
		}

		// Handle BSON request asynchronously
		// eslint-disable-next-line require-await
		(async (): Promise<void> => {
			// Collect raw body chunks
			const chunks: Buffer[] = [];
			// Status code for client errors
			const HTTP_STATUS_BAD_REQUEST = 400;

			return new Promise<void>((resolve) => {
				// Handle data events
				const onData = (chunk: Buffer): void => {
					chunks.push(chunk);
				};

				// Handle end event
				const onEnd = (): void => {
					(async () => {
						try {
							// Combine all chunks into single buffer
							const buffer = Buffer.concat(chunks);

							// Deserialize BSON to object
							const body = await this.bsonService.deserialize(buffer);

							// Set req.body to deserialized object
							req.body = body;

							// Mark that this was a BSON request for response interceptor
							(req as any)._bsonRequest = true;

							// Continue to next middleware
							next();
							resolve();
						} catch (error) {
							// Handle parsing error
							res.status(HTTP_STATUS_BAD_REQUEST).json({
								errors: [
									{
										message: 'Failed to parse BSON body',
										extensions: {
											code: 'BAD_REQUEST',
											details: error instanceof Error ? error.message : String(error),
										},
									},
								],
							});
							resolve();
						}
					})();
				};

				// Handle error event
				const onError = (err: Error): void => {
					res.status(HTTP_STATUS_BAD_REQUEST).json({
						errors: [
							{
								message: 'Request body read error',
								extensions: {
									code: 'BAD_REQUEST',
									details: err.message,
								},
							},
						],
					});
					resolve();
				};

				// Attach listeners
				req.on('data', onData);
				req.on('end', onEnd);
				req.on('error', onError);
			});
		})();
	}
}
