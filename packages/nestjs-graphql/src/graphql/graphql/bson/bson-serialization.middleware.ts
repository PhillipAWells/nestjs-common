import { Injectable, NestMiddleware } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Request, Response, NextFunction } from 'express';
import type { ILazyModuleRefService } from '@pawells/nestjs-shared/common';
import { getErrorMessage } from '@pawells/nestjs-shared/common';
import { BsonSerializationService } from './bson-serialization.service.js';

// Status code for client errors
const HTTP_STATUS_BAD_REQUEST = 400;

/**
 * Middleware for handling BSON request bodies
 * Deserializes incoming BSON data to JSON before GraphQL processing
 */
@Injectable()
export class BsonSerializationMiddleware implements NestMiddleware, ILazyModuleRefService {
	public readonly Module: ModuleRef;

	public get BsonSerializationService(): BsonSerializationService {
		return this.Module.get(BsonSerializationService, { strict: false });
	}

	constructor(moduleRef: ModuleRef) {
		this.Module = moduleRef;
	}

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

		// Collect raw body chunks
		const chunks: Buffer[] = [];

		// Handle data events
		const onData = (chunk: Buffer): void => {
			chunks.push(chunk);
		};

		const removeListeners = (): void => {
			if (typeof req.removeListener === 'function') {
				req.removeListener('data', onData);
				req.removeListener('end', onEnd);
				req.removeListener('error', onError);
			}
		};

		// Handle end event — async with proper error handling and listener cleanup
		const onEnd = (): void => {
			const buffer = Buffer.concat(chunks);
			this.BsonSerializationService.deserialize(buffer).then(
				(body) => {
					removeListeners();
					req.body = body;
					(req as any)._bsonRequest = true;
					next();
				},
				(error: unknown) => {
					removeListeners();
					res.status(HTTP_STATUS_BAD_REQUEST).json({
						errors: [
							{
								message: 'Failed to parse BSON body',
								extensions: {
									code: 'BAD_REQUEST',
									details: getErrorMessage(error),
								},
							},
						],
					});
				},
			);
		};

		// Handle error event
		const onError = (err: Error): void => {
			removeListeners();
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
		};

		// Attach listeners
		req.on('data', onData);
		req.on('end', onEnd);
		req.on('error', onError);
	}
}
