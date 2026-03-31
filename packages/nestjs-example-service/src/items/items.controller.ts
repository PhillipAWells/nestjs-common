import { Controller, Get, Post, Delete, Body, Query, Param, BadRequestException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Auth, Public, CurrentUser } from '@pawells/nestjs-auth';
import { LazyModuleRefBase } from '@pawells/nestjs-shared';
import { ItemsService, type IItem, type IStoredItem } from './items.service.js';

const DEFAULT_LIMIT = 10;

/**
 * Minimal representation of an authenticated user injected via @CurrentUser().
 * In production this comes from the JWT payload resolved by userLookupFn.
 */
interface IAppUser {
	id: string;
	email: string;
	roles: string[];
}

/**
 * ItemsController — REST API for vector-based item search and management.
 *
 * Demonstrates:
 *  - @Auth    — require a valid JWT on a route (@pawells/nestjs-auth)
 *  - @Public  — opt a route out of the global auth guard
 *  - @CurrentUser — inject the resolved user from the JWT payload
 */
@Controller('items')
export class ItemsController extends LazyModuleRefBase {
	constructor(module: ModuleRef) {
		super(module);
	}

	protected get Qdrant(): ItemsService {
		return this.Module.get(ItemsService) as ItemsService;
	}

	/**
	 * POST /items
	 * Upsert an item with its embedding vector. Requires authentication.
	 */
	@Post()
	@Auth()
	public async UpsertItem(
		@Body() body: IStoredItem,
		@CurrentUser() _user: IAppUser,
	): Promise<void> {
		await this.Qdrant.UpsertItem(body);
	}

	/**
	 * GET /items/similar?vector=0.1,0.2,0.3&limit=5
	 * Find the nearest items for a query vector. Public — no auth required.
	 *
	 * This method validates parameters synchronously before returning the promise,
	 * so it does not need to be async.
	 */
	@Get('similar')
	@Public()
	// eslint-disable-next-line @typescript-eslint/promise-function-async
	public FindSimilar(
		@Query('vector') vectorStr: string,
		@Query('limit') limitStr?: string,
	): Promise<IItem[]> {
		if (!vectorStr) {
			throw new BadRequestException('vector query param is required');
		}

		const Vector = vectorStr.split(',').map(Number);

		if (Vector.some(n => !isFinite(n))) {
			throw new BadRequestException('vector must be a comma-separated list of numbers');
		}

		const Limit = limitStr !== undefined ? Number(limitStr) : DEFAULT_LIMIT;
		return this.Qdrant.FindSimilar(Vector, Limit);
	}

	/**
	 * DELETE /items/:id
	 * Remove an item by id. Requires authentication.
	 */
	@Delete(':id')
	@Auth()
	public async DeleteItem(
		@Param('id') id: string,
		@CurrentUser() _user: IAppUser,
	): Promise<void> {
		await this.Qdrant.DeleteItem(id);
	}
}
