import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

/**
 * Bootstraps the NestJS example service.
 *
 * @remarks
 * This entry point is used by the `serve` NX target for local development.
 * Configure the service via environment variables — see `.env.example`.
 */
async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule);
	const port = parseInt(process.env['PORT'] ?? '3000', 10);
	await app.listen(port);
}

void bootstrap();
