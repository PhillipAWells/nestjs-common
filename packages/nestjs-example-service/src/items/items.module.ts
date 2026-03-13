import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller.js';
import { ItemsService } from './items.service.js';

/**
 * ItemsModule — feature module that demonstrates:
 *
 *  - QdrantService  (@pawells/nestjs-qdrant)    via ItemsService
 *  - @Traced        (@pawells/nestjs-open-telemetry) on service methods
 *  - @Profile       (@pawells/nestjs-pyroscope) on service methods
 *  - @Auth / @Public / @CurrentUser (@pawells/nestjs-auth) on controller routes
 *
 * QdrantService is provided globally by QdrantModule.forRoot() — this module
 * does not need to import QdrantModule directly.
 */
@Module({
	controllers: [ItemsController],
	providers: [ItemsService],
	exports: [ItemsService],
})
export class ItemsModule {}
