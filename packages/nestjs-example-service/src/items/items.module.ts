import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller.js';
import { ItemsService } from './items.service.js';
import { ItemsResolver } from './items.resolver.js';

/**
 * ItemsModule — feature module that demonstrates:
 *
 *  - QdrantService  (@pawells/nestjs-qdrant)    via ItemsService
 *  - @Traced        (@pawells/nestjs-open-telemetry) on service methods
 *  - @Profile       (@pawells/nestjs-pyroscope) on service methods
 *  - @Auth / @Public / @CurrentUser (@pawells/nestjs-auth) on controller routes
 *  - GraphQL resolver with PascalCase operation names (ItemsResolver)
 *
 * QdrantService is provided globally by QdrantModule.forRoot() — this module
 * does not need to import QdrantModule directly.
 *
 * Note: ItemsResolver requires the GraphQL module to be enabled in app.module.ts.
 * The GraphQL module is currently commented out — uncomment GraphQLModule.forRoot()
 * in app.module.ts to activate the resolver.
 */
@Module({
	controllers: [ItemsController],
	providers: [ItemsService, ItemsResolver],
	exports: [ItemsService],
})
export class ItemsModule {}
